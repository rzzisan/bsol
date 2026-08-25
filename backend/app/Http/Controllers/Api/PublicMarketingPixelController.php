<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformFacebookSetting;
use Illuminate\Http\JsonResponse;

/**
 * Unauthenticated read of BSOL's own marketing Pixel ID
 * (platform_marketing_tracking_context.md) — consumed by the homepage and
 * /verify-phone's client-side Pixel script (frontend/src/components/meta-pixel-script.tsx).
 *
 * A Pixel ID is not a secret (every page that loads Meta's base code ships
 * it in plain client-side JS) — only the CAPI access token is, and that
 * never leaves PlatformFacebookSettingsController's admin-only routes.
 * A dedicated endpoint (rather than folding this into PlatformSetting,
 * which is unrelated attribution-footer/terms content) so the frontend can
 * pick up an admin's change to the Pixel ID immediately, no rebuild needed.
 */
class PublicMarketingPixelController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => ['pixel_id' => PlatformFacebookSetting::resolvedMarketingPixelId()],
        ]);
    }
}
