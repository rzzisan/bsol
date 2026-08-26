<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Marketing\PlatformMarketingEventService;
use App\Services\Tracking\TrackingUserDataBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Same-origin relay for BSOL's own homepage engagement events
 * (platform_marketing_tracking_context.md) — mirrors
 * PublicTrackingController's exact reasoning for a seller's landing page:
 * a browser calling connect.facebook.net/fbevents.js directly is one of the
 * most commonly ad-blocked requests on the web (verified empirically —
 * general internet and even graph.facebook.com reachable, that one domain
 * specifically failing). A same-origin POST to our own domain is not a
 * recognizable tracking endpoint, so it goes through even when the
 * client-side Pixel script itself is blocked; this controller relays it to
 * Meta server-side via the already-existing PlatformMarketingEventService.
 *
 * No Host-based owner resolution needed (unlike PublicTrackingController) —
 * there is exactly one advertiser here, the platform itself.
 */
class PublicMarketingTrackController extends Controller
{
    /** Only engagement signals — CompleteRegistration/Subscribe are never
     *  client-triggerable, they only ever come from OtpController/
     *  SubscriptionActivationService with a real user/payment behind them. */
    private const ALLOWED_EVENTS = ['PageView', 'ViewContent', 'ScrollDepth', 'Lead'];

    public function __construct(
        private readonly PlatformMarketingEventService $marketing,
        private readonly TrackingUserDataBuilder $userData,
    ) {}

    public function ingest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event_name' => ['required', 'string', Rule::in(self::ALLOWED_EVENTS)],
            'event_id' => ['required', 'string', 'max:100'],
            'event_source_url' => ['nullable', 'string', 'max:2000'],
            'custom_data' => ['nullable', 'array'],
            'user_data' => ['nullable', 'array'],
        ]);

        $userData = $data['user_data'] ?? [];

        // Trustworthy at the source — this request came straight from the
        // visitor's browser, same-origin, never from a client-supplied value.
        $userData['client_ip_address'] = $request->ip();
        $userData['client_user_agent'] = $request->userAgent();

        if (empty($userData['fbc']) && ! empty($userData['fbclid'])) {
            $userData['fbc'] = $this->userData->fbcFromClickId((string) $userData['fbclid']);
        }
        unset($userData['fbclid']);

        $this->marketing->track(
            eventName: $data['event_name'],
            eventId: $data['event_id'],
            rawUserData: $userData,
            customData: $data['custom_data'] ?? [],
            eventSourceUrl: $data['event_source_url'] ?? null,
        );

        return response()->json(['success' => true]);
    }
}
