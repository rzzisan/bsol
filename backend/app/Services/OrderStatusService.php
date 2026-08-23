<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Tracking\TrackingIngestService;
use App\Services\Whatsapp\WhatsappAutomationService;
use App\Support\PhoneIntelCache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class OrderStatusService
{
    /**
     * Order status → Meta order-flow event (tracking_capi_context.md §1, §7).
     * 'pending' and 'processing' have no event — nothing ad-relevant has
     * happened yet at either.
     */
    private const ORDER_FLOW_EVENTS = [
        'confirmed' => 'OrderConfirmed',
        'shipped' => 'OrderShipped',
        'delivered' => 'OrderDelivered',
        'returned' => 'OrderReturned',
        'cancelled' => 'OrderCanceled',
    ];

    public function __construct(
        private readonly SmsAutomationService $smsAutomationService,
        private readonly WhatsappAutomationService $whatsappAutomationService,
        private readonly AccountingService $accountingService,
        private readonly TrackingIngestService $trackingIngest,
        private readonly DigitalDeliveryService $digitalDeliveryService,
        private readonly OrderCreditService $orderCreditService,
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

        // Status update + inventory decrement + the quota/credit charge all
        // happen atomically: if a variant or tracked product doesn't have
        // enough stock left (adjustInventoryForStatusTransition throws), or
        // the plan quota is exhausted with no add-on credit to fall back on
        // (consumeProcessingQuotaOrFail throws), NOTHING here is left
        // half-applied — a failed attempt must never silently spend a
        // quota slot or an order-credit for an order that didn't actually
        // move. Order quota redesign: subscription_billing_context.md
        // §9.2-A/§9.2-B. Placing an order never costs quota (unlimited
        // pending); the first time it ever leaves 'pending', for any
        // status, through any of this service's callers (manual/bulk
        // status change, courier sync, WooCommerce sync, payment confirm),
        // it counts against the plan's monthly processing limit (or an
        // add-on credit once that's exhausted). No refund if it's later
        // cancelled or somehow reverts to pending and leaves again (§9.3
        // decision #4) — quota_consumed_at is a one-way stamp.
        DB::transaction(function () use ($order, $oldStatus, $newStatus) {
            if ($order->quota_consumed_at === null && $newStatus !== 'pending') {
                $this->consumeProcessingQuotaOrFail($order);
            }

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
        $this->whatsappAutomationService->handleOrderStatusChanged($order, $oldStatus, $newStatus);

        // Digital-product delivery is gated on payment, not a courier
        // milestone — 'confirmed' is where OnlinePaymentService actually
        // records money (wallet-verify or automated-gateway callback, both
        // funnel through applyConfirmedPayment()), so it's the right hook
        // point rather than 'delivered' (a physical-fulfillment concept the
        // order never reaches for a digital-only order). No-ops instantly
        // for orders with no digital items. See digital_product_context.md §4.
        if ($newStatus === 'confirmed') {
            $this->digitalDeliveryService->deliverForOrder($order);
        }

        if ($newStatus === 'delivered') {
            $this->accountingService->onOrderDelivered($order);
        }

        if (in_array($newStatus, ['cancelled', 'returned'], true)) {
            $this->accountingService->onOrderCancelledOrReturned($order);
        }

        $this->submitTrackingEvent($order, $newStatus);
    }

    /**
     * BSOL is the *authoritative* source for order-flow events — WordPress
     * only sees "processing" until a courier eventually reports delivery,
     * BSOL knows the real outcome the moment this transition happens
     * (tracking_capi_context.md §7, "গুরুত্বপূর্ণ" note). This is §1's whole
     * differentiator: an ad platform normally only ever hears "form
     * submitted", never "courier actually delivered it and got paid".
     *
     * Deliberately not wrapped around the DB::transaction above — ingest()
     * only touches tracking_events/tracking_usage_daily (never orders), so
     * there's nothing here for that transaction to protect. It IS wrapped
     * in its own try/catch: a bug in the tracking pipeline must never take
     * down an order status update, which is core business logic and the
     * one thing this method exists to do.
     */
    private function submitTrackingEvent(Order $order, string $newStatus): void
    {
        $eventName = self::ORDER_FLOW_EVENTS[$newStatus] ?? null;
        if ($eventName === null) {
            return;
        }

        try {
            // Product value only, shipping excluded — Meta's ROAS math
            // shouldn't count shipping as ad-driven revenue (§11.3 #3).
            $value = max(0.0, (float) $order->total - (float) $order->shipping_charge);

            // Returned reverses a delivery that was already reported as a
            // positive conversion — a negative value is the signal Meta
            // documents for "this customer should be excluded from a
            // lookalike/remarketing audience built on Purchase/Delivered"
            // (§1). Cancelled never had a delivered value to reverse, but
            // it's the same "don't optimize toward this person" signal.
            if ($value > 0 && in_array($newStatus, ['returned', 'cancelled'], true)) {
                $value = -$value;
            }

            $event = [
                'event_name' => $eventName,
                // order_{id}_{event}, deliberately distinct from the
                // Purchase event's own order_{id} id — Delivered on the
                // same order is a separate conversion, not a dedupe target
                // for the checkout event (§3.2).
                'event_id' => 'order_' . $order->id . '_' . $eventName,
                'event_time' => now(),
                // No browser request behind a status change — this is BSOL
                // itself (or a WooCommerce status sync) deciding the order
                // moved, never a customer action (§7).
                'action_source' => 'system_generated',
                // fbp/fbc from the order row, not a live request — this
                // fires from a status transition, potentially days after
                // checkout, with no browser attached to borrow cookies
                // from. Only the phone hash was ever sent here before
                // fbp/fbc started being persisted on the order
                // (tracking_capi_context.md §11.4).
                'user_data' => array_filter([
                    'ph' => $order->customer_phone,
                    'fbp' => $order->fbp,
                    'fbc' => $order->fbc,
                ]),
                'custom_data' => [
                    'currency' => 'BDT',
                    'value' => $value,
                    'content_ids' => $order->items->pluck('product_id')->filter()->values()->all(),
                    'content_type' => 'product',
                ],
            ];

            $this->trackingIngest->ingest($order->user_id, $event, $this->trackingContextFor($order));
        } catch (\Throwable $e) {
            Log::warning('Order-flow tracking event submission failed', [
                'order_id' => $order->id,
                'event_name' => $eventName,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Same scope resolution the WooCommerce/landing-page ingest paths use
     * (§4.1) — a destination pinned to this order's site/page still
     * receives its own order-flow events, not just its Purchase event.
     * Order has no landing_page_id column; a landing-page order carries the
     * page id in source_ref (LandingPageController's own convention).
     *
     * @return array<string, mixed>
     */
    private function trackingContextFor(Order $order): array
    {
        $context = ['order_id' => $order->id];

        if ($order->platform_api_key_id) {
            $context['platform_api_key_id'] = $order->platform_api_key_id;
            $context['scope_type'] = 'platform_api_key';
            $context['scope_id'] = $order->platform_api_key_id;
        } elseif ($order->source === 'landing_page' && $order->source_ref) {
            $context['landing_page_id'] = (int) $order->source_ref;
            $context['scope_type'] = 'landing_page';
            $context['scope_id'] = (int) $order->source_ref;
        }

        return $context;
    }

    /**
     * §9.2-A's quota gate. `order.user_id` is always the shop owner
     * (Order.user_id, staff_team_role_context.md §3.3 convention), so no
     * shopOwner() indirection needed here.
     */
    private function consumeProcessingQuotaOrFail(Order $order): void
    {
        $owner = User::find($order->user_id);
        $maxOrders = $owner?->subscriptionPackage?->max_orders;

        if ($maxOrders === null) {
            // Unlimited plan — nothing was actually consumed against
            // anything, so quota_source stays null (distinguishes this
            // from a plan-quota or addon-credit consumption below).
            $this->stampQuota($order, null);
            return;
        }

        $shopUserIds = $owner->shopUserIds();
        // Only 'plan'-sourced consumption counts here — an order covered
        // by an add-on credit (below) must never keep counting against
        // the plan's own quota, or every add-on-covered order would
        // permanently inflate this count and the credits would be
        // worthless (subscription_billing_context.md §9.2-B).
        $processedThisMonth = Order::whereIn('user_id', $shopUserIds)
            ->where('quota_source', 'plan')
            ->whereYear('quota_consumed_at', now()->year)
            ->whereMonth('quota_consumed_at', now()->month)
            ->count();

        if ($processedThisMonth < $maxOrders) {
            $this->stampQuota($order, 'plan');
            return;
        }

        // Plan quota exhausted this month — fall back to the order-credit
        // add-on wallet (§9.2-B) before blocking.
        if ($this->orderCreditService->consumeOne($owner->id, $order->id, "Order #{$order->id} processed past plan quota")) {
            $this->stampQuota($order, 'addon_credit');
            return;
        }

        $exception = ValidationException::withMessages([
            'status' => ['Monthly order-processing limit reached for your current plan. Please upgrade or buy an order-credit add-on to process more orders this month.'],
        ]);
        $exception->status = 402;
        throw $exception;
    }

    /**
     * Atomic claim (whereNull guard) — a concurrent transition on the
     * same order can't double-consume; a small race at the exact monthly
     * boundary between two *different* orders is possible (same precision
     * the old creation-time check had) and accepted.
     */
    private function stampQuota(Order $order, ?string $source): void
    {
        $affected = Order::where('id', $order->id)->whereNull('quota_consumed_at')
            ->update(['quota_consumed_at' => now(), 'quota_source' => $source]);
        if ($affected > 0) {
            $order->quota_consumed_at = now();
            $order->quota_source = $source;
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
