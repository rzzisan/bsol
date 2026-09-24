<?php

namespace App\Services;

use App\Models\AbandonedCheckout;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Scopes\HeldOrderCheckoutScope;
use App\Models\Scopes\HeldOrderScope;
use App\Models\User;
use App\Support\PhoneIntelCache;

/**
 * Orders placed by customers (landing page / storefront) while the shop
 * owner's subscription is expired are still stored, but flagged
 * `orders.held_at` and hidden from the seller (HeldOrderScope) — the seller
 * only sees a "N new orders waiting, renew to view" notice. On renewal the
 * held orders from the last WINDOW_DAYS days are released; older ones are
 * purged by app:purge-held-orders. See subscription_billing_context.md §13.
 *
 * While held an order deliberately has none of the side effects a normal
 * new order has (customer record, COD accounting entry, OTP SMS, Facebook
 * CAPI event), and no stock/quota is touched — stock and quota only move on
 * status transitions, which a hidden order can never get. The
 * bookkeeping side effects are replayed once on release().
 */
class HeldOrderService
{
    public const WINDOW_DAYS = 7;

    /** True when the shop behind this owner id can't currently process orders. */
    public function ownerIsLapsed(int $ownerId): bool
    {
        return User::find($ownerId)?->isSubscriptionExpired() ?? false;
    }

    public function hold(Order $order): void
    {
        $order->forceFill(['held_at' => now()])->save();
    }

    /** Held orders still inside the renewable window. */
    private function releasable(int $ownerId)
    {
        return Order::withoutGlobalScope(HeldOrderScope::class)
            ->where('user_id', $ownerId)
            ->whereNotNull('held_at')
            ->where('held_at', '>=', now()->subDays(self::WINDOW_DAYS));
    }

    /** AbandonedCheckout.user_id is the page creator, which may be a staff sub-account. */
    private function shopUserIds(int $ownerId): array
    {
        return User::find($ownerId)?->shopUserIds() ?? [$ownerId];
    }

    /** Held leads (abandoned checkouts not tied to an order) still inside the window. */
    private function releasableLeads(int $ownerId)
    {
        return AbandonedCheckout::withoutGlobalScope(HeldOrderCheckoutScope::class)
            ->whereIn('user_id', $this->shopUserIds($ownerId))
            ->whereNull('order_id')
            ->whereNotNull('held_at')
            ->where('held_at', '>=', now()->subDays(self::WINDOW_DAYS));
    }

    public function heldLeadsCount(int $ownerId): int
    {
        return $this->releasableLeads($ownerId)->count();
    }

    public function heldCount(int $ownerId): int
    {
        return $this->releasable($ownerId)->count();
    }

    /** When the oldest still-renewable held order will be lost, or null. */
    public function oldestExpiresAt(int $ownerId): ?\Illuminate\Support\Carbon
    {
        $oldest = $this->releasable($ownerId)->min('held_at');

        return $oldest ? \Illuminate\Support\Carbon::parse($oldest)->addDays(self::WINDOW_DAYS) : null;
    }

    /**
     * Makes the owner's renewable held orders visible and replays the
     * bookkeeping they skipped. Returns how many were released.
     */
    public function release(User $owner): int
    {
        // Leads first: unhide everything captured during the lapse.
        AbandonedCheckout::withoutGlobalScope(HeldOrderCheckoutScope::class)
            ->whereIn('user_id', $owner->shopUserIds())
            ->whereNotNull('held_at')
            ->where('held_at', '>=', now()->subDays(self::WINDOW_DAYS))
            ->update(['held_at' => null]);

        $orders = $this->releasable($owner->id)->get();
        $accounting = app(AccountingService::class);

        foreach ($orders as $order) {
            $order->forceFill(['held_at' => null])->save();

            Customer::syncFromOrder($order);
            PhoneIntelCache::bump($order->customer_phone);
            $accounting->onOrderCreated($order);
            $accounting->onCourierChargeUpdated($order);
        }

        return $orders->count();
    }

    /** Deletes held orders past the window — they can no longer be released. */
    public function purgeExpired(): int
    {
        $count = 0;

        // Leads that were never converted into an order.
        AbandonedCheckout::withoutGlobalScope(HeldOrderCheckoutScope::class)
            ->whereNotNull('held_at')
            ->where('held_at', '<', now()->subDays(self::WINDOW_DAYS))
            ->forceDelete();

        Order::withoutGlobalScope(HeldOrderScope::class)
            ->whereNotNull('held_at')
            ->where('held_at', '<', now()->subDays(self::WINDOW_DAYS))
            ->each(function (Order $order) use (&$count) {
                // The abandoned checkout that converted into this order was
                // hidden alongside it (HeldOrderCheckoutScope); delete it too
                // instead of letting it resurface as a converted row with no order.
                AbandonedCheckout::withoutGlobalScope(HeldOrderCheckoutScope::class)
                    ->where('order_id', $order->id)
                    ->forceDelete();
                $order->forceDelete();
                $count++;
            });

        return $count;
    }
}
