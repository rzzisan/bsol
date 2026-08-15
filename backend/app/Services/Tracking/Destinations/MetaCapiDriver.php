<?php

namespace App\Services\Tracking\Destinations;

use App\Models\PlatformFacebookSetting;
use App\Models\TrackingDestination;
use App\Models\TrackingEvent;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sends accepted tracking events to Meta's Conversions API
 * (tracking_capi_context.md §6.1). One driver per provider —
 * tracking_destinations.provider picks which one runs; only 'meta' exists
 * this round (§3.4), so a future TikTok/GA4 destination is a new class here,
 * not a schema change.
 *
 * Meta's endpoint accepts up to 1000 events per POST; §5.3 already caps an
 * ingest batch at 50, so a single call here never needs to chunk further.
 * The response carries no per-event status — just a total count and a
 * fbtrace_id for support — so a batch is accepted or rejected as a whole;
 * DispatchTrackingEventsJob marks every event in it the same way.
 */
class MetaCapiDriver
{
    /**
     * @param  TrackingEvent[]  $events  Never empty — callers batch what they have.
     * @return array{success: bool, status_code: ?int, error: ?string}
     */
    public function send(TrackingDestination $destination, array $events): array
    {
        $version = PlatformFacebookSetting::resolvedGraphVersion();

        $payload = [
            'data' => array_map($this->eventPayload(...), $events),
            'access_token' => $destination->access_token,
        ];

        if ($destination->test_event_code) {
            $payload['test_event_code'] = $destination->test_event_code;
        }

        try {
            $response = Http::asJson()
                ->timeout(15)
                ->post("https://graph.facebook.com/{$version}/{$destination->pixel_id}/events", $payload);
        } catch (\Throwable $e) {
            Log::warning('Meta CAPI request failed', [
                'destination_id' => $destination->id,
                'error' => $e->getMessage(),
            ]);

            return ['success' => false, 'status_code' => null, 'error' => $e->getMessage()];
        }

        if (! $response->successful()) {
            $error = $response->json('error.message') ?? ('HTTP ' . $response->status());

            Log::warning('Meta CAPI event(s) rejected', [
                'destination_id' => $destination->id,
                'status' => $response->status(),
                'body' => $response->json(),
            ]);

            return ['success' => false, 'status_code' => $response->status(), 'error' => $error];
        }

        return ['success' => true, 'status_code' => $response->status(), 'error' => null];
    }

    /**
     * One tracking_events row → one Meta event object. user_data_hashed is
     * used as-is — TrackingUserDataBuilder already produced it at ingest
     * time, and this is the only place that reads it back out.
     *
     * @return array<string, mixed>
     */
    public function eventPayload(TrackingEvent $event): array
    {
        return array_filter([
            'event_name' => $event->event_name,
            'event_time' => $event->event_time->timestamp,
            'event_id' => $event->event_id,
            'action_source' => $event->action_source,
            'event_source_url' => $event->event_source_url,
            'user_data' => $event->user_data_hashed ?: null,
            'custom_data' => $event->custom_data ?: null,
        ], fn ($value) => $value !== null);
    }
}
