<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CourierFraudStat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only admin view of the shared (phone, courier) delivery-history cache
 * that CourierFraudCheckService reads/writes — lets the super admin see
 * exactly what's cached in `courier_fraud_stats`, without re-querying any
 * courier API.
 */
class CourierCacheController extends Controller
{
    private const COURIERS = ['pathao', 'steadfast', 'redx', 'carrybee', 'paperfly'];

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->per_page ?? 25), 100);

        $rows = CourierFraudStat::query()
            ->with('fetchedBy:id,name,email')
            ->when($request->filled('courier'), fn ($q) => $q->where('courier_name', $request->string('courier')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('phone'), function ($q) use ($request) {
                $q->where('phone_number', 'like', '%'.$request->string('phone').'%');
            })
            ->orderByDesc('last_checked_at')
            ->paginate($perPage);

        $ttlHours = (int) config('fraud_checker.cache_ttl_hours', 24);
        $errorCooldownMinutes = (int) config('fraud_checker.error_cooldown_minutes', 30);

        $data = collect($rows->items())->map(fn (CourierFraudStat $row) => $this->format($row, $ttlHours, $errorCooldownMinutes))->values();

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => $rows->total(),
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
            ],
            'summary' => $this->buildSummary(),
        ]);
    }

    private function format(CourierFraudStat $row, int $ttlHours, int $errorCooldownMinutes): array
    {
        $ageMinutes = $row->last_checked_at ? $row->last_checked_at->diffInMinutes(now()) : null;
        $isFresh = $row->last_checked_at !== null && ($row->status === 'ok'
            ? $ageMinutes < $ttlHours * 60
            : $ageMinutes < $errorCooldownMinutes);

        return [
            'id' => $row->id,
            'phone_number' => $row->phone_number,
            'courier_name' => $row->courier_name,
            'data_type' => $row->data_type,
            'total_parcels' => $row->total_parcels,
            'total_delivered' => $row->total_delivered,
            'total_cancelled' => $row->total_cancelled,
            'success_rate' => $row->success_rate,
            'rating' => $row->rating,
            'status' => $row->status,
            'error_message' => $row->error_message,
            'fetched_by' => $row->fetchedBy ? ['id' => $row->fetchedBy->id, 'name' => $row->fetchedBy->name, 'email' => $row->fetchedBy->email] : null,
            'last_checked_at' => optional($row->last_checked_at)->toISOString(),
            'is_fresh' => $isFresh,
            'created_at' => optional($row->created_at)->toISOString(),
        ];
    }

    private function buildSummary(): array
    {
        $rows = CourierFraudStat::query()
            ->selectRaw('courier_name, status, COUNT(*) as cnt')
            ->groupBy('courier_name', 'status')
            ->get();

        $summary = [];
        foreach (self::COURIERS as $courier) {
            $summary[$courier] = ['total' => 0, 'ok' => 0, 'error' => 0];
        }

        foreach ($rows as $row) {
            if (! isset($summary[$row->courier_name])) {
                $summary[$row->courier_name] = ['total' => 0, 'ok' => 0, 'error' => 0];
            }
            $summary[$row->courier_name]['total'] += $row->cnt;
            $summary[$row->courier_name][$row->status === 'ok' ? 'ok' : 'error'] += $row->cnt;
        }

        return [
            'total_cached' => array_sum(array_column($summary, 'total')),
            'by_courier' => $summary,
        ];
    }
}
