<?php

namespace App\Services\Courier;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Services\CarrybeeService;

class CarrybeeCourierProvider extends AbstractCourierProvider
{
    private function service(): CarrybeeService
    {
        return new CarrybeeService();
    }

    public function book(Order $order, array $data): array
    {
        $settings = CourierSetting::where('user_id', $order->user_id)->first();
        if (! $settings || ! $settings->carrybee_client_id || ! $settings->carrybee_client_secret || ! $settings->carrybee_client_context) {
            return ['success' => false, 'message' => 'CarryBee API credentials not configured. Go to Settings → Courier.'];
        }

        $storeId = $data['carrybee_store_id'] ?? $settings->carrybee_store_id ?? null;
        if (! $storeId) {
            return ['success' => false, 'message' => 'CarryBee pickup store is required. Configure a default in Settings → Courier or select one when booking.'];
        }

        $cityId = $data['delivery_city_id'] ?? null;
        $zoneId = $data['delivery_zone_id'] ?? null;
        if (! $cityId || ! $zoneId) {
            return ['success' => false, 'message' => 'CarryBee delivery city/zone is required. Search and select the customer\'s area when booking.'];
        }

        $address = $this->customerAddress($order);
        if (strlen($address) < 10) {
            return ['success' => false, 'message' => 'Customer address is too short for CarryBee booking (min 10 chars).'];
        }

        $weightKg = (float) ($data['parcel_weight_kg'] ?? 0.5);

        $payload = [
            'store_id'           => (string) $storeId,
            'merchant_order_id'  => $order->order_number,
            'delivery_type'      => 1, // Normal
            'product_type'       => 1, // Parcel
            'recipient_phone'    => $order->customer_phone,
            'recipient_name'     => $order->customer_name ?? $order->customer_phone,
            'recipient_address'  => substr($address, 0, 200),
            'city_id'            => (int) $cityId,
            'zone_id'            => (int) $zoneId,
            'item_weight'        => (int) round($weightKg * 1000),
            'collectable_amount' => (int) ($data['cod_amount'] ?? $order->total),
        ];

        if (! empty($data['delivery_area_id'])) $payload['area_id'] = (int) $data['delivery_area_id'];

        $instruction = $data['note'] ?? $order->notes ?? '';
        if ($instruction !== '') {
            $payload['special_instruction'] = substr($instruction, 0, 255);
        }

        $result = $this->service()->createOrder($order->user_id, $payload);

        if ($result['success']) {
            return [
                'success'        => true,
                'consignment_id' => $result['data']['consignment_id'],
                'delivery_fee'   => $result['data']['delivery_fee'] ?? null,
                'message'        => $result['message'] ?? 'CarryBee order booked.',
            ];
        }

        return [
            'success' => false,
            'message' => $result['message'] ?? 'CarryBee booking failed.',
            'errors'  => $result['causes'] ?? null,
            'raw'     => $result['raw'] ?? null,
        ];
    }

    public function track(Order $order): array
    {
        $result = $this->service()->getOrderDetails($order->user_id, (string) $order->courier_tracking_id);

        return [
            'success' => $result['success'] ?? false,
            'status'  => $result['data']['transfer_status'] ?? null,
            'raw'     => $result['data'] ?? [],
            'message' => $result['message'] ?? null,
        ];
    }

    public function cancel(Order $order, string $reason = ''): array
    {
        return $this->service()->cancelOrder($order->user_id, (string) $order->courier_tracking_id, $reason ?: 'Cancelled by seller.');
    }
}
