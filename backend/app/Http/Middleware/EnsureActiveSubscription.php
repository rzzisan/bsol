<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveSubscription
{
    /**
     * Allow read-only access regardless of subscription state so merchants can
     * always see their data and pay for/renew their plan. Only block actions
     * that create or change data once the subscription has actually expired.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('GET') || $request->isMethod('HEAD')) {
            return $next($request);
        }

        $user = $request->user();

        if ($user && $user->isSubscriptionExpired()) {
            return response()->json([
                'success' => false,
                'message' => 'Your subscription has expired. Please renew your plan to continue.',
                'error_code' => 'subscription_expired',
            ], 402);
        }

        return $next($request);
    }
}
