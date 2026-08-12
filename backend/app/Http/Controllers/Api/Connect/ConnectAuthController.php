<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Models\ShopProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Plugin-facing connect handshake — /api/connect/v1/connect. Authenticated by
 * AuthenticatePlatformApiKey (domain-bound API key), see
 * bsol_history_and_new_context.md §5. No writes beyond what the middleware
 * already did (markUsed()) — this just confirms the connection and returns
 * basic account status for the plugin to display.
 */
class ConnectAuthController extends Controller
{
    public function connect(Request $request): JsonResponse
    {
        $apiKey = $request->attributes->get('platform_api_key');
        $merchant = auth()->user();

        $shopProfile = ShopProfile::where('user_id', $merchant->shopOwnerId())->first();

        return response()->json([
            'success' => true,
            'message' => 'Connected successfully.',
            'data' => [
                'domain' => $apiKey->domain,
                'platform' => $apiKey->platform,
                'shop_name' => $shopProfile?->shop_name,
                'subscription_active' => ! $merchant->isSubscriptionExpired(),
            ],
        ]);
    }

    /**
     * Self-revoke via the same key that authenticated the request — safe
     * because possessing a valid, non-revoked, domain-matched key is already
     * the full authorization bar for every other /connect/v1/* action.
     * Distinct from the dashboard's Sanctum-authed
     * WordpressApiKeyController::destroy() (same revoke semantics, different
     * trust boundary). See bsol_history_and_new_context.md §5.
     */
    public function disconnect(Request $request): JsonResponse
    {
        $apiKey = $request->attributes->get('platform_api_key');
        $apiKey->update(['status' => 'revoked', 'revoked_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Disconnected successfully.',
        ]);
    }
}
