<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    // ── List ──────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Customer::where('user_id', auth()->id());

        if ($request->filled('search')) {
            $s = '%' . $request->search . '%';
            $query->where(fn ($q) => $q->where('name', 'ilike', $s)->orWhere('phone', 'ilike', $s));
        }
        if ($request->filled('risk_level')) {
            $query->where('risk_level', $request->risk_level);
        }
        if ($request->boolean('vip')) {
            $query->whereJsonContains('tags', 'vip');
        }
        if ($request->boolean('blocked')) {
            $query->where('is_blocked', true);
        }
        if ($request->filled('min_orders')) {
            $query->where('total_orders', '>=', (int) $request->min_orders);
        }

        $perPage   = min((int) ($request->per_page ?? 20), 100);
        $customers = $query->orderByDesc('total_orders')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $customers->items(),
            'meta'    => [
                'total'        => $customers->total(),
                'current_page' => $customers->currentPage(),
                'last_page'    => $customers->lastPage(),
                'per_page'     => $customers->perPage(),
            ],
        ]);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    public function stats(): JsonResponse
    {
        $userId = auth()->id();

        $counts = Customer::where('user_id', $userId)
            ->selectRaw("
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE is_blocked = true)           AS blocked,
                COUNT(*) FILTER (WHERE risk_level = 'high')         AS high_risk,
                COUNT(*) FILTER (WHERE tags @> '[\"vip\"]'::jsonb)  AS vip,
                COUNT(*) FILTER (WHERE total_orders >= 3)           AS repeat_customers
            ")
            ->first();

        return response()->json(['success' => true, 'data' => $counts]);
    }

    // ── Show (with order history) ─────────────────────────────────────────────

    public function show(int $id): JsonResponse
    {
        $customer = Customer::where('user_id', auth()->id())->findOrFail($id);

        $orders = Order::where('user_id', auth()->id())
            ->where('customer_phone', $customer->phone)
            ->with('items:id,order_id,product_name,quantity,unit_price,total')
            ->orderByDesc('created_at')
            ->take(50)
            ->get();

        return response()->json([
            'success' => true,
            'data'    => array_merge($customer->toArray(), ['orders' => $orders]),
        ]);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function update(Request $request, int $id): JsonResponse
    {
        $customer = Customer::where('user_id', auth()->id())->findOrFail($id);

        $data = $request->validate([
            'name'       => 'nullable|string|max:150',
            'email'      => 'nullable|email|max:150',
            'address'    => 'nullable|string',
            'district'   => 'nullable|string|max:100',
            'thana'      => 'nullable|string|max:100',
            'notes'      => 'nullable|string',
            'tags'       => 'nullable|array',
            'tags.*'     => 'string|max:50',
            'risk_level' => 'nullable|in:low,medium,high',
            'is_blocked' => 'nullable|boolean',
        ]);

        $customer->update($data);

        return response()->json(['success' => true, 'data' => $customer]);
    }

    // ── Toggle block ──────────────────────────────────────────────────────────

    public function toggleBlock(int $id): JsonResponse
    {
        $customer = Customer::where('user_id', auth()->id())->findOrFail($id);
        $customer->update(['is_blocked' => ! $customer->is_blocked]);

        return response()->json(['success' => true, 'data' => $customer]);
    }

    // ── Rebuild from orders ────────────────────────────────────────────────────

    public function syncAll(): JsonResponse
    {
        $userId = auth()->id();

        // Latest order per distinct phone — used to seed name/address
        $orders = Order::where('user_id', $userId)
            ->orderByDesc('id')
            ->get()
            ->unique('customer_phone');

        $count = 0;
        foreach ($orders as $order) {
            Customer::syncFromOrder($order);
            $count++;
        }

        return response()->json(['success' => true, 'message' => "$count customers synced."]);
    }
}
