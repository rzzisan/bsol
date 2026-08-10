<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applied globally inside the `auth:sanctum` group. A staff account created
 * by its owner with a temp password (must_change_password = true) can only
 * hit /me, /user (to read its own state) and /logout until it changes its
 * password via `PUT /me` (AuthController::updateProfile — see
 * staff_team_role_context.md §3.7, which clears the flag on success).
 */
class ForcePasswordChange
{
    // Request::is() matches against the full path including the framework's
    // 'api' prefix (bootstrap/app.php withRouting(api: ...)), so these must
    // be 'api/me' not 'me' — verified against a live 403 during rollout.
    private const ALLOWED_PATHS = ['api/me', 'api/user', 'api/logout'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password && ! $request->is(...self::ALLOWED_PATHS)) {
            return response()->json([
                'message' => 'You must set a new password before continuing.',
                'error_code' => 'must_change_password',
            ], 403);
        }

        return $next($request);
    }
}
