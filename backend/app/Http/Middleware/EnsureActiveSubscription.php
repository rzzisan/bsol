<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveSubscription
{
    /**
     * Allow read-only access regardless of subscription state so merchants can
     * always see their data and pay for/renew their plan. Only block actions
     * that create or change data once the subscription has actually expired.
     *
     * Staff sub-accounts have no subscription of their own — the check
     * resolves to the shop owner's subscription instead (see
     * staff_team_role_context.md §3.5).
     */
    public function handle(Request $request, Closure $next): Response
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
            return response()->json([
                'success' => false,
                'message' => 'Your subscription has expired. Please renew your plan to continue.',
                'error_code' => 'subscription_expired',
            ], 402);
        }

        return $next($request);
    }
}
