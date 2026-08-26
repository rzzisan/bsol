<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformMarketingEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only event log for BSOL's own acquisition-funnel tracking
 * (platform_marketing_tracking_context.md) — the super-admin counterpart to
 * TrackingEventController, which is the same thing for a seller's own
 * events. Mirrors its shape (filters, pagination, match-quality sampling)
 * deliberately, so this reads as one system rather than two.
 */
class PlatformMarketingEventController extends Controller
{
    private const PER_PAGE_MAX = 100;

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => 'nullable|in:queued,sent,failed',
            'event_name' => 'nullable|string|max:50',
            'per_page' => 'nullable|integer|min:1|max:'.self::PER_PAGE_MAX,
        ]);

        $query = PlatformMarketingEvent::query()->with('user:id,name,email');

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }
        if (! empty($data['event_name'])) {
            $query->where('event_name', $data['event_name']);
        }

        $events = (clone $query)
            ->orderByDesc('id')
            ->paginate($data['per_page'] ?? 20)
            ->through(fn (PlatformMarketingEvent $e) => [
                'id' => $e->id,
                'event_name' => $e->event_name,
                'event_id' => $e->event_id,
                'status' => $e->status,
                'created_at' => $e->created_at,
                'sent_at' => $e->sent_at,
                'user' => $e->user ? ['id' => $e->user->id, 'name' => $e->user->name, 'email' => $e->user->email] : null,
                'value' => $e->custom_data['value'] ?? null,
                'currency' => $e->custom_data['currency'] ?? null,
                'has_fbp' => isset($e->user_data_hashed['fbp']),
                'has_fbc' => isset($e->user_data_hashed['fbc']),
                'response_code' => $e->response_code,
                'error_message' => $e->error_message,
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
            'counts' => PlatformMarketingEvent::query()
                ->selectRaw('event_name, status, count(*) as total')
                ->groupBy('event_name', 'status')
                ->get()
                ->groupBy('event_name')
                ->map(fn ($rows) => $rows->pluck('total', 'status')),
            'match_quality' => $this->matchQuality((clone $query)),
        ]);
    }

    /** Same reasoning/sampling window as TrackingEventController::matchQuality(). */
    private function matchQuality($query): array
    {
        $sample = $query->orderByDesc('id')->limit(500)->get(['user_data_hashed']);
        $total = $sample->count();

        if ($total === 0) {
            return ['sampled' => 0, 'fbp_rate' => null, 'fbc_rate' => null, 'phone_rate' => null];
        }

        $fbp = $sample->filter(fn (PlatformMarketingEvent $e) => isset($e->user_data_hashed['fbp']))->count();
        $fbc = $sample->filter(fn (PlatformMarketingEvent $e) => isset($e->user_data_hashed['fbc']))->count();
        $phone = $sample->filter(fn (PlatformMarketingEvent $e) => isset($e->user_data_hashed['ph']))->count();

        return [
            'sampled' => $total,
            'fbp_rate' => round($fbp / $total, 3),
            'fbc_rate' => round($fbc / $total, 3),
            'phone_rate' => round($phone / $total, 3),
        ];
    }
}
