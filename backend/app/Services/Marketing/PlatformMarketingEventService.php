<?php

namespace App\Services\Marketing;

use App\Jobs\SendPlatformMarketingEventJob;
use App\Models\PlatformMarketingEvent;
use App\Services\Tracking\TrackingUserDataBuilder;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * The single entry point for BSOL's own acquisition-funnel events
 * (platform_marketing_tracking_context.md) — CompleteRegistration at
 * signup, Subscribe at paid activation. Deliberately not
 * TrackingIngestService: that pipeline's core unit is "seller's own
 * destination + seller's own quota", neither of which applies to the
 * platform's own single advertiser account.
 */
class PlatformMarketingEventService
{
    public function __construct(private readonly TrackingUserDataBuilder $userData) {}

    /**
     * @param  array<string, mixed>  $rawUserData  Raw values keyed by Meta field
     *                                              name (ph, em, fbp, fbc, ...) — hashed here.
     * @param  array<string, mixed>  $customData
     */
    public function track(
        string $eventName,
        string $eventId,
        array $rawUserData,
        array $customData = [],
        ?int $userId = null,
        ?string $eventSourceUrl = null,
        string $actionSource = 'website',
    ): void {
        // Checked before attempting the insert — same reasoning as
        // TrackingIngestService::ingest(): the common repeat call (a retried
        // request, not a race) never needs to reach the database's unique
        // constraint at all. On Postgres, letting a duplicate insert throw
        // also aborts whatever transaction the caller is inside; the
        // try/catch below stays only as a backstop for the genuine race.
        if (PlatformMarketingEvent::where('event_id', $eventId)->exists()) {
            return;
        }

        try {
            $row = PlatformMarketingEvent::create([
                'user_id' => $userId,
                'event_name' => $eventName,
                'event_id' => $eventId,
                'action_source' => $actionSource,
                'custom_data' => array_filter([
                    ...$customData,
                    'event_source_url' => $eventSourceUrl,
                ], fn ($v) => $v !== null),
                'user_data_hashed' => $this->userData->build($rawUserData),
                'status' => PlatformMarketingEvent::STATUS_QUEUED,
            ]);
        } catch (UniqueConstraintViolationException) {
            // Same event_id already ingested (e.g. a retried request) —
            // nothing to do, the first call already owns this conversion.
            return;
        }

        SendPlatformMarketingEventJob::dispatch($row->id);
    }
}
