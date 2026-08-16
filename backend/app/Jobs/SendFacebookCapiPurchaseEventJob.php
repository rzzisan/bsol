<?php

namespace App\Jobs;

use App\Models\Order;
use App\Services\Tracking\TrackingIngestService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Submits a Purchase event for a landing-page or WooCommerce checkout into
 * the tracking pipeline (tracking_capi_context.md §6.1). Historically this
 * job talked to Meta directly; as of T2 it is a thin wrapper over
 * TrackingIngestService — the constructor and both live dispatch call
 * sites (LandingPageController.php, ConnectOrderController.php) are
 * unchanged on purpose, since this is the lowest-risk way to move
 * production traffic onto the new pipeline.
 *
 * What changed under the hood: FacebookPixelSetting lookup and the direct
 * Meta HTTP call are gone from here — TrackingIngestService resolves the
 * seller's tracking_destinations itself (no destination configured is a
 * silent no-op, same as before), and the actual send now happens in
 * DispatchTrackingEventsJob, with retry/backoff and an event log neither of
 * which this job had. A repeat call for the same order is now also safe —
 * tracking_events' unique(user_id, event_name, event_id) dedupes it,
 * something the old direct-to-Meta path had no protection against.
 */
class SendFacebookCapiPurchaseEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        private readonly int $orderId,
        private readonly ?string $clientIp,
        private readonly ?string $userAgent,
        private readonly string $eventSourceUrl,
    ) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(TrackingIngestService $ingest): void
    {
        $order = Order::with('items')->find($this->orderId);
        if (! $order) {
            return;
        }

        $event = [
            'event_name' => 'Purchase',
            // Stable per-order id — lets a client-side Pixel Purchase event
            // (if the seller ever adds one) dedupe against this CAPI event.
            'event_id' => 'order_' . $order->id,
            'event_time' => $order->created_at,
            'action_source' => 'website',
            'event_source_url' => $this->eventSourceUrl,
            'user_data' => array_filter([
                // Raw phone in, TrackingUserDataBuilder normalizes + hashes
                // it the same way this job used to do inline — see its
                // docblock for why that has to stay in exact lockstep.
                'ph' => $order->customer_phone,
                'client_ip_address' => $this->clientIp,
                'client_user_agent' => $this->userAgent,
                // Persisted on the order at checkout time (LandingPageController/
                // ConnectOrderController) rather than threaded through this
                // job's constructor — TrackingIngestService's merge-on-duplicate
                // also backstops this for the same-order-id race against a
                // browser-side Purchase copy, but sending it here directly
                // means match quality doesn't depend on that race resolving
                // favorably (tracking_capi_context.md §11.4).
                'fbp' => $order->fbp,
                'fbc' => $order->fbc,
            ]),
            'custom_data' => [
                'currency' => 'BDT',
                'value' => (float) $order->total,
                'num_items' => (int) $order->items->sum('quantity'),
                'content_ids' => $order->items->pluck('product_id')->filter()->values()->all(),
                'content_type' => 'product',
            ],
        ];

        // Order.user_id is always the shop owner id (never staff) — the
        // same id tracking_destinations and the daily quota are keyed by.
        $ingest->ingest($order->user_id, $event, ['order_id' => $order->id]);
    }
}
