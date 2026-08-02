<?php

namespace App\Services\Courier;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Services\RedxService;

class RedxCourierProvider extends AbstractCourierProvider
{
    private function service(): RedxService
    {
        return new RedxService();
    }

    public function book(Order $order, array $data): array
    {
        $settings = CourierSetting::where('user_id', $order->user_id)->first();
        if (! $settings || ! $settings->redx_api_key) {
            return ['success' => false, 'message' => 'RedX API credentials not configured. Go to Settings → Courier.'];
        }

        $pickupStoreId = $data['pickup_store_id'] ?? $settings->redx_pickup_store_id ?? null;
        if (! $pickupStoreId) {
            return ['success' => false, 'message' => 'RedX pickup store is required. Configure a default in Settings → Courier or select one when booking.'];
        }

        $deliveryAreaId = $data['delivery_area_id'] ?? $order->redx_area_id ?? null;
        $deliveryAreaName = $data['delivery_area'] ?? null;
        if (! $deliveryAreaId || ! $deliveryAreaName) {
            return ['success' => false, 'message' => 'RedX delivery area is required. Search and select the customer\'s area when booking.'];
        }

        $address = $this->customerAddress($order);
        if ($address === '') {
            return ['success' => false, 'message' => 'Customer address is required for RedX booking.'];
        }

        $codAmount = (float) ($data['cod_amount'] ?? $order->total);
        $value     = (float) ($data['value'] ?? $codAmount);
        $weightKg  = (float) ($data['parcel_weight_kg'] ?? 0.5);

        $payload = [
            'customer_name'          => $order->customer_name ?? $order->customer_phone,
            'customer_phone'         => $order->customer_phone,
            'delivery_area'          => $deliveryAreaName,
            'delivery_area_id'       => (int) $deliveryAreaId,
            'customer_address'       => substr($address, 0, 220),
            'merchant_invoice_id'    => $order->order_number,
            'cash_collection_amount' => $codAmount,
            'parcel_weight'          => (int) round($weightKg * 1000),
            'value'                  => $value,
            'pickup_store_id'        => (int) $pickupStoreId,
        ];

        $instruction = $data['note'] ?? $order->notes ?? '';
        if ($instruction !== '') {
            $payload['instruction'] = $instruction;
        }

        $result = $this->service()->createParcel($order->user_id, $payload);

        if ($result['success']) {
            return [
                'success'        => true,
                'consignment_id' => $result['tracking_id'],
                'message'        => 'RedX parcel booked.',
            ];
        }

        return [
            'success' => false,
            'message' => $result['message'] ?? 'RedX booking failed.',
            'errors'  => $result['errors'] ?? null,
            'raw'     => $result['raw'] ?? null,
        ];
    }

    public function track(Order $order): array
    {
        $result = $this->service()->getParcelInfo($order->user_id, (string) $order->courier_tracking_id);

        return [
            'success' => $result['success'] ?? false,
            'status'  => $result['data']['status'] ?? null,
            'raw'     => $result['data'] ?? [],
            'message' => $result['message'] ?? null,
        ];
    }
}
