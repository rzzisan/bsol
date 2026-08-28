<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformFacebookSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super-admin control over the single, platform-wide Meta App credentials
 * used by every seller's per-Page Facebook connect flow (§16.3). One BSOL
 * app, not per-seller — see SAAS_MODULE_CONTEXT.md §15.11.
 */
class PlatformFacebookSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => PlatformFacebookSetting::getSetting()->masked()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'app_id' => ['nullable', 'string', 'max:100'],
            'login_config_id' => ['nullable', 'string', 'max:100'],
            'app_secret' => ['nullable', 'string', 'max:255'],
            'webhook_verify_token' => ['nullable', 'string', 'max:255'],
            'marketing_pixel_id' => ['nullable', 'string', 'max:100'],
            'marketing_capi_access_token' => ['nullable', 'string', 'max:1000'],
            'marketing_test_event_code' => ['nullable', 'string', 'max:100'],
        ]);

        $setting = PlatformFacebookSetting::getSetting();

        // Blank app_secret/webhook_verify_token/marketing_capi_access_token in
        // the request means "leave unchanged" (the frontend never receives the
        // real value back to re-submit) — only overwrite when a new value was
        // actually typed.
        $updates = [
            'app_id' => $data['app_id'] ?? null,
            'login_config_id' => $data['login_config_id'] ?? null,
            'marketing_pixel_id' => $data['marketing_pixel_id'] ?? null,
            'marketing_test_event_code' => $data['marketing_test_event_code'] ?? null,
        ];
        if (filled($data['app_secret'] ?? null)) {
            $updates['app_secret'] = $data['app_secret'];
        }
        if (filled($data['webhook_verify_token'] ?? null)) {
            $updates['webhook_verify_token'] = $data['webhook_verify_token'];
        }
        if (filled($data['marketing_capi_access_token'] ?? null)) {
            $updates['marketing_capi_access_token'] = $data['marketing_capi_access_token'];
        }

        $setting->update($updates);

        return response()->json(['success' => true, 'data' => $setting->fresh()->masked()]);
    }

    /**
     * Toggling App Review status is deliberately its own endpoint, not a
     * field on the main credentials form — that form's blank-means-
     * unchanged handling above only applies to secrets; a plain boolean
     * folded into the same submit would get silently reset to false by
     * any save that didn't happen to carry it. See
     * pre_launch_polish_context.md §ঞ / facebook_integration_context.md §10.
     */
    public function updateAppReviewStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'app_review_approved' => ['required', 'boolean'],
        ]);

        $setting = PlatformFacebookSetting::getSetting();
        $setting->update(['app_review_approved' => $data['app_review_approved']]);

        return response()->json(['success' => true, 'data' => $setting->fresh()->masked()]);
    }
}
