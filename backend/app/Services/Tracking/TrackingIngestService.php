<?php

namespace App\Services\Tracking;

use App\Models\TrackingDestination;
use App\Models\TrackingEvent;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;

/**
 * The single entry point for every tracking event, wherever it came from —
 * the WooCommerce plugin, a BSOL landing page, or BSOL's own order-status
 * transitions (tracking_capi_context.md §6.1).
 *
 * Everything funnels through here so the order of operations is decided
 * once: no destination configured means nothing is charged or stored, a
 * duplicate never costs quota, and a dropped event never becomes a row.
 * Spread across three call sites those rules would drift apart.
 *
 * The caller always supplies the shop owner id, resolved from the request
 * Host — never from anything the client sent. A client-supplied user or
 * destination id would let one seller spend another's quota or push events
 * into their pixel (§8.0).
 */
class TrackingIngestService
{
    public const ACCEPTED = 'accepted';

    public const DUPLICATE = 'duplicate';

    public const DROPPED = 'dropped';

    public const NO_DESTINATION = 'no_destination';

    public const INVALID = 'invalid';

    public function __construct(
        private readonly TrackingQuotaService $quota,
        private readonly TrackingUserDataBuilder $userData,
    ) {}

    /**
     * @param  array<string, mixed>  $event    event_name, event_id, and optionally
     *                                         event_time, action_source, event_source_url,
     *                                         custom_data, user_data (raw — hashed here).
     * @param  array<string, mixed>  $context  platform_api_key_id, landing_page_id, order_id,
     *                                         scope_type, scope_id.
     * @return array{status: string, event: ?TrackingEvent, priority: ?string, reason: ?string}
     */
    public function ingest(int $ownerId, array $event, array $context = []): array
    {
        $name = trim((string) ($event['event_name'] ?? ''));
        $eventId = trim((string) ($event['event_id'] ?? ''));

        if ($name === '' || $eventId === '') {
            return $this->result(self::INVALID, reason: 'event_name and event_id are required.');
        }

        // Nothing to send to: charging quota here would let a seller who has
        // never configured a pixel burn their whole daily allowance on
        // events that could not go anywhere.
        $destinations = TrackingDestination::sendableFor(
            $ownerId,
            $context['scope_type'] ?? null,
            isset($context['scope_id']) ? (int) $context['scope_id'] : null,
        );

        if ($destinations->isEmpty()) {
            return $this->result(self::NO_DESTINATION, reason: 'No enabled tracking destination for this shop.');
        }

        // Checked before the quota decision so a repeat never costs a second
        // slot (§5.3). The unique index below is still the real guarantee —
        // this only keeps the common case from spending quota it would then
        // have to refund.
        if ($this->alreadyIngested($ownerId, $name, $eventId)) {
            return $this->result(self::DUPLICATE, reason: 'This event was already ingested.');
        }

        $decision = $this->quota->admit($ownerId, $name);

        if (! $decision['admitted']) {
            return $this->result(self::DROPPED, priority: $decision['priority'], reason: $decision['reason']);
        }

        try {
            $row = TrackingEvent::create([
                'user_id' => $ownerId,
                'platform_api_key_id' => $context['platform_api_key_id'] ?? null,
                'landing_page_id' => $context['landing_page_id'] ?? null,
                'order_id' => $context['order_id'] ?? null,
                'event_name' => $name,
                'event_id' => $eventId,
                'event_time' => $this->eventTime($event['event_time'] ?? null),
                'action_source' => $event['action_source'] ?? 'website',
                'event_source_url' => $event['event_source_url'] ?? null,
                'custom_data' => $event['custom_data'] ?? null,
                'user_data_hashed' => $this->userData->build($event['user_data'] ?? []),
                'status' => TrackingEvent::STATUS_QUEUED,
            ]);
        } catch (UniqueConstraintViolationException) {
            // Two requests raced past the pre-check. Hand the slot back —
            // the first one already paid for this event.
            $this->quota->refund($ownerId, $decision['overage']);

            return $this->result(self::DUPLICATE, reason: 'This event was already ingested.');
        }

        // T2 dispatches DispatchTrackingEventsJob here, fanning $row out to
        // every destination resolved above.

        return $this->result(self::ACCEPTED, event: $row, priority: $decision['priority']);
    }

    /**
     * Ingest a batch from one relay call, keeping per-event outcomes so a
     * single bad event does not fail the other 49.
     *
     * @param  array<int, array<string, mixed>>  $events
     * @param  array<string, mixed>  $context
     * @return array<int, array{status: string, event: ?TrackingEvent, priority: ?string, reason: ?string}>
     */
    public function ingestBatch(int $ownerId, array $events, array $context = []): array
    {
        return array_map(fn (array $event) => $this->ingest($ownerId, $event, $context), array_values($events));
    }

    private function alreadyIngested(int $ownerId, string $name, string $eventId): bool
    {
        return TrackingEvent::where('user_id', $ownerId)
            ->where('event_name', $name)
            ->where('event_id', $eventId)
            ->exists();
    }

    /**
     * Browsers send a unix timestamp; internal callers pass a Carbon or
     * nothing. An unparseable value falls back to now rather than failing —
     * a slightly-wrong event time is worth more than a lost conversion.
     */
    private function eventTime(mixed $value): Carbon
    {
        if ($value instanceof Carbon) {
            return $value;
        }

        if (is_numeric($value)) {
            return Carbon::createFromTimestamp((int) $value);
        }

        if (is_string($value) && $value !== '') {
            try {
                return Carbon::parse($value);
            } catch (\Throwable) {
                return Carbon::now();
            }
        }

        return Carbon::now();
    }

    /** @return array{status: string, event: ?TrackingEvent, priority: ?string, reason: ?string} */
    private function result(string $status, ?TrackingEvent $event = null, ?string $priority = null, ?string $reason = null): array
    {
        return ['status' => $status, 'event' => $event, 'priority' => $priority, 'reason' => $reason];
    }
}
