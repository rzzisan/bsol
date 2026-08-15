<?php

namespace App\Services\Tracking;

use App\Models\TrackingUsageDaily;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Decides whether a tracking event is admitted against the seller's package
 * limit, and records what happened (tracking_capi_context.md §5).
 *
 * The design point worth keeping: not all events are equal. A flat
 * "limit reached, stop everything" would throw away exactly the events the
 * whole product is built on — Purchase and OrderDelivered are the signal
 * that teaches Meta who actually pays (§1) — and would leave a seller's ad
 * tracking blind on their busiest days. So P0 always goes through, and the
 * cheap ambient traffic is sampled and then shed first.
 *
 * Redis is the hot counter behind the admission decision;
 * tracking_usage_daily is the durable record. Both are written on every
 * event: at the largest package (15k/day, well under one event per second)
 * the second write costs nothing measurable, and batching it would buy
 * nothing while introducing a way to lose counts.
 */
class TrackingQuotaService
{
    /** Never dropped. Order outcome and lead signal — the reason this product exists. */
    public const P0 = 'P0';

    /** Funnel. Sampled at 80% of quota, shed at 100%. */
    public const P1 = 'P1';

    /** Ambient. Sampled at 60%, shed at 80% — the highest volume, lowest value. */
    public const P2 = 'P2';

    /**
     * Seller-facing days, not UTC ones: a seller reading "today's usage" at
     * 6am Dhaka means the day that started at midnight their time (§5.1).
     */
    public const TIMEZONE = 'Asia/Dhaka';

    private const COUNTER_PREFIX = 'tracking:q:';

    /** Two days, so a counter outlives its day even across a clock skew or a late flush. */
    private const COUNTER_TTL_SECONDS = 172800;

    private const EVENT_PRIORITY = [
        // P0 — order outcome. Low volume (a handful per order), highest value.
        'Purchase' => self::P0,
        'Lead' => self::P0,
        'OrderConfirmed' => self::P0,
        'OrderShipped' => self::P0,
        'OrderDelivered' => self::P0,
        'OrderReturned' => self::P0,
        'OrderCanceled' => self::P0,

        // P1 — funnel.
        'InitiateCheckout' => self::P1,
        'AddToCart' => self::P1,
        'ViewContent' => self::P1,

        // P2 — ambient.
        'PageView' => self::P2,
        'Search' => self::P2,
        'Scroll' => self::P2,
        'TimeOnPage' => self::P2,
    ];

    /** Fraction of the quota at which each tier starts sampling, then stops entirely. */
    private const THRESHOLDS = [
        self::P1 => ['sample' => 0.80, 'drop' => 1.00],
        self::P2 => ['sample' => 0.60, 'drop' => 0.80],
    ];

    private const SAMPLE_KEEP_PERCENT = 50;

    /** Counter columns bump() may touch — this list is what makes the raw SQL safe. */
    private const COUNTERS = ['accepted_count', 'dropped_count', 'overage_count', 'sent_count', 'failed_count'];

    /**
     * An unrecognised event name is treated as funnel: dropping something the
     * seller deliberately sent would be worse than spending quota on it, and
     * calling it P0 would let a custom event bypass the limit entirely.
     */
    public function priorityFor(string $eventName): string
    {
        return self::EVENT_PRIORITY[$eventName] ?? self::P1;
    }

    /**
     * Decide whether to admit one event, and record the outcome.
     *
     * The read-then-increment is deliberately not atomic. Two concurrent
     * requests can both see the same count and both be admitted, so a seller
     * may overshoot by a few events under load. That is the right trade:
     * this is a soft business limit, not a security boundary, and making it
     * exact would need a Lua script on the hot path of every page view.
     *
     * @return array{admitted: bool, priority: string, reason: string, overage: bool}
     */
    public function admit(int $ownerId, string $eventName): array
    {
        $priority = $this->priorityFor($eventName);
        $limit = $this->limitFor($ownerId);

        if ($limit === null) {
            return $this->accept($ownerId, $priority, false);
        }

        // 0 means the package does not include tracking at all — unlike a
        // spent quota, there is no P0 exemption from a feature being off.
        if ($limit === 0) {
            return $this->refuse($ownerId, $priority, 'tracking_not_in_package');
        }

        $used = $this->usedToday($ownerId);
        $ratio = $used / $limit;

        if ($priority === self::P0) {
            return $this->accept($ownerId, $priority, $used >= $limit);
        }

        $thresholds = self::THRESHOLDS[$priority];

        if ($ratio >= $thresholds['drop']) {
            return $this->refuse($ownerId, $priority, 'quota_exceeded');
        }

        if ($ratio >= $thresholds['sample'] && ! $this->keepSample()) {
            return $this->refuse($ownerId, $priority, 'quota_sampled');
        }

        return $this->accept($ownerId, $priority, false);
    }

    /**
     * The sampling coin flip, isolated so tests can pin it — otherwise both
     * sampling branches are untestable and any assertion around the
     * threshold is a coin flip too. Not security-sensitive: this only
     * decides whether a PageView is worth spending quota on.
     */
    protected function keepSample(): bool
    {
        return random_int(1, 100) <= self::SAMPLE_KEEP_PERCENT;
    }

    /**
     * Give back a slot taken by admit(). Used when the event turns out to be
     * a duplicate after the fact — a repeat of an event already counted must
     * not be charged twice (§5.3).
     */
    public function refund(int $ownerId, bool $wasOverage = false): void
    {
        // Guarded: Redis DECRBY would happily create the key at -1, and a
        // negative counter reads as free quota for the rest of the day.
        if (Cache::has($this->counterKey($ownerId))) {
            Cache::decrement($this->counterKey($ownerId));
        }

        $this->bump($ownerId, 'accepted_count', -1);

        if ($wasOverage) {
            $this->bump($ownerId, 'overage_count', -1);
        }
    }

    /** Called from the dispatcher (T2) once Meta has accepted or rejected the event. */
    public function recordSent(int $ownerId, int $count = 1): void
    {
        $this->bump($ownerId, 'sent_count', $count);
    }

    public function recordFailed(int $ownerId, int $count = 1): void
    {
        $this->bump($ownerId, 'failed_count', $count);
    }

    /**
     * Today's usage for the quota meter and the 80%-used upgrade prompt.
     *
     * Reads the durable row rather than Redis so the numbers a seller sees
     * match the ones an admin sees in the table.
     *
     * @return array{date: string, limit: int|null, used: int, dropped: int, overage: int, percent: int|null}
     */
    public function usageToday(int $ownerId): array
    {
        $date = $this->today();
        $limit = $this->limitFor($ownerId);

        $row = TrackingUsageDaily::where('user_id', $ownerId)->where('date', $date)->first();

        $used = (int) ($row->accepted_count ?? 0);

        return [
            'date' => $date,
            'limit' => $limit,
            'used' => $used,
            'dropped' => (int) ($row->dropped_count ?? 0),
            'overage' => (int) ($row->overage_count ?? 0),
            'percent' => $limit ? (int) min(100, round($used / $limit * 100)) : null,
        ];
    }

    /** null = unlimited, 0 = tracking not included in this package. */
    public function limitFor(int $ownerId): ?int
    {
        $limit = User::find($ownerId)?->shopOwner()->subscriptionPackage?->max_tracking_events_per_day;

        return $limit === null ? null : (int) $limit;
    }

    public function today(): string
    {
        return Carbon::now(self::TIMEZONE)->toDateString();
    }

    private function usedToday(int $ownerId): int
    {
        return (int) (Cache::get($this->counterKey($ownerId)) ?? 0);
    }

    /** @return array{admitted: bool, priority: string, reason: string, overage: bool} */
    private function accept(int $ownerId, string $priority, bool $overage): array
    {
        // add() is a no-op when the key exists, so this sets the TTL exactly
        // once per day; Redis INCRBY then keeps that TTL.
        Cache::add($this->counterKey($ownerId), 0, self::COUNTER_TTL_SECONDS);
        Cache::increment($this->counterKey($ownerId));

        $this->bump($ownerId, 'accepted_count', 1);

        if ($overage) {
            $this->bump($ownerId, 'overage_count', 1);
        }

        return ['admitted' => true, 'priority' => $priority, 'reason' => 'accepted', 'overage' => $overage];
    }

    /** @return array{admitted: bool, priority: string, reason: string, overage: bool} */
    private function refuse(int $ownerId, string $priority, string $reason): array
    {
        // Only the counter moves — a dropped event is deliberately not
        // written to tracking_events (§5.2), or the quota would still cost us
        // the row it was meant to save.
        $this->bump($ownerId, 'dropped_count', 1);

        return ['admitted' => false, 'priority' => $priority, 'reason' => $reason, 'overage' => false];
    }

    /**
     * Atomic per-column increment on the day's row, creating it if absent.
     * Written as raw SQL because Eloquent has no upsert-with-increment, and a
     * read-modify-write here would lose counts under concurrency.
     */
    private function bump(int $ownerId, string $column, int $by): void
    {
        if (! in_array($column, self::COUNTERS, true)) {
            throw new \InvalidArgumentException("Unknown tracking usage counter [{$column}].");
        }

        DB::statement(
            "INSERT INTO tracking_usage_daily (user_id, date, {$column}, created_at, updated_at)
             VALUES (?, ?, ?, now(), now())
             ON CONFLICT (user_id, date) DO UPDATE
             SET {$column} = GREATEST(0, tracking_usage_daily.{$column} + EXCLUDED.{$column}),
                 updated_at = now()",
            [$ownerId, $this->today(), max(0, $by)]
        );

        // A refund passes a negative delta, which the INSERT branch cannot
        // express (the column is unsigned and a fresh row starts at 0). The
        // row is guaranteed to exist by now, so apply it directly.
        if ($by < 0) {
            DB::update(
                "UPDATE tracking_usage_daily
                 SET {$column} = GREATEST(0, {$column} + ?), updated_at = now()
                 WHERE user_id = ? AND date = ?",
                [$by, $ownerId, $this->today()]
            );
        }
    }

    private function counterKey(int $ownerId): string
    {
        return self::COUNTER_PREFIX . $ownerId . ':' . $this->today();
    }
}
