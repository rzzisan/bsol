<?php

namespace App\Services\Courier;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Services\PaperflyService;

class PaperflyCourierProvider extends AbstractCourierProvider
{
    /** Paperfly's own tracking-step keys, in latest-wins priority order. */
    private const STATUS_PRIORITY = [
        'Returned' => 'returned',
        'Delivered' => 'delivered',
        'Partial' => 'partial',
        'PickedForDelivery' => 'picked_for_delivery',
        'ReceivedAtPoint' => 'received_at_point',
        'inTransit' => 'in_transit',
        'Pick' => 'picked',
    ];

    private function service(): PaperflyService
    {
        return new PaperflyService();
    }

    public function book(Order $order, array $data): array
    {
        $settings = CourierSetting::where('user_id', $order->user_id)->first();
        if (! $settings || ! $settings->paperfly_username || ! $settings->paperfly_password || ! $settings->paperfly_api_key) {
            return ['success' => false, 'message' => 'Paperfly API credentials not configured. Go to Settings → Courier.'];
        }

        $storeName = $data['paperfly_store_name'] ?? $settings->paperfly_store_name ?? null;
        if (! $storeName) {
            return ['success' => false, 'message' => 'Paperfly store name is required. Configure a default in Settings → Courier or provide one when booking.'];
        }

        $address = $this->customerAddress($order);
        if ($address === '') {
            return ['success' => false, 'message' => 'Customer address is required for Paperfly booking.'];
        }

        $weightKg = (float) ($data['parcel_weight_kg'] ?? 0.5);
        $codAmount = $this->resolveCodAmount($order, $data);

        $payload = [
            'merchantOrderReference' => $order->order_number,
            'storeName' => $storeName,
            'productBrief' => substr((string) ($data['product_brief'] ?? $order->notes ?? 'Product'), 0, 200),
            'packagePrice' => (string) $codAmount,
            'max_weight' => (string) $weightKg,
            'customerName' => $order->customer_name ?? $order->customer_phone,
            'customerAddress' => substr($address, 0, 200),
            'customerPhone' => $order->customer_phone,
        ];

        $result = $this->service()->createOrder($order->user_id, $payload);

        if ($result['success']) {
            return [
                'success' => true,
                'consignment_id' => $result['data']['tracking_number'] ?? null,
                'message' => $result['data']['message'] ?? 'Paperfly order booked.',
            ];
        }

        return [
            'success' => false,
            'message' => $result['message'] ?? 'Paperfly booking failed.',
            'raw' => $result['raw'] ?? null,
        ];
    }

    /**
     * Paperfly's tracking/cancel endpoints are keyed by the merchantOrderReference
     * we sent at booking time (our own order_number), not by the tracking_number
     * they return — so this deliberately ignores courier_tracking_id.
     */
    public function track(Order $order): array
    {
        $result = $this->service()->trackOrder($order->user_id, $order->order_number);

        if (! ($result['success'] ?? false)) {
            return ['success' => false, 'status' => null, 'raw' => [], 'message' => $result['message'] ?? null];
        }

        $steps = $result['data']['trackingStatus'][0] ?? [];

        return [
            'success' => true,
            'status' => $this->deriveStatus($steps),
            'raw' => $result['data'],
            'message' => null,
        ];
    }

    public function cancel(Order $order, string $reason = ''): array
    {
        return $this->service()->cancelOrder($order->user_id, $order->order_number);
    }

    private function deriveStatus(array $steps): ?string
    {
        foreach (self::STATUS_PRIORITY as $key => $normalized) {
            if (! empty($steps[$key])) {
                return $normalized;
            }
        }

        return null;
    }
}
