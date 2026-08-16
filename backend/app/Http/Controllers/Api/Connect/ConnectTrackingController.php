<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Models\TrackingDestination;
use App\Services\Tracking\TrackingIngestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * WordPress plugin-facing tracking (T4, tracking_capi_context.md §7) — the
 * WooCommerce equivalent of PublicTrackingController's landing-page
 * ingest. Unlike that one, the plugin already authenticates with an API
 * key (AuthenticatePlatformApiKey), so batching is worthwhile here: the
 * plugin's own AJAX relay collects PageView+ViewContent from one page load
 * into a single call instead of two.
 *
 * Scope is always the connected site (platform_api_key), never a landing
 * page — a WooCommerce order/page has no landing_page_id.
 */
class ConnectTrackingController extends Controller
{
    public function __construct(private readonly TrackingIngestService $ingest) {}

    public function ingest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'events' => ['required', 'array', 'min:1', 'max:50'],
            'events.*.event_name' => ['required', 'string', 'max:50'],
            'events.*.event_id' => ['required', 'string', 'max:100'],
            'events.*.event_time' => ['nullable'],
            'events.*.event_source_url' => ['nullable', 'string', 'max:2000'],
            'events.*.custom_data' => ['nullable', 'array'],
            'events.*.user_data' => ['nullable', 'array'],
        ]);

        $merchant = auth()->user();
        $apiKey = $request->attributes->get('platform_api_key');

        $context = [
            'platform_api_key_id' => $apiKey?->id,
            'scope_type' => $apiKey ? 'platform_api_key' : null,
            'scope_id' => $apiKey?->id,
        ];

        // The plugin's PHP AJAX relay already stamped the real client
        // IP/UA onto each event (unlike order sync, this request's own
        // IP/UA is the WordPress server's, not the shopper's) — nothing to
        // override here, only WooCommerce's own JS payload is trusted for
        // event_name/event_id/custom_data.
        $results = $this->ingest->ingestBatch($merchant->shopOwnerId(), $data['events'], $context);

        return response()->json([
            'success' => true,
            'data' => array_map(fn (array $r) => ['status' => $r['status']], $results),
        ]);
    }

    /**
     * Cached by the plugin (~1h) so wp_head doesn't hit BSOL on every page
     * load. Resolved to a single destination for this site, same
     * never-a-list rule as the landing-page config (§11.1 #4).
     */
    public function config(Request $request): JsonResponse
    {
        $merchant = auth()->user();
        $apiKey = $request->attributes->get('platform_api_key');

        $destination = $apiKey
            ? TrackingDestination::sendableFor($merchant->shopOwnerId(), 'platform_api_key', $apiKey->id)->first()
            : null;

        return response()->json([
            'success' => true,
            'data' => [
                'enabled' => $destination !== null,
                'pixel_id' => $destination?->pixel_id,
            ],
        ]);
    }
}
