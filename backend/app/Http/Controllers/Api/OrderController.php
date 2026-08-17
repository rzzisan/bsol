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
use App\Models\TrackingEvent;
use App\Services\AccountingService;
use App\Services\OrderInvoicePdfService;
use App\Services\OrderStatusService;
use App\Support\PhoneIntelCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class OrderController extends Controller
{
    public function __construct(
        private readonly AccountingService $accountingService,
        private readonly OrderStatusService $orderStatusService,
    ) {}

    // Public: single source of truth for BSOL's canonical status vocabulary —
    // also referenced directly by Api\Connect\ConnectOrderController::syncStatus()
    // rather than duplicated (bsol_history_and_new_context.md §5).
    public const VALID_STATUSES = [
        'pending', 'confirmed', 'processing', 'shipped',
        'delivered', 'cancelled', 'returned',
    ];

    // ── List ──────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Order::whereIn('user_id', auth()->user()->shopUserIds())
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
        if ($request->filled('platform_api_key_id')) {
            $query->where('platform_api_key_id', $request->platform_api_key_id);
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
        $orders  = $query->withPaymentTotals()->orderByDesc('created_at')->paginate($perPage);
        Order::attachDueAmounts($orders->getCollection());

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
        $shopUserIds = auth()->user()->shopUserIds();

        $counts = Order::whereIn('user_id', $shopUserIds)
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

        $today = Order::whereIn('user_id', $shopUserIds)
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
        $shopUserIds = auth()->user()->shopUserIds();
        $productColumns = $this->productSelectColumns();

        $products = Product::query()
            ->whereIn('user_id', $shopUserIds)
            ->where('status', 'active')
            ->withCount([
                'variants as active_variants_count' => fn ($q) => $q->where('is_active', true),
            ])
            ->orderBy('name')
            ->limit(200)
            ->get($productColumns);

        $categories = ProductCategory::query()
            ->whereIn('user_id', $shopUserIds)
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
        // Order.user_id is deliberately always the shop OWNER id (like
        // Customer.user_id, staff_team_role_context.md §3.3) — not the acting
        // staff member — because courier booking/tracking providers resolve
        // CourierSetting credentials via $order->user_id (see
        // app/Services/Courier/*CourierProvider.php), and those credentials
        // only ever exist under the owner's account (Pattern B). The actual
        // creator is still recorded for audit via OrderStatusLog.changed_by
        // below (kept as the real acting user).
        $actingUserId = auth()->id();
        $ownerId = auth()->user()->shopOwnerId();
        $shopUserIds = auth()->user()->shopUserIds();

        $maxOrders = auth()->user()->shopOwner()->subscriptionPackage?->max_orders;
        if ($maxOrders !== null) {
            $ordersThisMonth = Order::whereIn('user_id', $shopUserIds)
                ->whereYear('created_at', now()->year)
                ->whereMonth('created_at', now()->month)
                ->count();

            if ($ordersThisMonth >= $maxOrders) {
                return response()->json([
                    'success' => false,
                    'message' => 'Monthly order limit reached for your current plan. Please upgrade to create more orders.',
                    'error_code' => 'order_limit_reached',
                ], 402);
            }
        }

        return DB::transaction(function () use ($data, $actingUserId, $ownerId, $shopUserIds) {

            // Compute totals
            $subtotal = collect($data['items'])->sum(
                fn($item) => $item['quantity'] * $item['unit_price']
            );
            $shippingCharge = (float) ($data['shipping_charge'] ?? 0);
            $discount       = (float) ($data['discount'] ?? 0);
            $total          = max(0, $subtotal + $shippingCharge - $discount);

            $order = Order::create([
                'user_id'           => $ownerId,
                'order_number'      => Order::generateOrderNumber($shopUserIds),
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
                'custom_fields'     => $data['custom_fields'] ?? null,
                'fraud_score'       => 0,
                'risk_level'        => 'low',
            ]);

            $productIds = collect($data['items'])
                ->pluck('product_id')
                ->filter()
                ->unique()
                ->values();

            $productsById = Product::query()
                ->whereIn('user_id', $shopUserIds)
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
                'changed_by' => $actingUserId,
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
        $order = Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->with(['items.product:id,thumbnail', 'items.variant:id,sku,image_url', 'statusLogs.changedByUser:id,name', 'trackingEvents'])
            ->findOrFail($id);

        $payload = $order->toArray();
        // Trimmed, not the raw model — user_data_hashed is sha256 digests
        // plus fbp/fbc, but there's no reason to ship the whole blob to the
        // browser when only "did this event have Meta's strongest match
        // signals" matters here (tracking_capi_context.md §9, T7).
        $payload['tracking_events'] = $order->trackingEvents->map(fn (TrackingEvent $e) => [
            'event_name' => $e->event_name,
            'event_time' => $e->event_time,
            'status' => $e->status,
            'has_fbp' => isset($e->user_data_hashed['fbp']),
            'has_fbc' => isset($e->user_data_hashed['fbc']),
        ])->all();

        return response()->json(['success' => true, 'data' => $payload]);
    }

    public function invoicePdf(int $id, OrderInvoicePdfService $service): Response
    {
        $order = Order::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        return $service->render($order)
            ->stream("invoice-{$order->order_number}.pdf")
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function update(Request $request, int $id): JsonResponse
    {
        $order = Order::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);
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

        if (array_key_exists('total', $data)) {
            $this->accountingService->onOrderTotalUpdated($order);
        }

        return response()->json(['success' => true, 'data' => $order]);
    }

    // ── Status Change ─────────────────────────────────────────────────────────

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $order = Order::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        $data = $request->validate([
            'status' => 'required|in:' . implode(',', self::VALID_STATUSES),
            'note'   => 'nullable|string|max:500',
        ]);

        $this->orderStatusService->transition(
            $order,
            $data['status'],
            $data['note'] ?? null,
            auth()->id(),
        );

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

        $orders = Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->whereIn('id', $data['ids'])
            ->get();

        $updated = 0;
        $failed = [];

        foreach ($orders as $order) {
            try {
                $this->orderStatusService->transition(
                    $order,
                    $data['status'],
                    $data['note'] ?? 'Bulk update.',
                    auth()->id(),
                );
                $updated++;
            } catch (ValidationException $e) {
                // Insufficient stock on this order shouldn't block the rest
                // of the batch — record it and keep going.
                $failed[] = [
                    'id'           => $order->id,
                    'order_number' => $order->order_number,
                    'message'      => $e->getMessage(),
                ];
            }
        }

        $message = $updated . ' orders updated.';
        if ($failed) {
            $message .= ' ' . count($failed) . ' skipped (insufficient stock).';
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'failed'  => $failed,
        ]);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function destroy(int $id): JsonResponse
    {
        $order = Order::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);
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
