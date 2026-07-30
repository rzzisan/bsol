<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;

/**
 * Unauthenticated read of the SaaS attribution footer + terms content —
 * consumed by every merchant's public landing page (footer) and the public
 * /terms page. No merchant-specific data here, so no scoping needed.
 */
class PublicPlatformSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => PlatformSetting::getSetting()]);
    }
}
