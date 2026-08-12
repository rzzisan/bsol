<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\OrderController;
use App\Http\Requests\StoreOrderRequest;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\OrderStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Plugin-facing order sync — /api/connect/v1/orders/{sync,sync-status}.
 * Delegates to the existing OrderController::store()/update() and
 * OrderStatusService::transition() rather than duplicating their business
 * logic (plan-limit gate, stock checks, ledger/SMS/customer-sync side
 * effects, inventory reservation). See bsol_history_and_new_context.md §5.
 */
class ConnectOrderController extends Controller
{
    public function __construct(
        private readonly OrderController $orderController,
        private readonly OrderStatusService $orderStatusService,
    ) {}

    /**
     * Create-or-update, upserted on (user_id, source=woocommerce, source_ref=wc_order_id).
     * Line items are intentionally not re-synced on update (would need
     * inventory-aware diffing — deferred to a later phase).
     */
    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_order_id'          => 'required|string|max:100',
            'customer_name'        => 'nullable|string|max:150',
            'customer_phone'       => 'required|string|max:20',
            'customer_email'       => 'nullable|string|max:150',
            'customer_address'     => 'nullable|string',
            'payment_method'       => 'nullable|string|max:50',
            'is_paid'              => 'nullable|boolean',
            'shipping_charge'      => 'nullable|numeric|min:0',
            'discount'             => 'nullable|numeric|min:0',
            'notes'                => 'nullable|string',
            'line_items'           => 'required|array|min:1',
            'line_items.*.name'    => 'required|string|max:255',
            'line_items.*.quantity'=> 'required|integer|min:1',
            'line_items.*.total'   => 'required|numeric|min:0',
            'line_items.*.sku'     => 'nullable|string|max:100',
        ]);

        $merchant = auth()->user();

        $order = Order::whereIn('user_id', $merchant->shopUserIds())
            ->where('source', 'woocommerce')
            ->where('source_ref', (string) $data['wc_order_id'])
            ->first();

        $isPaid = ! empty($data['is_paid']);
        $paymentMethod = ($data['payment_method'] ?? null) === 'cod' ? 'cod' : 'online';

        if (! $order) {
            $shopUserIds = $merchant->shopUserIds();

            $items = collect($data['line_items'])->map(function (array $lineItem) use ($shopUserIds) {
                $quantity = (int) $lineItem['quantity'];
                $unitPrice = $quantity > 0
                    ? round(((float) $lineItem['total']) / $quantity, 2)
                    : (float) $lineItem['total'];

                // Best-effort linkage to a real Product/ProductVariant by SKU
                // (populated once /products/sync has run for this seller) —
                // falls back to an unlinked ad-hoc line item on a miss, same
                // as before products/sync existed.
                $productId = null;
                $variantId = null;
                if (! empty($lineItem['sku'])) {
                    $variant = ProductVariant::whereHas('product', fn ($q) => $q->whereIn('user_id', $shopUserIds))
                        ->where('sku', $lineItem['sku'])
                        ->whereNull('deleted_at')
                        ->first();

                    if ($variant) {
                        $productId = $variant->product_id;
                        $variantId = $variant->id;
                    } else {
                        $productId = Product::whereIn('user_id', $shopUserIds)
                            ->where('sku', $lineItem['sku'])
                            ->whereNull('deleted_at')
                            ->value('id');
                    }
                }

                return [
                    'product_name'       => $lineItem['name'],
                    'sku'                => $lineItem['sku'] ?? null,
                    'quantity'           => $quantity,
                    'unit_price'         => $unitPrice,
                    'product_id'         => $productId,
                    'product_variant_id' => $variantId,
                ];
            })->values()->all();

            $payload = [
                'customer_name'    => $data['customer_name'] ?? null,
                'customer_phone'   => $data['customer_phone'],
                'customer_address' => $data['customer_address'] ?? null,
                'source'           => 'woocommerce',
                'source_ref'       => (string) $data['wc_order_id'],
                'payment_method'   => $paymentMethod,
                'payment_status'   => $isPaid ? 'paid' : 'due',
                'shipping_charge'  => $data['shipping_charge'] ?? 0,
                'discount'         => $data['discount'] ?? 0,
                'notes'            => $data['notes'] ?? null,
                'custom_fields'    => ['woocommerce' => $data],
                'items'            => $items,
            ];

            // Build a real StoreOrderRequest so OrderController::store() runs
            // exactly the same validated logic as a dashboard-created order —
            // order-number generation, monthly plan-limit gate, stock checks,
            // Customer::syncFromOrder(), PhoneIntelCache, AccountingService.
            $formRequest = StoreOrderRequest::create('/api/orders', 'POST', $payload);
            $formRequest->setContainer(app())->setRedirector(app('redirect'));
            $formRequest->validateResolved();

            return $this->orderController->store($formRequest);
        }

        $updatePayload = array_filter([
            'customer_name'    => $data['customer_name'] ?? null,
            'customer_phone'   => $data['customer_phone'] ?? null,
            'customer_address' => $data['customer_address'] ?? null,
            'payment_method'   => $paymentMethod,
            'payment_status'   => $isPaid ? 'paid' : 'due',
            'shipping_charge'  => $data['shipping_charge'] ?? null,
            'discount'         => $data['discount'] ?? null,
            'notes'            => $data['notes'] ?? null,
        ], fn ($value) => $value !== null);

        $updateRequest = Request::create('/api/orders/' . $order->id, 'PUT', $updatePayload);

        return $this->orderController->update($updateRequest, $order->id);
    }

    /**
     * BSOL-canonical status strings only (pending, confirmed, processing,
     * shipped, delivered, cancelled, returned) — mapping WooCommerce's own
     * status vocabulary onto these is the plugin's job, keeping this API
     * stable across future non-WooCommerce platforms too. See
     * bsol_history_and_new_context.md §5 open question #1.
     */
    public function syncStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
            'status'      => 'required|in:' . implode(',', OrderController::VALID_STATUSES),
            'note'        => 'nullable|string|max:500',
        ]);

        $merchant = auth()->user();

        $order = Order::whereIn('user_id', $merchant->shopUserIds())
            ->where('source', 'woocommerce')
            ->where('source_ref', (string) $data['wc_order_id'])
            ->first();

        if (! $order) {
            return response()->json([
                'success' => false,
                'message' => 'No synced order found for this wc_order_id.',
                'error_code' => 'order_not_found',
            ], 404);
        }

        $this->orderStatusService->transition(
            $order,
            $data['status'],
            $data['note'] ?? 'Synced from WooCommerce.',
            null,
        );

        return response()->json([
            'success' => true,
            'data' => [
                'id'           => $order->id,
                'order_number' => $order->order_number,
                'status'       => $order->status,
            ],
        ]);
    }
}
