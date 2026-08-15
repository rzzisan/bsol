<?php

namespace App\Jobs;

use App\Models\TrackingDestination;
use App\Models\TrackingEvent;
use App\Services\Tracking\Destinations\MetaCapiDriver;
use App\Services\Tracking\TrackingQuotaService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Fans one accepted tracking_events row out to every destination it's
 * eligible for, and records the outcome (tracking_capi_context.md §6.1,
 * §11.1 decision #1 — one row per ingest regardless of destination count).
 *
 * Destinations are re-resolved here rather than passed in from
 * TrackingIngestService — a destination disabled or deleted in the gap
 * between ingest and this job running must not still receive the event.
 *
 * Dispatched once per accepted event (real-time, not a batch sweep), so
 * MetaCapiDriver::send() is always called with exactly one event today.
 * The driver still accepts an array because a later batch-retry sweep can
 * reuse it without a signature change.
 */
class DispatchTrackingEventsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(private readonly int $trackingEventId) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(MetaCapiDriver $driver, TrackingQuotaService $quota): void
    {
        $event = TrackingEvent::find($this->trackingEventId);

        if (! $event || $event->status === TrackingEvent::STATUS_SENT) {
            // Already delivered (a previous attempt succeeded before a
            // retry could be cancelled) or the row is gone — nothing to do.
            return;
        }

        $destinations = TrackingDestination::sendableFor(
            $event->user_id,
            $this->scopeTypeFor($event),
            $this->scopeIdFor($event),
        );

        if ($destinations->isEmpty()) {
            // Not a delivery failure worth retrying — there is genuinely
            // nowhere left to send it (destination disabled/deleted after
            // ingest but before this job ran).
            $event->update([
                'status' => TrackingEvent::STATUS_FAILED,
                'error_message' => 'No sendable destination at dispatch time.',
            ]);
            $quota->recordFailed($event->user_id);

            return;
        }

        $event->increment('attempts');

        $sentTo = null;
        $errors = [];

        foreach ($destinations as $destination) {
            $result = $driver->send($destination, [$event]);

            if ($result['success']) {
                $sentTo ??= $destination;
                $destination->update(['last_sent_at' => now(), 'last_error' => null]);
            } else {
                $errors[] = "{$destination->label}: {$result['error']}";
                $destination->update(['last_error' => $result['error']]);
            }
        }

        if ($sentTo) {
            // At least one destination took it. Don't retry the others that
            // failed — re-sending the same event_id to the destination that
            // already succeeded would be wasted quota against Meta's own
            // rate limit, and Meta's 48h dedup makes a partial resend
            // pointless anyway. The failure is kept visible in error_message.
            $event->update([
                'status' => TrackingEvent::STATUS_SENT,
                'tracking_destination_id' => $sentTo->id,
                'sent_at' => now(),
                'response_code' => 200,
                'error_message' => $errors === [] ? null : implode(' | ', $errors),
            ]);
            $quota->recordSent($event->user_id);

            return;
        }

        $event->update(['error_message' => implode(' | ', $errors)]);

        // Every destination failed this attempt — worth a retry, most
        // failures here are transient (Meta rate limit, network blip).
        throw new \RuntimeException(
            "Meta CAPI dispatch failed for tracking_event {$event->id}: " . implode(' | ', $errors)
        );
    }

    /** Runs once $tries is exhausted — mark the row done, no more retries. */
    public function failed(\Throwable $exception): void
    {
        $event = TrackingEvent::find($this->trackingEventId);

        if (! $event || $event->status === TrackingEvent::STATUS_SENT) {
            return;
        }

        $event->update(['status' => TrackingEvent::STATUS_FAILED]);
        app(TrackingQuotaService::class)->recordFailed($event->user_id);
    }

    private function scopeTypeFor(TrackingEvent $event): ?string
    {
        if ($event->platform_api_key_id) {
            return 'platform_api_key';
        }

        if ($event->landing_page_id) {
            return 'landing_page';
        }

        return null;
    }

    private function scopeIdFor(TrackingEvent $event): ?int
    {
        return $event->platform_api_key_id ?? $event->landing_page_id;
    }
}
