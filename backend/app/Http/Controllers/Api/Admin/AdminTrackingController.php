<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Tracking\TrackingQuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Per-seller tracking usage, for the whole platform in one screen
 * (tracking_capi_context.md §5.2/§6.2, T7 — "admin-এর per-seller usage ভিউ").
 *
 * Read-only. Mirrors AdminSmsCreditController::listUserCredits's shape (a
 * flat, unpaginated list — this platform's seller count doesn't yet warrant
 * pagination on admin list screens, same call every other admin list here
 * already made).
 */
class AdminTrackingController extends Controller
{
    public function usage(): JsonResponse
    {
        $today = Carbon::now(TrackingQuotaService::TIMEZONE)->toDateString();

        $destinationCounts = DB::table('tracking_destinations')
            ->select('user_id', DB::raw('count(*) as cnt'))
            ->groupBy('user_id');

        $rows = DB::table('users')
            ->whereNull('users.owner_id') // shop owners only — staff have no quota of their own (§5.1)
            ->where('users.role', 'user')
            ->leftJoin('subscription_packages', 'users.subscription_package_id', '=', 'subscription_packages.id')
            ->leftJoin('tracking_usage_daily', function ($join) use ($today) {
                $join->on('tracking_usage_daily.user_id', '=', 'users.id')
                    ->where('tracking_usage_daily.date', $today);
            })
            ->leftJoinSub($destinationCounts, 'td', fn ($join) => $join->on('td.user_id', '=', 'users.id'))
            ->orderByDesc(DB::raw('COALESCE(tracking_usage_daily.accepted_count, 0)'))
            ->get([
                'users.id', 'users.name', 'users.email', 'users.mobile',
                'subscription_packages.name as package_name',
                'subscription_packages.max_tracking_events_per_day as daily_limit',
                DB::raw('COALESCE(tracking_usage_daily.accepted_count, 0) as accepted'),
                DB::raw('COALESCE(tracking_usage_daily.dropped_count, 0) as dropped'),
                DB::raw('COALESCE(tracking_usage_daily.overage_count, 0) as overage'),
                DB::raw('COALESCE(tracking_usage_daily.sent_count, 0) as sent'),
                DB::raw('COALESCE(tracking_usage_daily.failed_count, 0) as failed'),
                DB::raw('COALESCE(td.cnt, 0) as destinations_count'),
            ]);

        return response()->json([
            'success' => true,
            'date' => $today,
            'data' => $rows->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'email' => $r->email,
                'mobile' => $r->mobile,
                'package_name' => $r->package_name,
                'daily_limit' => $r->daily_limit === null ? null : (int) $r->daily_limit,
                'accepted' => (int) $r->accepted,
                'dropped' => (int) $r->dropped,
                'overage' => (int) $r->overage,
                'sent' => (int) $r->sent,
                'failed' => (int) $r->failed,
                'destinations_count' => (int) $r->destinations_count,
            ]),
        ]);
    }
}
