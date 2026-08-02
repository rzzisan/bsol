<?php

namespace App\Services\Courier;

use App\Models\Order;

abstract class AbstractCourierProvider implements CourierProviderInterface
{
    /**
     * Default bulk implementation: call book() per order. Providers with a
     * native bulk-create API (e.g. Steadfast) override this.
     */
    public function bookBulk(array $orders, array $data): array
    {
        $rows = [];

        foreach ($orders as $order) {
            $result = $this->book($order, $data);
            $rows[] = [
                'order_id'       => $order->id,
                'order_number'   => $order->order_number,
                'success'        => $result['success'],
                'consignment_id' => $result['consignment_id'] ?? null,
                'courier_status' => $result['courier_status'] ?? null,
                'delivery_fee'   => $result['delivery_fee'] ?? null,
                'message'        => $result['message'] ?? null,
            ];
        }

        return $rows;
    }

    public function cancel(Order $order, string $reason = ''): array
    {
        return [
            'success' => false,
            'message' => static::class . ' does not support order cancellation via API.',
        ];
    }

    protected function customerAddress(Order $order): string
    {
        return trim(implode(', ', array_filter([
            $order->customer_address,
            $order->customer_area,
            $order->customer_thana,
            $order->customer_district,
        ])));
    }
}
