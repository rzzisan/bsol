<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\LandingPageResolver;
use App\Services\Tracking\TrackingIngestService;
use App\Services\Tracking\TrackingUserDataBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ingest endpoint for a seller's own landing page — the browser posts here
 * directly, same-origin, no API key (tracking_capi_context.md §8.8).
 *
 * The seller is resolved from the request Host, never from anything the
 * client sends (§8.0) — a client-supplied user/destination id would let one
 * seller spend another's quota or push fake events into their pixel. The
 * `slug` in the body only narrows *which page* within that seller's shop;
 * it can never widen who the event is charged to.
 */
class PublicTrackingController extends Controller
{
    public function __construct(
        private readonly TrackingIngestService $ingest,
        private readonly TrackingUserDataBuilder $userData,
    ) {}

    public function ingest(Request $request): JsonResponse
    {
        $label = LandingPageResolver::subdomainLabel($request->getHost());
        $ownerId = $label ? LandingPageResolver::shopOwnerIdForLabel($label) : null;

        // No real shop on this host — accept-and-drop rather than 404/422.
        // This is a public, unauthenticated endpoint; a distinguishable
        // error response here would just be a free host-enumeration oracle
        // for no benefit to a legitimate caller (the browser doesn't care).
        if ($ownerId === null) {
            return response()->json(['success' => true]);
        }

        $data = $request->validate([
            'slug' => ['nullable', 'string', 'max:190'],
            'event_name' => ['required', 'string', 'max:50'],
            'event_id' => ['required', 'string', 'max:100'],
            'event_time' => ['nullable'],
            'event_source_url' => ['nullable', 'string', 'max:2000'],
            'custom_data' => ['nullable', 'array'],
            'user_data' => ['nullable', 'array'],
        ]);

        $context = ['scope_type' => null, 'scope_id' => null];
        if (! empty($data['slug'])) {
            $page = LandingPageResolver::query($data['slug'], $request)
                ->where('status', 'published')
                ->first();

            if ($page) {
                $context['landing_page_id'] = $page->id;
                $context['scope_type'] = 'landing_page';
                $context['scope_id'] = $page->id;
            }
        }

        $userData = $data['user_data'] ?? [];

        // The real client IP/UA — this request came straight from the
        // shopper's browser (same-origin on the seller's own subdomain), so
        // unlike the WooCommerce relay path (§3.3's Phase-10 warning) these
        // are trustworthy at the source. Server-set, never client-supplied.
        $userData['client_ip_address'] = $request->ip();
        $userData['client_user_agent'] = $request->userAgent();

        // A visitor can land with fbclid before Meta's own script has had a
        // chance to write the _fbc cookie — on that very first event the
        // browser has nothing to send yet, so synthesize it here the same
        // way the browser's own copy of _fbc would eventually look.
        if (empty($userData['fbc']) && ! empty($userData['fbclid'])) {
            $userData['fbc'] = $this->userData->fbcFromClickId((string) $userData['fbclid']);
        }
        unset($userData['fbclid']);

        $event = [
            'event_name' => $data['event_name'],
            'event_id' => $data['event_id'],
            'event_time' => $data['event_time'] ?? null,
            'action_source' => 'website',
            'event_source_url' => $data['event_source_url'] ?? null,
            'custom_data' => $data['custom_data'] ?? null,
            'user_data' => $userData,
        ];

        $result = $this->ingest->ingest($ownerId, $event, $context);

        return response()->json(['success' => true, 'status' => $result['status']]);
    }
}
