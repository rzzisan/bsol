<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Lets an admin view the dashboard as a seller for support
 * (custom_domain_context.md §11.5). is_admin-gated by the route group.
 *
 * Why this exists rather than "admin logs in on the seller's subdomain":
 * a seller's subdomain also serves their own landing-page HTML, so an admin
 * session on that origin is the one remaining way an auth token could be
 * stolen (§9 rule 3). Impersonation keeps the admin on the platform origin,
 * where no seller-authored markup runs, while showing exactly the same
 * dashboard the seller sees.
 */
class ImpersonationController extends Controller
{
    /** Short enough that a forgotten tab stops working on its own. */
    private const TTL_MINUTES = 60;

    public function start(Request $request, int $userId): JsonResponse
    {
        $admin = $request->user();
        $target = User::find($userId);

        if (! $target) {
            return response()->json(['success' => false, 'message' => 'User not found.'], 404);
        }

        // No lateral moves between admins: impersonation is a support tool
        // for looking at seller accounts, not a way to borrow another
        // administrator's authority.
        if ($target->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Administrator accounts cannot be impersonated.',
                'error_code' => 'target_is_admin',
            ], 403);
        }

        // Named and expiring so the trail survives in personal_access_tokens
        // even after the session ends.
        $token = $target->createToken(
            "impersonation:admin-{$admin->id}",
            ['*'],
            now()->addMinutes(self::TTL_MINUTES),
        )->plainTextToken;

        Log::warning('Admin impersonation started', [
            'admin_id' => $admin->id,
            'admin_email' => $admin->email,
            'target_id' => $target->id,
            'target_email' => $target->email,
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $token,
                'expires_in_minutes' => self::TTL_MINUTES,
                'user' => [
                    'id' => $target->id,
                    'name' => $target->name,
                    'email' => $target->email,
                ],
            ],
        ]);
    }
}
