<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\Courier\CourierFactory;
use App\Services\Courier\CourierStatusSyncService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * The only automatic trigger for courier→order status sync — before this,
 * courier_status/order.status only ever updated when a seller opened an
 * order and clicked "Refresh" (CourierController::trackOrder()). A physical
 * delivery that nobody happened to click on stayed "processing" in BSOL
 * forever. See courier_status_sync_context.md.
 */
#[Signature('app:sync-courier-statuses')]
#[Description('Poll every booked, not-yet-resolved order for its real courier status and cascade it into order.status.')]
class SyncCourierStatuses extends Command
{
    public function handle(CourierStatusSyncService $courierStatusSyncService): void
    {
        $synced = 0;
        $changed = 0;
        $failed = 0;

        // No ->limit() here deliberately — Laravel's chunkById() does its own
        // WHERE id > $lastId pagination and doesn't compose reliably with an
        // outer limit()/take(). The backlog this query can ever match is
        // naturally bounded anyway: an order drops out the moment it
        // resolves to delivered/cancelled/returned, so this only ever
        // covers orders genuinely still in flight.
        Order::query()
            ->whereNotNull('courier_tracking_id')
            ->whereNotIn('status', ['delivered', 'cancelled', 'returned'])
            ->whereIn('courier_name', CourierFactory::supportedCouriers())
            ->chunkById(50, function ($orders) use ($courierStatusSyncService, &$synced, &$changed, &$failed) {
                foreach ($orders as $order) {
                    $statusBefore = $order->status;

                    try {
                        $courierStatusSyncService->sync($order);
                        $synced++;

                        if ($order->fresh()->status !== $statusBefore) {
                            $changed++;
                        }
                    } catch (\Throwable $e) {
                        $failed++;
                        Log::warning('Scheduled courier status sync failed for an order', [
                            'order_id' => $order->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            });

        $this->info("Courier status sync: checked {$synced}, {$changed} order(s) changed status, {$failed} failed.");
    }
}
