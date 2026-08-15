<?php

namespace App\Console\Commands;

use App\Models\TrackingEvent;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Keeps tracking_events to a 90-day window (tracking_capi_context.md §4.2).
 *
 * Without this it becomes the largest table in the database by a wide
 * margin — a single busy seller can produce more rows here in a week than
 * the whole orders table holds. The daily totals a seller actually looks at
 * live in tracking_usage_daily, which is never purged, so nothing
 * user-visible is lost.
 *
 * Deleted in chunks so a first run on a large backlog does not hold one long
 * transaction or spike replication lag.
 */
#[Signature('app:purge-tracking-events {--days=90} {--chunk=5000}')]
#[Description('Delete tracking events older than the retention window.')]
class PurgeOldTrackingEvents extends Command
{
    public function handle(): void
    {
        $days = max(1, (int) $this->option('days'));
        $chunk = max(100, (int) $this->option('chunk'));
        $cutoff = now()->subDays($days);

        $total = 0;

        // Select the ids first, then delete by id: Postgres has no
        // DELETE ... LIMIT, so chunking has to happen on the select side.
        while (true) {
            $ids = TrackingEvent::where('created_at', '<', $cutoff)->limit($chunk)->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $total += TrackingEvent::whereIn('id', $ids)->delete();
        }

        $this->info("Purged {$total} tracking event(s) older than {$days} day(s).");
    }
}
