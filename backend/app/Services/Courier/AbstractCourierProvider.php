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

    /**
     * The amount actually asked of the courier at booking time. Defaults to
     * the order's real due balance (total minus everything already
     * collected — manual_payment_collection_context.md §3খ) rather than
     * the full order total, so a partially-paid order's COD isn't
     * inflated by money already in hand. Never negative (an overpaid
     * order still asks for ৳0, not a negative collection).
     *
     * CourierController::book() already resolves and injects
     * $data['cod_amount'] before calling any provider (also enforcing the
     * staff-can't-override rule there), so in practice this method's own
     * $order->dueAmount() fallback is defense-in-depth, not the primary path.
     */
    protected function resolveCodAmount(Order $order, array $data): float
    {
        return (float) ($data['cod_amount'] ?? max(0, $order->dueAmount()));
    }
}
