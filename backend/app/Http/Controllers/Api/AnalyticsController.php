<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    private const STATUSES = [
        'pending', 'confirmed', 'processing', 'shipped',
        'delivered', 'cancelled', 'returned',
    ];

    // ── Sales funnel ─────────────────────────────────────────────────────────

    public function sales(Request $request): JsonResponse
    {
        $userId = auth()->id();
        [$from, $to] = $this->resolveRange($request);

        $base = Order::where('user_id', $userId)
            ->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to);

        $byStatus = (clone $base)
            ->selectRaw('status, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        $funnel = collect(self::STATUSES)->map(fn ($status) => [
            'status'  => $status,
            'count'   => (int) ($byStatus[$status]->count ?? 0),
            'revenue' => (float) ($byStatus[$status]->revenue ?? 0),
        ])->values();

        $totalOrders      = (clone $base)->count();
        $delivered        = (int) ($byStatus['delivered']->count ?? 0);
        $deliveredRevenue = (float) ($byStatus['delivered']->revenue ?? 0);
        $cancelledReturned = (int) ($byStatus['cancelled']->count ?? 0) + (int) ($byStatus['returned']->count ?? 0);

        $trend = (clone $base)
            ->selectRaw("DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0) as revenue")
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'range' => compact('from', 'to'),
                'summary' => [
                    'total_orders'      => $totalOrders,
                    'delivered_orders'  => $delivered,
                    'delivered_revenue' => $deliveredRevenue,
                    'avg_order_value'   => $delivered > 0 ? round($deliveredRevenue / $delivered, 2) : 0,
                    'conversion_rate'   => $totalOrders > 0 ? round($delivered / $totalOrders * 100, 2) : 0,
                    'cancellation_rate' => $totalOrders > 0 ? round($cancelledReturned / $totalOrders * 100, 2) : 0,
                ],
                'funnel' => $funnel,
                'trend'  => $trend,
            ],
        ]);
    }

    // ── Product performance ──────────────────────────────────────────────────

    public function products(Request $request): JsonResponse
    {
        $userId = auth()->id();
        [$from, $to] = $this->resolveRange($request);

        // COALESCE(order_items.product_id, product_variants.product_id) covers
        // line items that were created with only a variant reference (no
        // direct product_id) — see SAAS_MODULE_CONTEXT.md §17.1.
        $rows = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'order_items.product_variant_id')
            ->join('products', 'products.id', '=', DB::raw('COALESCE(order_items.product_id, product_variants.product_id)'))
            ->where('orders.user_id', $userId)
            ->whereNull('orders.deleted_at')
            ->whereDate('orders.created_at', '>=', $from)
            ->whereDate('orders.created_at', '<=', $to)
            ->selectRaw("
                products.id as product_id,
                products.name as product_name,
                products.sku as product_sku,
                SUM(order_items.quantity) as qty_ordered,
                COALESCE(SUM(order_items.quantity) FILTER (WHERE orders.status = 'delivered'), 0) as qty_delivered,
                COALESCE(SUM(order_items.quantity) FILTER (WHERE orders.status = 'returned'), 0) as qty_returned,
                COALESCE(SUM(order_items.total) FILTER (WHERE orders.status = 'delivered'), 0) as revenue,
                COALESCE(SUM((order_items.unit_price - COALESCE(product_variants.cost_price, products.cost_price, 0)) * order_items.quantity) FILTER (WHERE orders.status = 'delivered'), 0) as margin
            ")
            ->groupBy('products.id', 'products.name', 'products.sku')
            ->orderByDesc('revenue')
            ->limit(50)
            ->get()
            ->map(function ($row) {
                $qtyOrdered  = (int) $row->qty_ordered;
                $qtyReturned = (int) $row->qty_returned;

                return [
                    'product_id'    => $row->product_id,
                    'name'          => $row->product_name,
                    'sku'           => $row->product_sku,
                    'qty_ordered'   => $qtyOrdered,
                    'qty_delivered' => (int) $row->qty_delivered,
                    'qty_returned'  => $qtyReturned,
                    'revenue'       => (float) $row->revenue,
                    'margin'        => (float) $row->margin,
                    'return_rate'   => $qtyOrdered > 0 ? round($qtyReturned / $qtyOrdered * 100, 2) : 0,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'range'    => compact('from', 'to'),
                'products' => $rows,
            ],
        ]);
    }

    // ── Customer intelligence ────────────────────────────────────────────────

    public function customers(Request $request): JsonResponse
    {
        $userId = auth()->id();
        [$from, $to] = $this->resolveRange($request);

        $totals = Customer::where('user_id', $userId)
            ->selectRaw("
                COUNT(*) as total_customers,
                COUNT(*) FILTER (WHERE total_orders >= 3) as loyal_customers,
                COUNT(*) FILTER (WHERE total_orders >= 2) as repeat_customers,
                COUNT(*) FILTER (WHERE tags @> '[\"vip\"]'::jsonb) as vip_customers,
                COUNT(*) FILTER (WHERE risk_level = 'high') as risky_customers,
                COUNT(*) FILTER (WHERE is_blocked = true) as blocked_customers,
                COALESCE(AVG(total_spent), 0) as avg_ltv
            ")
            ->first();

        $newCustomers = Customer::where('user_id', $userId)
            ->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to)
            ->count();

        $totalCustomers = (int) $totals->total_customers;
        $repeatCustomers = (int) $totals->repeat_customers;

        $districtBreakdown = Order::where('user_id', $userId)
            ->whereNotNull('customer_district')
            ->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to)
            ->selectRaw("customer_district as district, COUNT(*) as orders, COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0) as revenue")
            ->groupBy('customer_district')
            ->orderByDesc('orders')
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'range' => compact('from', 'to'),
                'summary' => [
                    'total_customers'    => $totalCustomers,
                    'new_customers'      => $newCustomers,
                    'loyal_customers'    => (int) $totals->loyal_customers,
                    'vip_customers'      => (int) $totals->vip_customers,
                    'risky_customers'    => (int) $totals->risky_customers,
                    'blocked_customers'  => (int) $totals->blocked_customers,
                    'repeat_buyer_rate'  => $totalCustomers > 0 ? round($repeatCustomers / $totalCustomers * 100, 2) : 0,
                    'avg_ltv'            => round((float) $totals->avg_ltv, 2),
                ],
                'district_breakdown' => $districtBreakdown,
            ],
        ]);
    }

    // ── Courier performance ──────────────────────────────────────────────────

    public function courier(Request $request): JsonResponse
    {
        $userId = auth()->id();
        [$from, $to] = $this->resolveRange($request);

        $byCourier = Order::where('user_id', $userId)
            ->whereNotNull('courier_name')
            ->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to)
            ->selectRaw("
                courier_name,
                COUNT(*) as total_bookings,
                COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
                COUNT(*) FILTER (WHERE status = 'returned') as returned,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                COALESCE(SUM(courier_charge), 0) as total_courier_charge,
                COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0) as delivered_revenue
            ")
            ->groupBy('courier_name')
            ->get();

        $avgDeliveryHours = OrderStatusLog::query()
            ->join('orders', 'orders.id', '=', 'order_status_logs.order_id')
            ->where('orders.user_id', $userId)
            ->whereNull('orders.deleted_at')
            ->where('order_status_logs.new_status', 'delivered')
            ->whereNotNull('orders.courier_name')
            ->whereDate('orders.created_at', '>=', $from)
            ->whereDate('orders.created_at', '<=', $to)
            ->selectRaw('orders.courier_name as courier_name, AVG(EXTRACT(EPOCH FROM (order_status_logs.created_at - orders.created_at)) / 3600) as avg_hours')
            ->groupBy('orders.courier_name')
            ->get()
            ->keyBy('courier_name');

        $couriers = $byCourier->map(function ($row) use ($avgDeliveryHours) {
            $total = (int) $row->total_bookings;
            $avg   = $avgDeliveryHours->get($row->courier_name);

            return [
                'courier_name'         => $row->courier_name,
                'total_bookings'       => $total,
                'delivered'            => (int) $row->delivered,
                'returned'             => (int) $row->returned,
                'cancelled'            => (int) $row->cancelled,
                'success_rate'         => $total > 0 ? round($row->delivered / $total * 100, 2) : 0,
                'return_rate'          => $total > 0 ? round($row->returned / $total * 100, 2) : 0,
                'total_courier_charge' => (float) $row->total_courier_charge,
                'delivered_revenue'    => (float) $row->delivered_revenue,
                'avg_delivery_hours'   => $avg ? round((float) $avg->avg_hours, 1) : null,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'range'    => compact('from', 'to'),
                'couriers' => $couriers,
            ],
        ]);
    }

    // ── Shared range resolver ────────────────────────────────────────────────

    private function resolveRange(Request $request): array
    {
        $range = $request->string('range')->toString();

        [$from, $to] = match ($range) {
            'today' => [now()->toDateString(), now()->toDateString()],
            'week'  => [now()->startOfWeek()->toDateString(), now()->toDateString()],
            'month' => [now()->startOfMonth()->toDateString(), now()->toDateString()],
            default => [now()->subDays(29)->toDateString(), now()->toDateString()],
        };

        if ($request->filled('from')) {
            $from = $request->string('from')->toString();
        }
        if ($request->filled('to')) {
            $to = $request->string('to')->toString();
        }

        return [$from, $to];
    }
}
