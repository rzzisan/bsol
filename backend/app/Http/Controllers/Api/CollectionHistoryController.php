<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderPayment;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Unified "who collected what money, when, how" view across every
 * collection source — manual (OrderPayment), courier COD (Transaction
 * category=order_cod), and (later) online payment gateway. See
 * SAAS_MODULE_CONTEXT.md §19.
 */
class CollectionHistoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'source' => 'nullable|in:manual,courier_cod',
            'collected_by' => 'nullable|integer',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'search' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $shopUserIds = auth()->user()->shopUserIds();
        $source = $request->string('source')->toString() ?: null;

        $branches = [];

        if ($source === null || $source === 'manual') {
            $branches[] = $this->manualBranch($request, $shopUserIds);
        }

        // collected_by only ever applies to manual rows — courier COD has no
        // individual collector (courier remittance, not a staff hand-off),
        // so a collected_by filter can never match it. Skip the branch
        // entirely rather than adding a permanently-false WHERE clause.
        if (($source === null || $source === 'courier_cod') && ! $request->filled('collected_by')) {
            $branches[] = $this->courierCodBranch($request, $shopUserIds);
        }

        if (empty($branches)) {
            return response()->json([
                'success' => true,
                'data' => [],
                'meta' => ['total' => 0, 'current_page' => 1, 'last_page' => 1, 'per_page' => 20],
                'collectors' => $this->collectors($shopUserIds),
            ]);
        }

        $query = array_shift($branches);
        foreach ($branches as $branch) {
            $query->unionAll($branch);
        }

        $perPage = min((int) ($request->integer('per_page') ?: 20), 100);
        $rows = $query->orderByDesc('collected_at')->paginate($perPage);

        $rows->getCollection()->transform(function ($row) {
            return [
                'source' => $row->source,
                'source_id' => (int) $row->source_id,
                'collected_at' => $row->collected_at,
                'type' => $row->type,
                'method' => $row->method,
                'amount' => (float) $row->amount,
                'discount' => (float) $row->discount,
                'collected_by_id' => $row->collected_by_id !== null ? (int) $row->collected_by_id : null,
                // Courier-COD rows have no individual collector — the UI
                // treats a null name here as "Courier" for that source.
                'collected_by_name' => $row->collected_by_name,
                'screenshot_url' => $row->screenshot_path ? Storage::disk('public')->url($row->screenshot_path) : null,
                'note' => $row->note,
                'order_id' => (int) $row->order_id,
                'order_number' => $row->order_number,
                'customer_name' => $row->customer_name,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $rows->items(),
            'meta' => [
                'total' => $rows->total(),
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
            ],
            'collectors' => $this->collectors($shopUserIds),
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $range = $request->string('range')->toString();

        [$from, $to] = match ($range) {
            'week' => [now()->startOfWeek()->toDateString(), now()->toDateString()],
            'month' => [now()->startOfMonth()->toDateString(), now()->toDateString()],
            default => [now()->toDateString(), now()->toDateString()],
        };
        if ($request->filled('from')) {
            $from = $request->string('from')->toString();
        }
        if ($request->filled('to')) {
            $to = $request->string('to')->toString();
        }

        $shopUserIds = auth()->user()->shopUserIds();

        $manualTotal = (float) OrderPayment::whereIn('user_id', $shopUserIds)
            ->whereDate('collected_at', '>=', $from)
            ->whereDate('collected_at', '<=', $to)
            ->sum('amount');

        $codTotal = (float) Transaction::whereIn('user_id', $shopUserIds)
            ->where('reference_type', 'order')
            ->where('category', 'order_cod')
            ->where('status', Transaction::STATUS_CONFIRMED)
            ->where('type', Transaction::TYPE_INCOME)
            ->whereDate('updated_at', '>=', $from)
            ->whereDate('updated_at', '<=', $to)
            ->sum('amount');

        return response()->json([
            'success' => true,
            'data' => [
                'range' => compact('from', 'to'),
                'manual_total' => $manualTotal,
                'courier_cod_total' => $codTotal,
                'grand_total' => $manualTotal + $codTotal,
            ],
        ]);
    }

    /** @param array<int,int> $shopUserIds */
    private function manualBranch(Request $request, array $shopUserIds): \Illuminate\Database\Query\Builder
    {
        $query = DB::table('order_payments')
            ->join('orders', 'orders.id', '=', 'order_payments.order_id')
            ->leftJoin('users as op_collectors', 'op_collectors.id', '=', 'order_payments.collected_by')
            ->whereIn('order_payments.user_id', $shopUserIds)
            ->select([
                DB::raw("'manual' as source"),
                'order_payments.id as source_id',
                'order_payments.collected_at as collected_at',
                'order_payments.purpose as type',
                'order_payments.method as method',
                'order_payments.amount as amount',
                'order_payments.discount as discount',
                'order_payments.collected_by as collected_by_id',
                'op_collectors.name as collected_by_name',
                'order_payments.screenshot_path as screenshot_path',
                'order_payments.note as note',
                'orders.id as order_id',
                'orders.order_number as order_number',
                'orders.customer_name as customer_name',
            ]);

        if ($request->filled('from')) {
            $query->whereDate('order_payments.collected_at', '>=', $request->string('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('order_payments.collected_at', '<=', $request->string('to'));
        }
        if ($request->filled('collected_by')) {
            $query->where('order_payments.collected_by', $request->integer('collected_by'));
        }
        if ($request->filled('search')) {
            $query->where('orders.order_number', 'ilike', '%' . $request->string('search') . '%');
        }

        return $query;
    }

    /** @param array<int,int> $shopUserIds */
    private function courierCodBranch(Request $request, array $shopUserIds): \Illuminate\Database\Query\Builder
    {
        $query = DB::table('transactions')
            ->join('orders', 'orders.id', '=', 'transactions.reference_id')
            ->whereIn('transactions.user_id', $shopUserIds)
            ->where('transactions.reference_type', 'order')
            ->where('transactions.category', 'order_cod')
            ->where('transactions.status', Transaction::STATUS_CONFIRMED)
            ->where('transactions.type', Transaction::TYPE_INCOME)
            ->select([
                DB::raw("'courier_cod' as source"),
                'transactions.id as source_id',
                'transactions.updated_at as collected_at',
                DB::raw("'cod' as type"),
                DB::raw("'courier' as method"),
                'transactions.amount as amount',
                DB::raw('0::numeric(12,2) as discount'),
                DB::raw('NULL::bigint as collected_by_id'),
                DB::raw('NULL::varchar as collected_by_name'),
                DB::raw('NULL::varchar as screenshot_path'),
                DB::raw('NULL::varchar as note'),
                'orders.id as order_id',
                'orders.order_number as order_number',
                'orders.customer_name as customer_name',
            ]);

        if ($request->filled('from')) {
            $query->whereDate('transactions.updated_at', '>=', $request->string('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('transactions.updated_at', '<=', $request->string('to'));
        }
        if ($request->filled('search')) {
            $query->where('orders.order_number', 'ilike', '%' . $request->string('search') . '%');
        }

        return $query;
    }

    /** @param array<int,int> $shopUserIds */
    private function collectors(array $shopUserIds): \Illuminate\Support\Collection
    {
        return User::whereIn('id', $shopUserIds)->orderBy('name')->get(['id', 'name']);
    }
}
