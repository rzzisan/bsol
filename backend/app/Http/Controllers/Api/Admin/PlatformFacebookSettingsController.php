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
            'app_secret' => ['nullable', 'string', 'max:255'],
            'webhook_verify_token' => ['nullable', 'string', 'max:255'],
        ]);

        $setting = PlatformFacebookSetting::getSetting();

        // Blank app_secret/webhook_verify_token in the request means "leave
        // unchanged" (the frontend never receives the real value back to
        // re-submit) — only overwrite when a new value was actually typed.
        $updates = ['app_id' => $data['app_id'] ?? null];
        if (filled($data['app_secret'] ?? null)) {
            $updates['app_secret'] = $data['app_secret'];
        }
        if (filled($data['webhook_verify_token'] ?? null)) {
            $updates['webhook_verify_token'] = $data['webhook_verify_token'];
        }

        $setting->update($updates);

        return response()->json(['success' => true, 'data' => $setting->fresh()->masked()]);
    }
}
