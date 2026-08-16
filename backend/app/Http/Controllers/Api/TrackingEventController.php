<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TrackingEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only tracking event log (tracking_capi_context.md §6.2/§6.3, T7).
 *
 * Pattern A (team-shared, module key `tracking`) — this only shows what was
 * sent and how it went, never a destination's access token, so a staff grant
 * has something real to open. Destination CRUD stays owner_only forever.
 */
class TrackingEventController extends Controller
{
    private const PER_PAGE_MAX = 100;

    public function index(Request $request): JsonResponse
    {
        $shopUserIds = $request->user()->shopUserIds();

        $data = $request->validate([
            'status' => 'nullable|in:queued,sent,failed,duplicate',
            'event_name' => 'nullable|string|max:50',
            'order_id' => 'nullable|integer',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'per_page' => 'nullable|integer|min:1|max:'.self::PER_PAGE_MAX,
        ]);

        $query = TrackingEvent::whereIn('user_id', $shopUserIds)
            ->with(['trackingDestination:id,label', 'landingPage:id,title', 'platformApiKey:id,domain']);

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }
        if (! empty($data['event_name'])) {
            $query->where('event_name', $data['event_name']);
        }
        if (! empty($data['order_id'])) {
            $query->where('order_id', $data['order_id']);
        }
        if (! empty($data['from'])) {
            $query->whereDate('event_time', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            $query->whereDate('event_time', '<=', $data['to']);
        }

        $events = (clone $query)
            ->orderByDesc('event_time')
            ->paginate($data['per_page'] ?? 20)
            ->through(fn (TrackingEvent $e) => [
                'id' => $e->id,
                'event_name' => $e->event_name,
                'event_time' => $e->event_time,
                'status' => $e->status,
                'action_source' => $e->action_source,
                'destination' => $e->trackingDestination?->label,
                'landing_page' => $e->landingPage?->title,
                'site' => $e->platformApiKey?->domain,
                'order_id' => $e->order_id,
                'has_fbp' => isset($e->user_data_hashed['fbp']),
                'has_fbc' => isset($e->user_data_hashed['fbc']),
                'response_code' => $e->response_code,
                'error_message' => $e->error_message,
                'attempts' => $e->attempts,
            ]);

        return response()->json([
            'success' => true,
            'data' => $events->items(),
            'pagination' => [
                'total' => $events->total(),
                'per_page' => $events->perPage(),
                'current_page' => $events->currentPage(),
                'last_page' => $events->lastPage(),
            ],
            'match_quality' => $this->matchQuality((clone $query)),
        ]);
    }

    /**
     * Coverage of Meta's strongest match-quality signals across the most
     * recent accepted events within the current filters. Sampled over the
     * latest 500 rather than the whole table — this is a directional health
     * indicator for the seller, not a billing figure, and a full scan of a
     * 90-day, unbounded-row table on every page load isn't worth it.
     */
    private function matchQuality($query): array
    {
        $sample = $query
            ->orderByDesc('event_time')
            ->limit(500)
            ->get(['user_data_hashed']);

        $total = $sample->count();

        if ($total === 0) {
            return ['sampled' => 0, 'fbp_rate' => null, 'fbc_rate' => null, 'phone_rate' => null];
        }

        $fbp = $sample->filter(fn (TrackingEvent $e) => isset($e->user_data_hashed['fbp']))->count();
        $fbc = $sample->filter(fn (TrackingEvent $e) => isset($e->user_data_hashed['fbc']))->count();
        $phone = $sample->filter(fn (TrackingEvent $e) => isset($e->user_data_hashed['ph']))->count();

        return [
            'sampled' => $total,
            'fbp_rate' => round($fbp / $total, 3),
            'fbc_rate' => round($fbc / $total, 3),
            'phone_rate' => round($phone / $total, 3),
        ];
    }
}
