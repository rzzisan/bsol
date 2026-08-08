<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FacebookPixelSetting;
use App\Services\Facebook\FacebookCapiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Per-seller Conversions API (CAPI) config — §6 item 4 in
 * facebook_integration_context.md. Unlike Facebook Page connect, this
 * needs no Meta OAuth/App Review: the seller pastes their own Pixel ID +
 * CAPI access token straight from their Events Manager.
 */
class FacebookPixelSettingController extends Controller
{
    public function show(): JsonResponse
    {
        $settings = FacebookPixelSetting::where('user_id', auth()->id())->first();

        return response()->json([
            'success' => true,
            'data' => $settings?->masked() ?? [
                'pixel_id' => null,
                'access_token_set' => false,
                'test_event_code' => null,
                'enabled' => false,
                'last_sent_at' => null,
                'last_error' => null,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'pixel_id' => ['nullable', 'string', 'max:50'],
            'access_token' => ['nullable', 'string'],
            'test_event_code' => ['nullable', 'string', 'max:50'],
            'enabled' => ['nullable', 'boolean'],
        ]);

        $settings = FacebookPixelSetting::firstOrNew(['user_id' => auth()->id()]);
        $settings->user_id = auth()->id();

        if ($request->has('pixel_id')) {
            $settings->pixel_id = $data['pixel_id'] ?: null;
        }
        // Blank access_token field = "leave unchanged" — the real token
        // never round-trips to the frontend, same pattern as
        // PlatformFacebookSettingsController::update().
        if (! empty($data['access_token'])) {
            $settings->access_token = $data['access_token'];
        }
        if ($request->has('test_event_code')) {
            $settings->test_event_code = $data['test_event_code'] ?: null;
        }
        if ($request->has('enabled')) {
            $settings->enabled = (bool) $data['enabled'];
        }

        $settings->save();

        return response()->json(['success' => true, 'data' => $settings->masked()]);
    }

    public function testEvent(FacebookCapiClient $capi): JsonResponse
    {
        $settings = FacebookPixelSetting::where('user_id', auth()->id())->first();

        if (! $settings?->pixel_id || ! $settings?->access_token) {
            return response()->json(['success' => false, 'message' => 'Set the Pixel ID and Access Token first.'], 422);
        }

        $ok = $capi->sendEvent($settings->pixel_id, $settings->access_token, [
            'event_name' => 'Purchase',
            'event_time' => now()->timestamp,
            'event_id' => 'test_' . Str::random(8),
            'action_source' => 'website',
            'event_source_url' => rtrim((string) config('app.frontend_url'), '/'),
            'user_data' => ['ph' => [hash('sha256', '8801700000000')]],
            'custom_data' => ['currency' => 'BDT', 'value' => 100],
        ], $settings->test_event_code ?: null);

        $settings->update([
            'last_sent_at' => now(),
            'last_error' => $ok ? null : 'Test event was rejected — check the Pixel ID / Access Token.',
        ]);

        return response()->json([
            'success' => $ok,
            'message' => $ok
                ? 'Test event sent — check Events Manager → Test Events.'
                : 'Facebook rejected the test event. Check the Pixel ID / Access Token.',
        ]);
    }
}
