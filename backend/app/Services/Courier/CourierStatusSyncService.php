<?php

namespace App\Services\Courier;

use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Support\Facades\Log;

/**
 * Bridges a courier's own tracking status onto BSOL's order lifecycle.
 *
 * Before this existed, CourierController::trackOrder() only ever wrote the
 * raw courier_status column — order.status stayed wherever book() first left
 * it ("processing") forever, even after the courier genuinely delivered the
 * parcel and collected COD. Nothing downstream of OrderStatusService::transition()
 * (inventory release, the COD income Transaction, payment_status, order_status_logs,
 * analytics' delivered-revenue aggregates, or the Meta OrderDelivered pixel event)
 * ever ran. See courier_status_sync_context.md for the full incident writeup —
 * read that before touching this class.
 */
class CourierStatusSyncService
{
    /** Once an order lands here, a courier status flip must never move it again. */
    private const TERMINAL_STATUSES = ['delivered', 'cancelled', 'returned'];

    public function __construct(
        private readonly OrderStatusService $orderStatusService,
    ) {}

    /**
     * Pull the courier's current status for $order, persist it onto
     * courier_status (unconditionally, as before), and — if it maps to a
     * confident outcome — cascade it into order.status via
     * OrderStatusService::transition() so every side effect fires exactly as
     * if a human had picked it from the status dropdown.
     *
     * @return array{success: bool, status: ?string, message: ?string, raw: array}
     */
    public function sync(Order $order): array
    {
        if (! $order->courier_tracking_id) {
            return ['success' => false, 'status' => null, 'message' => 'No tracking ID.', 'raw' => []];
        }

        $provider = CourierFactory::make($order->courier_name);
        if (! $provider) {
            return ['success' => true, 'status' => $order->courier_status, 'message' => 'Manual tracking.', 'raw' => []];
        }

        $result = $provider->track($order);

        if ($result['success'] && ! empty($result['status'])) {
            $order->update(['courier_status' => $result['status']]);
            $this->cascadeToOrderStatus($order, $result['status']);
        }

        return [
            'success' => $result['success'],
            'status'  => $result['status'] ?? null,
            'message' => $result['message'] ?? null,
            'raw'     => $result['raw'] ?? [],
        ];
    }

    private function cascadeToOrderStatus(Order $order, string $rawCourierStatus): void
    {
        // Never move an order backwards out of a state it already resolved
        // to — a courier flapping between "delivered"/"in review" on retries
        // must not un-deliver an order whose stock/accounting/ad-signal side
        // effects already fired.
        if (in_array($order->status, self::TERMINAL_STATUSES, true)) {
            return;
        }

        $mapped = $this->classify($rawCourierStatus);
        if ($mapped === null || $mapped === $order->status) {
            return;
        }

        try {
            $this->orderStatusService->transition(
                $order,
                $mapped,
                "Courier status sync: {$rawCourierStatus}",
                null,
            );
        } catch (\Throwable $e) {
            // A stock-mismatch (or any other) failure here must never take
            // down the courier-tracking request/command that triggered it —
            // courier_status above has already been persisted either way.
            Log::warning('Courier-driven order status transition failed', [
                'order_id' => $order->id,
                'courier_status' => $rawCourierStatus,
                'mapped_status' => $mapped,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Pathao's order_status_slug, Steadfast's delivery_status, RedX's status,
     * CarryBee's transfer_status, Paperfly's own normalized strings — five
     * couriers, no shared enum, and this codebase has already seen
     * "Delivered" (booking-dashboard capitalization) alongside "delivered"
     * (API slug) for the same outcome. Classifying by keyword instead of an
     * exact-match table per courier means wording/casing variants all land
     * the same place, at the cost of being unable to represent every
     * intermediate courier-specific status (acceptable — only the four
     * outcomes below actually change what BSOL does with the order).
     */
    private function classify(string $raw): ?string
    {
        $s = strtolower(str_replace(['_', '-'], ' ', $raw));

        if (str_contains($s, 'partial')) {
            // Partial delivery still means the courier handed it over and
            // collected whatever COD it could — a completed delivery leg,
            // not a hold state.
            return 'delivered';
        }
        if (str_contains($s, 'deliver')) {
            return 'delivered';
        }
        if (str_contains($s, 'return')) {
            return 'returned';
        }
        if (str_contains($s, 'cancel')) {
            return 'cancelled';
        }
        if (str_contains($s, 'transit') || str_contains($s, 'pick') || str_contains($s, 'hub')
            || str_contains($s, 'dispatch') || str_contains($s, 'sorting') || str_contains($s, 'out for delivery')) {
            return 'shipped';
        }

        // "pending" / "hold" / "in_review" / "booked" / unrecognized — no
        // confident outcome yet, leave order.status exactly where it is.
        return null;
    }
}
