<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrderRequest;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Services\AccountingService;
use App\Services\SmsAutomationService;
use App\Support\PhoneIntelCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function __construct(
        private readonly SmsAutomationService $smsAutomationService,
        private readonly AccountingService $accountingService,
    ) {}

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

    public function createBootstrap(): JsonResponse
    {
        $userId = auth()->id();
        $productColumns = $this->productSelectColumns();

        $products = Product::query()
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->withCount([
                'variants as active_variants_count' => fn ($q) => $q->where('is_active', true),
            ])
            ->orderBy('name')
            ->limit(200)
            ->get($productColumns);

        $categories = ProductCategory::query()
            ->where('user_id', $userId)
            ->select(['id', 'name'])
            ->orderBy('name')
            ->get();

        // Map products to array with all necessary fields including active_variants_count
        $productsArray = $products->map(function ($p) {
            return [
                'id' => $p->id,
                'name' => $p->name,
                'sku' => $p->sku,
                'regular_price' => $p->regular_price ?? $p->selling_price ?? 0,
                'discount' => $p->discount ?? 0,
                'discount_type' => $p->discount_type ?? 'amount',
                'selling_price' => $p->selling_price ?? 0,
                'stock' => $p->stock ?? 0,
                'track_stock' => (bool) ($p->track_stock ?? false),
                'thumbnail' => $p->thumbnail,
                'has_variants' => (bool) ($p->has_variants ?? false),
                'active_variants_count' => $p->active_variants_count ?? 0,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'products' => $productsArray,
                'categories' => $categories,
                'defaults' => [
                    'source' => 'manual',
                    'payment_method' => 'cod',
                    'payment_status' => 'due',
                    'status' => 'pending',
                ],
            ],
        ]);
    }

    public function store(StoreOrderRequest $request): JsonResponse
    {
        $data = $request->validated();

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
                'customer_area'     => $data['customer_area'] ?? null,
                'pathao_city_id'    => $data['pathao_city_id'] ?? null,
                'pathao_zone_id'    => $data['pathao_zone_id'] ?? null,
                'pathao_area_id'    => $data['pathao_area_id'] ?? null,
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

            $productIds = collect($data['items'])
                ->pluck('product_id')
                ->filter()
                ->unique()
                ->values();

            $productsById = Product::query()
                ->where('user_id', $userId)
                ->whereIn('id', $productIds)
                ->get($this->productOrderLookupColumns())
                ->keyBy('id');

            $variantIds = collect($data['items'])
                ->pluck('product_variant_id')
                ->filter()
                ->unique()
                ->values();

            $variantsById = ProductVariant::query()
                ->whereIn('id', $variantIds)
                ->whereNull('deleted_at')
                ->get(['id', 'product_id', 'sku', 'regular_price', 'discount', 'discount_type', 'selling_price', 'stock_qty', 'is_active'])
                ->keyBy('id');

            foreach ($data['items'] as $item) {
                $productModel = null;
                $variantModel = null;
                if (!empty($item['product_id'])) {
                    $productModel = $productsById->get((int) $item['product_id']);
                    if (!$productModel) {
                        throw ValidationException::withMessages([
                            'items' => ['One or more selected products are invalid for this account.'],
                        ]);
                    }
                }

                if (!empty($item['product_variant_id'])) {
                    $variantModel = $variantsById->get((int) $item['product_variant_id']);
                    if (!$variantModel) {
                        throw ValidationException::withMessages([
                            'items' => ['One or more selected variants are invalid.'],
                        ]);
                    }
                    if (!empty($item['product_id']) && (int) $variantModel->product_id !== (int) $item['product_id']) {
                        throw ValidationException::withMessages([
                            'items' => ['Selected variant does not belong to the selected product.'],
                        ]);
                    }
                    if (!$variantModel->is_active) {
                        throw ValidationException::withMessages([
                            'items' => ['One or more selected variants are inactive.'],
                        ]);
                    }
                }

                $regularPrice = isset($item['regular_price'])
                    ? (float) $item['regular_price']
                    : (float) ($variantModel?->regular_price ?? $productModel?->regular_price ?? $item['unit_price']);
                $discountValue = isset($item['discount'])
                    ? (float) $item['discount']
                    : (float) ($variantModel?->discount ?? $productModel?->discount ?? 0);
                $discountType = (string) ($item['discount_type'] ?? ($variantModel?->discount_type ?? $productModel?->discount_type ?? 'amount'));

                if ($variantModel && (int) $item['quantity'] > (int) $variantModel->stock_qty) {
                    throw ValidationException::withMessages([
                        'items' => ["Insufficient stock for variant SKU {$variantModel->sku}."],
                    ]);
                }

                if ($discountType === 'percent' && $discountValue > 100) {
                    throw ValidationException::withMessages([
                        'items' => ['Discount percent cannot be more than 100.'],
                    ]);
                }

                OrderItem::create([
                    'order_id'     => $order->id,
                    'product_id'   => $item['product_id'] ?? null,
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'product_name' => $item['product_name'],
                    'sku'          => $item['sku'] ?? $variantModel?->sku ?? null,
                    'quantity'     => $item['quantity'],
                    'regular_price'=> $regularPrice,
                    'discount'     => $discountValue,
                    'discount_type'=> $discountType,
                    'unit_price'   => $item['unit_price'] ?? (float) ($variantModel?->selling_price ?? 0),
                    'total'        => $item['quantity'] * ($item['unit_price'] ?? (float) ($variantModel?->selling_price ?? 0)),
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
            PhoneIntelCache::bump($order->customer_phone);

            $this->accountingService->onOrderCreated($order);
            $this->accountingService->onCourierChargeUpdated($order);

            return response()->json(['success' => true, 'data' => $order], 201);
        });
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function show(int $id): JsonResponse
    {
        $order = Order::where('user_id', auth()->id())
            ->with(['items.product:id,thumbnail', 'items.variant:id,sku,image_url', 'statusLogs.changedByUser:id,name'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $order]);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function update(Request $request, int $id): JsonResponse
    {
        $order = Order::where('user_id', auth()->id())->findOrFail($id);
        $oldPhone = $order->customer_phone;

        $data = $request->validate([
            'customer_name'       => 'nullable|string|max:150',
            'customer_phone'      => 'sometimes|required|string|max:20',
            'customer_address'    => 'nullable|string',
            'customer_district'   => 'nullable|string|max:100',
            'customer_thana'      => 'nullable|string|max:100',
            'customer_area'       => 'nullable|string|max:120',
            'pathao_city_id'      => 'nullable|integer',
            'pathao_zone_id'      => 'nullable|integer',
            'pathao_area_id'      => 'nullable|integer',
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

        PhoneIntelCache::bump($oldPhone);
        PhoneIntelCache::bump($order->customer_phone);

        if (array_key_exists('courier_charge', $data)) {
            $this->accountingService->onCourierChargeUpdated($order);
        }

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
        PhoneIntelCache::bump($order->customer_phone);

        $this->adjustVariantInventoryForStatusTransition($order, $oldStatus, $data['status']);

        OrderStatusLog::create([
            'order_id'   => $order->id,
            'old_status' => $oldStatus,
            'new_status' => $data['status'],
            'note'       => $data['note'] ?? null,
            'changed_by' => auth()->id(),
        ]);

        $this->smsAutomationService->handleOrderStatusChanged($order, $oldStatus, $data['status']);

        if ($data['status'] === 'delivered') {
            $this->accountingService->onOrderDelivered($order);
        }

        if (in_array($data['status'], ['cancelled', 'returned'], true)) {
            $this->accountingService->onOrderCancelledOrReturned($order);
        }

        return response()->json(['success' => true, 'data' => $order]);
    }

    private function adjustVariantInventoryForStatusTransition(Order $order, string $oldStatus, string $newStatus): void
    {
        $reserveStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];
        $releaseStatuses = ['cancelled', 'returned'];

        $wasReserved = in_array($oldStatus, $reserveStatuses, true);
        $isReserved  = in_array($newStatus, $reserveStatuses, true);

        if (!$wasReserved && $isReserved) {
            foreach ($order->items()->whereNotNull('product_variant_id')->get() as $item) {
                ProductVariant::where('id', $item->product_variant_id)
                    ->whereNull('deleted_at')
                    ->decrement('stock_qty', (int) $item->quantity);
            }
            return;
        }

        if ($wasReserved && in_array($newStatus, $releaseStatuses, true)) {
            foreach ($order->items()->whereNotNull('product_variant_id')->get() as $item) {
                ProductVariant::where('id', $item->product_variant_id)
                    ->whereNull('deleted_at')
                    ->increment('stock_qty', (int) $item->quantity);
            }
        }
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
            PhoneIntelCache::bump($order->customer_phone);
            OrderStatusLog::create([
                'order_id'   => $order->id,
                'old_status' => $old,
                'new_status' => $data['status'],
                'note'       => $data['note'] ?? 'Bulk update.',
                'changed_by' => auth()->id(),
            ]);

            $this->smsAutomationService->handleOrderStatusChanged($order, $old, $data['status']);

            if ($data['status'] === 'delivered') {
                $this->accountingService->onOrderDelivered($order);
            }

            if (in_array($data['status'], ['cancelled', 'returned'], true)) {
                $this->accountingService->onOrderCancelledOrReturned($order);
            }
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
        $phone = $order->customer_phone;
        $order->delete();
        PhoneIntelCache::bump($phone);

        return response()->json(['success' => true, 'message' => 'Order deleted.']);
    }

    /**
     * @return array<int, string>
     */
    private function productSelectColumns(): array
    {
        $columns = ['id', 'name', 'sku', 'selling_price', 'stock', 'track_stock', 'thumbnail'];

        foreach (['regular_price', 'discount', 'discount_type', 'has_variants'] as $optionalColumn) {
            if (Schema::hasColumn('products', $optionalColumn)) {
                $columns[] = $optionalColumn;
            }
        }

        return $columns;
    }

    /**
     * @return array<int, string>
     */
    private function productOrderLookupColumns(): array
    {
        $columns = ['id', 'selling_price'];

        foreach (['regular_price', 'discount', 'discount_type', 'has_variants'] as $optionalColumn) {
            if (Schema::hasColumn('products', $optionalColumn)) {
                $columns[] = $optionalColumn;
            }
        }

        return $columns;
    }
}
