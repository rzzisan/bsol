<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route middleware: hard-blocks staff sub-accounts, unconditionally — no
 * permission toggle can override this. Used on billing/subscription,
 * staff-management, and shop-settings routes to prevent privilege
 * escalation. See staff_team_role_context.md §3.4.
 */
class EnsureShopOwner
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->isStaff()) {
            return response()->json([
                'message' => 'This action is restricted to the shop owner account.',
                'error_code' => 'owner_only',
            ], 403);
        }

        return $next($request);
    }
}
