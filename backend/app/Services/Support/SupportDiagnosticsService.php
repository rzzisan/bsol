<?php

namespace App\Services\Support;

use App\Models\AbandonedCheckout;
use App\Models\Order;
use App\Models\PlatformApiKey;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\SmsCredit;
use App\Models\SmsGateway;
use App\Models\SmsHistory;
use App\Models\User;

/**
 * Live checks the AI support agent's diagnostic tools run against a seller's
 * actual account state — support_ticketing_ai_context.md §"instant problem
 * diagnosis". Every method returns plain facts (never a verdict/prose) —
 * the model decides what they mean and explains it, including explicitly
 * saying "no problem found" when every check comes back clean, per the
 * system prompt's instruction not to invent a cause when there isn't one.
 */
class SupportDiagnosticsService
{
    /** "Why aren't new orders coming in?" — storefront reachability, catalog visibility, recent activity. */
    public function diagnoseNoNewOrders(User $user): array
    {
        $shopUserIds = $user->shopUserIds();
        $shop = ShopProfile::where('user_id', $user->id)->first();

        $visibleProductCount = Product::whereIn('user_id', $shopUserIds)
            ->where('status', 'active')
            ->where('show_in_storefront', true)
            ->count();

        $lastOrder = Order::whereIn('user_id', $shopUserIds)->latest('created_at')->first(['created_at']);

        $recentAbandonedCheckouts = AbandonedCheckout::where('user_id', $user->id)
            ->where('created_at', '>=', now()->subDays(7))
            ->count();

        return [
            'storefront_subdomain_configured' => (bool) $shop?->subdomain,
            'storefront_subdomain_status' => $shop?->subdomain_status ?? 'none', // 'active' = storefront URL actually resolves
            'active_products_visible_in_storefront' => $visibleProductCount, // 0 = customers have nothing orderable
            'last_order_at' => $lastOrder?->created_at,
            'days_since_last_order' => $lastOrder ? (int) abs(now()->diffInDays($lastOrder->created_at)) : null,
            'abandoned_checkouts_last_7_days' => $recentAbandonedCheckouts, // >0 = real traffic is reaching checkout but not completing (different cause than zero traffic)
            'subscription_status' => $user->subscription_status,
            'subscription_expired' => $user->isSubscriptionExpired(),
            // >0 = customers ARE ordering but the orders are hidden until the seller renews (HeldOrderService) — the real answer to "no new orders".
            'held_orders_waiting_for_renewal' => app(\App\Services\HeldOrderService::class)->heldCount($user->shopOwnerId()),
        ];
    }

    /** "Why isn't SMS sending?" — platform gateway availability, seller's own credit, recent failures. */
    public function diagnoseSmsNotSending(User $user): array
    {
        $gatewayReady = SmsGateway::where('is_active', true)->where('is_enabled', true)->exists();
        $credit = SmsCredit::where('user_id', $user->id)->first();

        $recentFailures = SmsHistory::where('user_id', $user->id)
            ->where('status', '!=', 'sent')
            ->latest('created_at')
            ->limit(5)
            ->get(['phone_number', 'status', 'error_message', 'created_at'])
            ->map(fn (SmsHistory $h) => [
                'status' => $h->status,
                'error_message' => $h->error_message,
                'created_at' => $h->created_at,
            ]);

        return [
            // false here is a platform-wide outage, not something the seller can fix themselves — must escalate, not troubleshoot with them.
            'platform_sms_gateway_active' => $gatewayReady,
            'sms_credit_balance' => $credit?->balance ?? 0,
            'auto_recharge_enabled' => $credit?->auto_recharge_enabled ?? false,
            'recent_failed_sends' => $recentFailures,
        ];
    }

    /** "Why isn't the WordPress plugin connecting?" — the seller's own platform API key lifecycle. */
    public function diagnoseWordpressNotConnecting(User $user): array
    {
        $key = PlatformApiKey::where('user_id', $user->id)->where('platform', 'woocommerce')->latest('created_at')->first();

        if ($key === null) {
            return [
                'api_key_generated' => false,
                'note' => 'The seller has never generated a WordPress/WooCommerce connection key — they need to do that first in Settings before installing/activating the plugin can work.',
            ];
        }

        return [
            'api_key_generated' => true,
            'status' => $key->status, // pending = generated but the plugin has never successfully checked in; connected = has worked at least once; revoked = must generate a new key
            'domain_on_file' => $key->domain,
            'last_used_at' => $key->last_used_at,
            'days_since_last_used' => $key->last_used_at ? (int) abs(now()->diffInDays($key->last_used_at)) : null,
            'revoked_at' => $key->revoked_at,
        ];
    }
}
