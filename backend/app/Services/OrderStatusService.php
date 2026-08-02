<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\PhoneIntelCache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderStatusService
{
    public function __construct(
        private readonly SmsAutomationService $smsAutomationService,
        private readonly AccountingService $accountingService,
    ) {}

    /**
     * Apply a status transition and all its side effects (inventory reservation,
     * status log, SMS automation trigger, delivered/cancelled/returned accounting).
     */
    public function transition(
        Order $order,
        string $newStatus,
        ?string $note = null,
        ?int $changedBy = null,
    ): void {
        $oldStatus = $order->status;
        if ($oldStatus === $newStatus) {
            return;
        }

        // Status update + inventory decrement happen atomically: if a variant
        // or tracked product doesn't have enough stock left
        // (adjustInventoryForStatusTransition throws), the order's status
        // change and any earlier decrements already made for this same order
        // both roll back together, instead of leaving the order
        // half-transitioned with mismatched stock.
        DB::transaction(function () use ($order, $oldStatus, $newStatus) {
            $order->update(['status' => $newStatus]);
            $this->adjustInventoryForStatusTransition($order, $oldStatus, $newStatus);
        });

        PhoneIntelCache::bump($order->customer_phone);

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

    private function adjustInventoryForStatusTransition(Order $order, string $oldStatus, string $newStatus): void
    {
        $reserveStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];
        $releaseStatuses = ['cancelled', 'returned'];

        $wasReserved = in_array($oldStatus, $reserveStatuses, true);
        $isReserved  = in_array($newStatus, $reserveStatuses, true);

        if (!$wasReserved && $isReserved) {
            foreach ($order->items()->whereNotNull('product_variant_id')->get() as $item) {
                $this->reserveVariantStock($item, $newStatus);
            }
            foreach ($order->items()->whereNull('product_variant_id')->whereNotNull('product_id')->get() as $item) {
                $this->reserveProductStock($item, $newStatus);
            }
            return;
        }

        if ($wasReserved && in_array($newStatus, $releaseStatuses, true)) {
            foreach ($order->items()->whereNotNull('product_variant_id')->get() as $item) {
                ProductVariant::where('id', $item->product_variant_id)
                    ->whereNull('deleted_at')
                    ->increment('stock_qty', (int) $item->quantity);
            }
            foreach ($order->items()->whereNull('product_variant_id')->whereNotNull('product_id')->get() as $item) {
                Product::where('id', $item->product_id)
                    ->whereNull('deleted_at')
                    ->where('track_stock', true)
                    ->increment('stock', (int) $item->quantity);
            }
        }
    }

    private function reserveVariantStock(OrderItem $item, string $newStatus): void
    {
        $quantity = (int) $item->quantity;

        // The WHERE stock_qty >= quantity guard is evaluated by
        // Postgres against the row's current value under the row
        // lock this UPDATE itself takes — so two concurrent status
        // transitions racing to reserve the same variant can no
        // longer both succeed and drive stock_qty negative
        // (overselling). Whichever loses the race affects 0 rows
        // and gets rejected below instead of silently corrupting
        // stock.
        $affected = ProductVariant::where('id', $item->product_variant_id)
            ->whereNull('deleted_at')
            ->where('stock_qty', '>=', $quantity)
            ->decrement('stock_qty', $quantity);

        if ($affected === 0) {
            $variant = ProductVariant::withTrashed()->find($item->product_variant_id);
            $label = $variant?->sku ?: "variant #{$item->product_variant_id}";
            throw ValidationException::withMessages([
                'status' => ["Insufficient stock for {$label} — cannot move this order to \"{$newStatus}\"."],
            ]);
        }
    }

    private function reserveProductStock(OrderItem $item, string $newStatus): void
    {
        $quantity = (int) $item->quantity;

        // Same atomic guarded-decrement pattern as reserveVariantStock,
        // plus a track_stock=true guard so untracked products (the
        // common case) are a no-op rather than an error.
        $affected = Product::where('id', $item->product_id)
            ->whereNull('deleted_at')
            ->where('track_stock', true)
            ->where('stock', '>=', $quantity)
            ->decrement('stock', $quantity);

        if ($affected === 0) {
            $product = Product::withTrashed()->find($item->product_id);
            if ($product && $product->track_stock) {
                throw ValidationException::withMessages([
                    'status' => ["Insufficient stock for {$product->name} — cannot move this order to \"{$newStatus}\"."],
                ]);
            }
        }
    }
}
