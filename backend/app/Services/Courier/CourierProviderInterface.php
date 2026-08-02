<?php

namespace App\Services\Courier;

use App\Models\Order;

/**
 * Common contract every courier integration must satisfy so CourierController
 * can dispatch through CourierFactory instead of branching per-provider.
 *
 * book()/track() return a normalized array — see AbstractCourierProvider for
 * the exact key contract each method must honor.
 */
interface CourierProviderInterface
{
    public function book(Order $order, array $data): array;

    /**
     * @param  Order[]  $orders
     * @return array<int, array{order_id: int, order_number: string, success: bool, consignment_id: ?string, message: ?string}>
     */
    public function bookBulk(array $orders, array $data): array;

    public function track(Order $order): array;

    public function cancel(Order $order, string $reason = ''): array;
}
