<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderStatusLog;
use App\Models\ProductVariant;
use App\Support\PhoneIntelCache;

class OrderStatusService
{
    public function __construct(
        private readonly SmsAutomationService $smsAutomationService,
        private readonly AccountingService $accountingService,
    ) {}

    /**
     * Apply a status transition and all its side effects (inventory reservation,
     * status log, SMS automation trigger, delivered/cancelled/returned accounting).
     *
     * $adjustInventory exists only to preserve OrderController::bulkStatus()'s
     * pre-existing behavior of not touching variant stock — new callers should
     * leave it at the default.
     */
    public function transition(
        Order $order,
        string $newStatus,
        ?string $note = null,
        ?int $changedBy = null,
        bool $adjustInventory = true,
    ): void {
        $oldStatus = $order->status;
        if ($oldStatus === $newStatus) {
            return;
        }

        $order->update(['status' => $newStatus]);
        PhoneIntelCache::bump($order->customer_phone);

        if ($adjustInventory) {
            $this->adjustVariantInventoryForStatusTransition($order, $oldStatus, $newStatus);
        }

        OrderStatusLog::create([
            'order_id'   => $order->id,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'note'       => $note,
            'changed_by' => $changedBy,
        ]);

        $this->smsAutomationService->handleOrderStatusChanged($order, $oldStatus, $newStatus);

        if ($newStatus === 'delivered') {
            $this->accountingService->onOrderDelivered($order);
        }

        if (in_array($newStatus, ['cancelled', 'returned'], true)) {
            $this->accountingService->onOrderCancelledOrReturned($order);
        }
    }

    private function adjustVariantInventoryForStatusTransition(Order $order, string $oldStatus, string $newStatus): void
    {
        $reserveStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];
        $releaseStatuses = ['cancelled', 'returned'];

        $wasReserved = in_array($oldStatus, $reserveStatuses, true);
        $isReserved  = in_array($newStatus, $reserveStatuses, true);

        if (!$wasReserved && $isReserved) {
            foreach ($order->items()->whereNotNull('product_variant_id')->get() as $item) {
                ProductVariant::where('id', $item->product_variant_id)
                    ->whereNull('deleted_at')
                    ->decrement('stock_qty', (int) $item->quantity);
            }
            return;
        }

        if ($wasReserved && in_array($newStatus, $releaseStatuses, true)) {
            foreach ($order->items()->whereNotNull('product_variant_id')->get() as $item) {
                ProductVariant::where('id', $item->product_variant_id)
                    ->whereNull('deleted_at')
                    ->increment('stock_qty', (int) $item->quantity);
            }
        }
    }
}
