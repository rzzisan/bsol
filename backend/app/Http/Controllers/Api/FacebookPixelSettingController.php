<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TrackingDestination;
use App\Services\Facebook\FacebookCapiClient;
use Illuminate\Http\JsonResponse;
use App\Support\FrontendUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Per-seller Meta Pixel/CAPI config — §6 item 4 in
 * facebook_integration_context.md. Unlike Facebook Page connect, this
 * needs no Meta OAuth/App Review: the seller pastes their own Pixel ID +
 * CAPI access token straight from their Events Manager.
 *
 * Reads/writes the shop-wide TrackingDestination row (scope_type IS NULL)
 * — the *only* dashboard surface that can create/edit one, since T3
 * (multi-destination CRUD) hasn't shipped yet. This used to read/write
 * facebook_pixel_settings directly; T1's backfill only ran once at
 * migration time, so anything saved through here after that stayed
 * invisible to tracking_destinations, which is what T2/T5/T6/T4 actually
 * read — silently breaking tracking for every seller who touched this
 * page (or set it up for the first time) after T1. Discovered while
 * building T4 and fixed in the same pass, since T4 is worthless while its
 * only real-world destination source can't populate the table it reads.
 * facebook_pixel_settings itself is untouched (still there for rollback,
 * per T1's note) — just nothing writes to it anymore.
 */
class FacebookPixelSettingController extends Controller
{
    public function show(): JsonResponse
    {
        $settings = $this->shopWideDestination();

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

        $settings = $this->shopWideDestination() ?? new TrackingDestination([
            'user_id' => auth()->id(),
            'provider' => 'meta',
            'label' => 'Default',
        ]);

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
        $settings = $this->shopWideDestination();

        if (! $settings?->pixel_id || ! $settings?->access_token) {
            return response()->json(['success' => false, 'message' => 'Set the Pixel ID and Access Token first.'], 422);
        }

        // A one-off ad-hoc payload, not a real tracking_events row — the
        // provider-agnostic client is the right tool here, not
        // MetaCapiDriver (which reads its payload from a persisted
        // TrackingEvent) or the full ingest pipeline (which would spend a
        // quota slot on what is explicitly a connectivity check, not a
        // real visitor event).
        $ok = $capi->sendEvent($settings->pixel_id, $settings->access_token, [
            'event_name' => 'Purchase',
            'event_time' => now()->timestamp,
            'event_id' => 'test_' . Str::random(8),
            'action_source' => 'website',
            'event_source_url' => FrontendUrl::forUser(auth()->user()),
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

    private function shopWideDestination(): ?TrackingDestination
    {
        return TrackingDestination::where('user_id', auth()->id())
            ->where('provider', 'meta')
            ->whereNull('scope_type')
            ->first();
    }
}
