<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformMarketingEvent;
use App\Models\SubscriptionPayment;
use App\Models\User;
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

    /**
     * Answers "does offline/organic acquisition still help the ad account"
     * (platform_marketing_tracking_context.md) — breaks down every seller
     * who ever registered by their first-touch signup_utm_source (captured
     * once in home-content.tsx, never overwritten), regardless of whether
     * that source is a Meta campaign or nothing at all (an offline lead who
     * just typed the URL in). 'organic_direct' bundles every signup with no
     * captured utm_source, which includes offline-acquired sellers.
     *
     * Not a substitute for Ads Manager reporting — Meta already separates
     * ad-attributed conversions from everything else on its own side via
     * click IDs. This exists so BSOL itself can see, per channel: how many
     * signed up, how many became paying, and how much revenue they produced
     * — the same underlying users still feed Meta's pixel/CAPI dataset
     * either way (every visitor's event fires regardless of channel), so
     * this table is about our own CAC/LTV visibility, not about what Meta
     * sees.
     */
    public function channels(Request $request): JsonResponse
    {
        $signups = User::query()
            ->where('role', 'user')
            ->selectRaw("coalesce(nullif(signup_utm_source, ''), 'organic_direct') as channel, count(*) as total")
            ->groupBy('channel')
            ->pluck('total', 'channel');

        $paidUserIds = SubscriptionPayment::where('status', 'approved')->pluck('user_id')->unique();

        $payingByChannel = User::query()
            ->where('role', 'user')
            ->whereIn('id', $paidUserIds)
            ->selectRaw("coalesce(nullif(signup_utm_source, ''), 'organic_direct') as channel, count(*) as total")
            ->groupBy('channel')
            ->pluck('total', 'channel');

        $revenueByChannel = SubscriptionPayment::query()
            ->join('users', 'users.id', '=', 'subscription_payments.user_id')
            ->where('subscription_payments.status', 'approved')
            ->selectRaw("coalesce(nullif(users.signup_utm_source, ''), 'organic_direct') as channel, sum(subscription_payments.amount) as total")
            ->groupBy('channel')
            ->pluck('total', 'channel');

        $channels = $signups->keys()->map(fn (string $channel) => [
            'channel' => $channel,
            'signups' => (int) $signups[$channel],
            'paying_customers' => (int) ($payingByChannel[$channel] ?? 0),
            'revenue' => (float) ($revenueByChannel[$channel] ?? 0),
        ])->sortByDesc('signups')->values();

        // Campaign-level drill-down — only rows with a real utm_campaign, so
        // this is purely the paid-ad side (an offline lead never has one).
        // Lets the admin see which specific campaign to actually scale.
        $campaignSignups = User::query()
            ->where('role', 'user')
            ->whereNotNull('signup_utm_campaign')
            ->selectRaw('signup_utm_source as source, signup_utm_campaign as campaign, count(*) as total')
            ->groupBy('signup_utm_source', 'signup_utm_campaign')
            ->get();

        $campaignRevenue = SubscriptionPayment::query()
            ->join('users', 'users.id', '=', 'subscription_payments.user_id')
            ->where('subscription_payments.status', 'approved')
            ->whereNotNull('users.signup_utm_campaign')
            ->selectRaw('users.signup_utm_source as source, users.signup_utm_campaign as campaign, sum(subscription_payments.amount) as total')
            ->groupBy('users.signup_utm_source', 'users.signup_utm_campaign')
            ->get()
            ->keyBy(fn ($row) => $row->source.'|'.$row->campaign);

        $campaigns = $campaignSignups
            ->map(function ($row) use ($campaignRevenue) {
                $key = $row->source.'|'.$row->campaign;

                return [
                    'source' => $row->source,
                    'campaign' => $row->campaign,
                    'signups' => (int) $row->total,
                    'revenue' => (float) ($campaignRevenue[$key]->total ?? 0),
                ];
            })
            ->sortByDesc('signups')
            ->take(20)
            ->values();

        return response()->json([
            'success' => true,
            'channels' => $channels,
            'campaigns' => $campaigns,
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
