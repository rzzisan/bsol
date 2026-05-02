<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    private const VALID_STATUSES = [
        'pending', 'confirmed', 'processing', 'shipped',
        'delivered', 'cancelled', 'returned',
    ];

    // ── List ──────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Order::where('user_id', auth()->id())
            ->with(['items:id,order_id,product_name,quantity,unit_price,total']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('risk_level')) {
            $query->where('risk_level', $request->risk_level);
        }
        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }
        if ($request->filled('source')) {
            $query->where('source', $request->source);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }
        if ($request->filled('search')) {
            $s = '%' . $request->search . '%';
            $query->where(function ($q) use ($s) {
                $q->where('order_number', 'ilike', $s)
                  ->orWhere('customer_name', 'ilike', $s)
                  ->orWhere('customer_phone', 'ilike', $s);
            });
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $orders  = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $orders->items(),
            'meta'    => [
                'total'        => $orders->total(),
                'current_page' => $orders->currentPage(),
                'last_page'    => $orders->lastPage(),
                'per_page'     => $orders->perPage(),
            ],
        ]);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    public function stats(): JsonResponse
    {
        $userId = auth()->id();

        $counts = Order::where('user_id', $userId)
            ->selectRaw("
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
                COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
                COUNT(*) FILTER (WHERE status = 'processing') AS processing,
                COUNT(*) FILTER (WHERE status = 'shipped')   AS shipped,
                COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
                COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                COUNT(*) FILTER (WHERE status = 'returned')  AS returned,
                COUNT(*) FILTER (WHERE risk_level = 'high')  AS high_risk,
                COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0) AS total_revenue
            ")
            ->first();

        $today = Order::where('user_id', $userId)
            ->whereDate('created_at', today())
            ->count();

        return response()->json([
            'success' => true,
            'data'    => array_merge($counts->toArray(), ['today' => $today]),
        ]);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_name'     => 'nullable|string|max:150',
            'customer_phone'    => 'required|string|max:20',
            'customer_address'  => 'nullable|string',
            'customer_district' => 'nullable|string|max:100',
            'customer_thana'    => 'nullable|string|max:100',
            'source'            => 'nullable|in:manual,facebook_inbox,landing_page',
            'source_ref'        => 'nullable|string|max:255',
            'payment_method'    => 'nullable|in:cod,online,bkash',
            'payment_status'    => 'nullable|in:due,partial,paid',
            'shipping_charge'   => 'nullable|numeric|min:0',
            'discount'          => 'nullable|numeric|min:0',
            'notes'             => 'nullable|string',
            'items'             => 'required|array|min:1',
            'items.*.product_name' => 'required|string|max:255',
            'items.*.product_id'   => 'nullable|integer|exists:products,id',
            'items.*.sku'          => 'nullable|string|max:100',
            'items.*.quantity'     => 'required|integer|min:1',
            'items.*.unit_price'   => 'required|numeric|min:0',
            'items.*.variant_info' => 'nullable|array',
        ]);

        return DB::transaction(function () use ($data) {
            $userId = auth()->id();

            // Compute totals
            $subtotal = collect($data['items'])->sum(
                fn($item) => $item['quantity'] * $item['unit_price']
            );
            $shippingCharge = (float) ($data['shipping_charge'] ?? 0);
            $discount       = (float) ($data['discount'] ?? 0);
            $total          = max(0, $subtotal + $shippingCharge - $discount);

            $order = Order::create([
                'user_id'           => $userId,
                'order_number'      => Order::generateOrderNumber($userId),
                'customer_name'     => $data['customer_name'] ?? null,
                'customer_phone'    => $data['customer_phone'],
                'customer_address'  => $data['customer_address'] ?? null,
                'customer_district' => $data['customer_district'] ?? null,
                'customer_thana'    => $data['customer_thana'] ?? null,
                'source'            => $data['source'] ?? 'manual',
                'source_ref'        => $data['source_ref'] ?? null,
                'status'            => 'pending',
                'payment_method'    => $data['payment_method'] ?? 'cod',
                'payment_status'    => $data['payment_status'] ?? 'due',
                'subtotal'          => $subtotal,
                'shipping_charge'   => $shippingCharge,
                'discount'          => $discount,
                'total'             => $total,
                'notes'             => $data['notes'] ?? null,
                'fraud_score'       => 0,
                'risk_level'        => 'low',
            ]);

            foreach ($data['items'] as $item) {
                OrderItem::create([
                    'order_id'     => $order->id,
                    'product_id'   => $item['product_id'] ?? null,
                    'product_name' => $item['product_name'],
                    'sku'          => $item['sku'] ?? null,
                    'quantity'     => $item['quantity'],
                    'unit_price'   => $item['unit_price'],
                    'total'        => $item['quantity'] * $item['unit_price'],
                    'variant_info' => $item['variant_info'] ?? null,
                ]);
            }

            // Initial status log
            OrderStatusLog::create([
                'order_id'   => $order->id,
                'old_status' => null,
                'new_status' => 'pending',
                'note'       => 'Order created.',
                'changed_by' => $userId,
            ]);

            $order->load(['items', 'statusLogs']);

            // Upsert customer aggregate
            \App\Models\Customer::syncFromOrder($order);

            return response()->json(['success' => true, 'data' => $order], 201);
        });
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function show(int $id): JsonResponse
    {
        $order = Order::where('user_id', auth()->id())
            ->with(['items', 'statusLogs.changedByUser:id,name'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $order]);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function update(Request $request, int $id): JsonResponse
    {
        $order = Order::where('user_id', auth()->id())->findOrFail($id);

        $data = $request->validate([
            'customer_name'       => 'nullable|string|max:150',
            'customer_phone'      => 'sometimes|required|string|max:20',
            'customer_address'    => 'nullable|string',
            'customer_district'   => 'nullable|string|max:100',
            'customer_thana'      => 'nullable|string|max:100',
            'payment_method'      => 'nullable|in:cod,online,bkash',
            'payment_status'      => 'nullable|in:due,partial,paid',
            'shipping_charge'     => 'nullable|numeric|min:0',
            'discount'            => 'nullable|numeric|min:0',
            'notes'               => 'nullable|string',
            'courier_name'        => 'nullable|string|max:50',
            'courier_tracking_id' => 'nullable|string|max:100',
            'courier_status'      => 'nullable|string|max:50',
            'courier_charge'      => 'nullable|numeric|min:0',
        ]);

        // Recalculate total if amounts changed
        if (isset($data['shipping_charge']) || isset($data['discount'])) {
            $shipping = $data['shipping_charge'] ?? $order->shipping_charge;
            $discount = $data['discount'] ?? $order->discount;
            $data['total'] = max(0, $order->subtotal + $shipping - $discount);
        }

        $order->update($data);

        return response()->json(['success' => true, 'data' => $order]);
    }

    // ── Status Change ─────────────────────────────────────────────────────────

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $order = Order::where('user_id', auth()->id())->findOrFail($id);

        $data = $request->validate([
            'status' => 'required|in:' . implode(',', self::VALID_STATUSES),
            'note'   => 'nullable|string|max:500',
        ]);

        $oldStatus = $order->status;
        $order->update(['status' => $data['status']]);

        OrderStatusLog::create([
            'order_id'   => $order->id,
            'old_status' => $oldStatus,
            'new_status' => $data['status'],
            'note'       => $data['note'] ?? null,
            'changed_by' => auth()->id(),
        ]);

        return response()->json(['success' => true, 'data' => $order]);
    }

    // ── Bulk Status ───────────────────────────────────────────────────────────

    public function bulkStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'    => 'required|array|min:1',
            'ids.*'  => 'integer',
            'status' => 'required|in:' . implode(',', self::VALID_STATUSES),
            'note'   => 'nullable|string|max:500',
        ]);

        $orders = Order::where('user_id', auth()->id())
            ->whereIn('id', $data['ids'])
            ->get();

        foreach ($orders as $order) {
            $old = $order->status;
            $order->update(['status' => $data['status']]);
            OrderStatusLog::create([
                'order_id'   => $order->id,
                'old_status' => $old,
                'new_status' => $data['status'],
                'note'       => $data['note'] ?? 'Bulk update.',
                'changed_by' => auth()->id(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => $orders->count() . ' orders updated.',
        ]);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function destroy(int $id): JsonResponse
    {
        $order = Order::where('user_id', auth()->id())->findOrFail($id);
        $order->delete();

        return response()->json(['success' => true, 'message' => 'Order deleted.']);
    }
}
