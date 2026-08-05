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

    /**
     * One row per phone number, one column per courier — matching how the
     * seller-facing fraud-check page presents this same data. `courier`/
     * `status` filters narrow which phones qualify, but every qualifying
     * phone still shows all 5 courier columns (null where nothing is cached).
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->per_page ?? 20), 100);
        $ttlHours = (int) config('fraud_checker.cache_ttl_hours', 24);
        $errorCooldownMinutes = (int) config('fraud_checker.error_cooldown_minutes', 30);

        $phonePage = CourierFraudStat::query()
            ->select('phone_number')
            ->selectRaw('MAX(last_checked_at) as latest_checked_at')
            ->when($request->filled('phone'), function ($q) use ($request) {
                $q->where('phone_number', 'like', '%'.$request->string('phone').'%');
            })
            ->when($request->filled('courier'), fn ($q) => $q->where('courier_name', $request->string('courier')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->groupBy('phone_number')
            ->orderByDesc('latest_checked_at')
            ->paginate($perPage);

        $phones = collect($phonePage->items())->pluck('phone_number');

        $rowsByPhone = CourierFraudStat::query()
            ->whereIn('phone_number', $phones)
            ->with('fetchedBy:id,name,email')
            ->get()
            ->groupBy('phone_number');

        $data = $phones->map(function (string $phone) use ($rowsByPhone, $ttlHours, $errorCooldownMinutes) {
            $forPhone = $rowsByPhone->get($phone, collect());

            $couriers = [];
            foreach (self::COURIERS as $courier) {
                $row = $forPhone->firstWhere('courier_name', $courier);
                $couriers[$courier] = $row ? $this->format($row, $ttlHours, $errorCooldownMinutes) : null;
            }

            return [
                'phone_number' => $phone,
                'last_checked_at' => $forPhone->max('last_checked_at')?->toISOString(),
                'couriers' => $couriers,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => $phonePage->total(),
                'current_page' => $phonePage->currentPage(),
                'last_page' => $phonePage->lastPage(),
                'per_page' => $phonePage->perPage(),
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
