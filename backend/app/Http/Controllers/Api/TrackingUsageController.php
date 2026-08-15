<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TrackingUsageDaily;
use App\Services\Tracking\TrackingQuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * Read-only view of a shop's tracking event usage against its package limit
 * (tracking_capi_context.md §5.2 — the quota meter and the 80%-used prompt).
 *
 * This exists before anything actually sends events on purpose: T2 starts
 * pushing real traffic through TrackingQuotaService, and without a way to
 * see accepted / dropped / overage, a misbehaving quota would be invisible.
 *
 * Middleware note: §6.2 has usage reads as Pattern A (team-shared, module
 * key `tracking`). It is owner_only for now because the only surface showing
 * it is the owner-only Pixel settings page — a staff grant would toggle
 * access to nothing. T7 adds the tracking page with the event log, and the
 * module key belongs in that change, with its UI.
 */
class TrackingUsageController extends Controller
{
    private const HISTORY_DAYS = 30;

    public function __construct(private readonly TrackingQuotaService $quota) {}

    public function show(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();

        $today = $this->quota->usageToday($ownerId);

        // Days are Asia/Dhaka calendar days, so the window is built from the
        // service's own notion of "today" rather than from now() (UTC).
        $from = Carbon::parse($today['date'])->subDays(self::HISTORY_DAYS - 1)->toDateString();

        $history = TrackingUsageDaily::where('user_id', $ownerId)
            ->where('date', '>=', $from)
            ->orderByDesc('date')
            ->get(['date', 'accepted_count', 'dropped_count', 'overage_count', 'sent_count', 'failed_count'])
            ->map(fn (TrackingUsageDaily $row) => [
                'date' => $row->date->toDateString(),
                'accepted' => $row->accepted_count,
                'dropped' => $row->dropped_count,
                'overage' => $row->overage_count,
                'sent' => $row->sent_count,
                'failed' => $row->failed_count,
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'today' => $today,
                // What the meter's colour and message should say. Derived
                // here so the dashboard and any later admin view cannot
                // disagree about where the thresholds are.
                'state' => $this->state($today['limit'], $today['used']),
                'history' => $history,
                'timezone' => TrackingQuotaService::TIMEZONE,
            ],
        ]);
    }

    /**
     * ok → nothing is being shed yet.
     * sampling → ambient events are already being sampled (60% of quota).
     * critical → funnel events are being shed too, only P0 is guaranteed (80%).
     * exhausted → quota spent; Purchase/OrderDelivered still go through.
     */
    private function state(?int $limit, int $used): string
    {
        if ($limit === null) {
            return 'unlimited';
        }

        if ($limit === 0) {
            return 'not_in_package';
        }

        $ratio = $used / $limit;

        return match (true) {
            $ratio >= 1.0 => 'exhausted',
            $ratio >= 0.8 => 'critical',
            $ratio >= 0.6 => 'sampling',
            default => 'ok',
        };
    }
}
