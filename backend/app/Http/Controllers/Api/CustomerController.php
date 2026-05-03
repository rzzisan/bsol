<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';

        if (str_starts_with($digits, '880') && strlen($digits) >= 13) {
            $digits = '0' . substr($digits, -10);
        }

        return substr($digits, -11);
    }

    // ── Shared lookup by phone (cross-user safe) ───────────────────────────

    public function lookupByPhone(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => 'required|string|max:20',
        ]);

        $normalized = $this->normalizePhone($data['phone']);
        $match10    = substr($normalized, -10);

        if (strlen($match10) < 10) {
            return response()->json([
                'success' => true,
                'data'    => [
                    'found'   => false,
                    'profile' => null,
                    'shared'  => [
                        'total_orders' => 0,
                        'seller_count' => 0,
                    ],
                ],
            ]);
        }

        $sharedStats = Order::query()
            ->whereRaw("right(regexp_replace(customer_phone, '\\D', '', 'g'), 10) = ?", [$match10])
            ->selectRaw('COUNT(*) as total_orders, COUNT(DISTINCT user_id) as seller_count')
            ->first();

        $fromCustomers = Customer::query()
            ->whereRaw("right(regexp_replace(phone, '\\D', '', 'g'), 10) = ?", [$match10])
            ->where(function ($q) {
                $q->whereNotNull('name')
                    ->orWhereNotNull('address')
                    ->orWhereNotNull('district')
                    ->orWhereNotNull('thana');
            })
            ->selectRaw("NULLIF(TRIM(name), '') as name, NULLIF(TRIM(address), '') as address, NULLIF(TRIM(district), '') as district, NULLIF(TRIM(thana), '') as thana, COUNT(*) as freq, MAX(last_order_at) as last_seen")
            ->groupBy(DB::raw("NULLIF(TRIM(name), '')"), DB::raw("NULLIF(TRIM(address), '')"), DB::raw("NULLIF(TRIM(district), '')"), DB::raw("NULLIF(TRIM(thana), '')"))
            ->orderByDesc('freq')
            ->orderByDesc('last_seen')
            ->first();

        $fromOrders = Order::query()
            ->whereRaw("right(regexp_replace(customer_phone, '\\D', '', 'g'), 10) = ?", [$match10])
            ->where(function ($q) {
                $q->whereNotNull('customer_name')
                    ->orWhereNotNull('customer_address')
                    ->orWhereNotNull('customer_district')
                    ->orWhereNotNull('customer_thana');
            })
            ->selectRaw("NULLIF(TRIM(customer_name), '') as name, NULLIF(TRIM(customer_address), '') as address, NULLIF(TRIM(customer_district), '') as district, NULLIF(TRIM(customer_thana), '') as thana, COUNT(*) as freq, MAX(created_at) as last_seen")
            ->groupBy(DB::raw("NULLIF(TRIM(customer_name), '')"), DB::raw("NULLIF(TRIM(customer_address), '')"), DB::raw("NULLIF(TRIM(customer_district), '')"), DB::raw("NULLIF(TRIM(customer_thana), '')"))
            ->orderByDesc('freq')
            ->orderByDesc('last_seen')
            ->first();

        $profile = [
            'name'     => $fromCustomers?->name ?? $fromOrders?->name,
            'address'  => $fromCustomers?->address ?? $fromOrders?->address,
            'district' => $fromCustomers?->district ?? $fromOrders?->district,
            'thana'    => $fromCustomers?->thana ?? $fromOrders?->thana,
        ];

        $found = collect($profile)->filter(fn ($v) => filled($v))->isNotEmpty();

        return response()->json([
            'success' => true,
            'data'    => [
                'found'   => $found,
                'profile' => $found ? $profile : null,
                'shared'  => [
                    'total_orders' => (int) ($sharedStats->total_orders ?? 0),
                    'seller_count' => (int) ($sharedStats->seller_count ?? 0),
                ],
            ],
        ]);
    }

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
