<?php

namespace App\Services\Courier;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Services\PathaoService;

class PathaoCourierProvider extends AbstractCourierProvider
{
    private function service(): PathaoService
    {
        return new PathaoService();
    }

    public function book(Order $order, array $data): array
    {
        $settings = CourierSetting::where('user_id', $order->user_id)->first();

        $storeId = $data['store_id'] ?? ($settings->pathao_store_id ?? null);
        if (! $storeId) {
            return ['success' => false, 'message' => 'Pathao store_id is required. Configure it in Settings → Courier.'];
        }

        $address = $order->customer_address ?? '';
        if ($order->customer_district) $address .= ', ' . $order->customer_district;
        if ($order->customer_thana)    $address .= ', ' . $order->customer_thana;
        if ($order->customer_area)     $address .= ', ' . $order->customer_area;
        $address = trim($address, ', ');

        if (strlen($address) < 10) {
            $address = ($address ?: ($order->customer_district ?? 'Bangladesh')) . ', Bangladesh';
        }

        $payload = [
            'store_id'          => (int) $storeId,
            'merchant_order_id' => $order->order_number,
            'recipient_name'    => $order->customer_name ?? $order->customer_phone,
            'recipient_phone'   => $order->customer_phone,
            'recipient_address' => substr($address, 0, 220),
            'delivery_type'     => $data['delivery_type'] ?? 48,
            'item_type'         => $data['item_type'] ?? 2,
            'item_quantity'     => 1,
            'item_weight'       => $data['item_weight'] ?? 0.5,
            'amount_to_collect' => (int) ($data['cod_amount'] ?? $order->total),
        ];

        if ($order->pathao_city_id) $payload['recipient_city'] = $order->pathao_city_id;
        if ($order->pathao_zone_id) $payload['recipient_zone'] = $order->pathao_zone_id;
        if ($order->pathao_area_id) $payload['recipient_area'] = $order->pathao_area_id;

        if (! empty($data['special_instruction'])) $payload['special_instruction'] = $data['special_instruction'];
        if (! empty($data['item_description']))    $payload['item_description']    = $data['item_description'];
        if (! empty($data['note']))                $payload['special_instruction'] = $data['note'];

        $result = $this->service()->createOrder($order->user_id, $payload);

        if ($result['success']) {
            return [
                'success'        => true,
                'consignment_id' => $result['consignment_id'],
                'delivery_fee'   => $result['delivery_fee'] ?? null,
                'courier_status' => strtolower($result['order_status'] ?? 'booked'),
                'message'        => $result['message'] ?? 'Pathao order booked.',
            ];
        }

        return [
            'success' => false,
            'message' => $result['message'] ?? 'Pathao booking failed.',
            'errors'  => $result['errors'] ?? null,
            'raw'     => $result['raw'] ?? null,
        ];
    }

    public function track(Order $order): array
    {
        $result = $this->service()->getOrderInfo($order->user_id, (string) $order->courier_tracking_id);

        return [
            'success' => $result['success'] ?? false,
            'status'  => $result['data']['order_status_slug'] ?? null,
            'raw'     => $result['data'] ?? [],
            'message' => $result['message'] ?? null,
        ];
    }
}
