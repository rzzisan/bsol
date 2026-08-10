<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route middleware: `staff_permission:{module_key}`. Owner/admin accounts
 * always pass. Staff sub-accounts need an explicit enabled grant in
 * staff_permissions for that module — default-deny. See
 * staff_team_role_context.md §3.4.
 */
class EnsureStaffPermission
{
    public function handle(Request $request, Closure $next, string $moduleKey): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($user->isStaff() && $user->staff_status !== 'active') {
            return response()->json([
                'message' => 'This staff account has been suspended.',
                'error_code' => 'staff_suspended',
            ], 403);
        }

        if (! $user->hasStaffPermission($moduleKey)) {
            return response()->json([
                'message' => 'You do not have permission to access this module.',
                'error_code' => 'staff_permission_denied',
                'module' => $moduleKey,
            ], 403);
        }

        return $next($request);
    }
}
