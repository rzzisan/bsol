<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveSubscription
{
    /**
     * Order status values that just record something that already happened
     * in the real world (courier delivered / returned the parcel, or the
     * seller cancelled) rather than progressing normal order processing.
     * Used only by the 'allow_delivery_confirmation' mode below —
     * security_hardening_context.md, pre_launch_polish_context.md §ছ.
     */
    private const ACCOUNTING_CONFIRMING_STATUSES = ['delivered', 'returned', 'cancelled'];

    /**
     * Allow read-only access regardless of subscription state so merchants can
     * always see their data and pay for/renew their plan. Only block actions
     * that create or change data once the subscription has actually expired.
     *
     * Staff sub-accounts have no subscription of their own — the check
     * resolves to the shop owner's subscription instead (see
     * staff_team_role_context.md §3.5).
     *
     * $mode: pass 'allow_delivery_confirmation' (via
     * `active_subscription:allow_delivery_confirmation` on a route) to also
     * let through order-status requests whose target status is one of
     * ACCOUNTING_CONFIRMING_STATUSES — the courier already collected real
     * cash (or returned the parcel) regardless of subscription state, and
     * blocking that confirmation doesn't drive renewal, it just leaves the
     * seller's own accounting wrong forever. Only the two order-status
     * routes use this mode; everything else order-related (create/edit/
     * pending→confirmed/etc.) still hard-blocks as before.
     */
    public function handle(Request $request, Closure $next, ?string $mode = null): Response
    {
        if ($request->isMethod('GET') || $request->isMethod('HEAD')) {
            return $next($request);
        }

        $user = $request->user();
        $subscriptionOwner = $user;

        if ($user && $user->isStaff()) {
            $subscriptionOwner = User::find($user->shopOwnerId());
        }

        if ($subscriptionOwner && $subscriptionOwner->isSubscriptionExpired()) {
            if ($mode === 'allow_delivery_confirmation' && $this->isAccountingConfirmingStatusChange($request)) {
                return $next($request);
            }

            return response()->json([
                'success' => false,
                'message' => 'Your subscription has expired. Please renew your plan to continue.',
                'error_code' => 'subscription_expired',
            ], 402);
        }

        return $next($request);
    }

    private function isAccountingConfirmingStatusChange(Request $request): bool
    {
        return in_array($request->input('status'), self::ACCOUNTING_CONFIRMING_STATUSES, true);
    }
}
