<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\OrderController;
use App\Http\Requests\StoreOrderRequest;
use App\Jobs\SendFacebookCapiPurchaseEventJob;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\AbandonedCheckoutService;
use App\Services\CheckoutOtpService;
use App\Services\OrderInvoicePdfService;
use App\Services\OrderStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

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
        private readonly CheckoutOtpService $checkoutOtpService,
        private readonly OrderInvoicePdfService $orderInvoicePdfService,
        private readonly AbandonedCheckoutService $abandonedCheckoutService,
    ) {}

    /**
     * Create-or-update, upserted on (user_id, source=woocommerce,
     * platform_api_key_id, source_ref=wc_order_id) — scoped to the
     * specific connected site, not just the seller, since two different
     * WooCommerce sites both number their own orders 1, 2, 3, ... from
     * scratch (Phase 16: a seller may have more than one connected).
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
            // Forwarded from WC_Order::get_customer_ip_address()/
            // get_customer_user_agent() — captured by WooCommerce itself at
            // checkout, not derivable from this server-to-server sync
            // request (which would just be the WordPress server's own IP).
            // Used for Facebook CAPI match quality — see the dispatch below.
            'client_ip'            => 'nullable|ip',
            'user_agent'           => 'nullable|string|max:500',
            'event_source_url'     => 'nullable|string|max:500',
            // Same source/reasoning as client_ip/user_agent — WooCommerce's
            // own first-party cookies on the checkout request, forwarded
            // as-is (never PII, never hashed). Persisted on the order (see
            // the follow-up update below) so order-flow events fired later
            // from OrderStatusService::transition() — which have no
            // checkout request behind them at all — can still carry them.
            'fbp'                  => 'nullable|string|max:255',
            'fbc'                  => 'nullable|string|max:255',
            // Set by the plugin's bulk/historical sync (Phase 11) — a
            // backfilled order that was actually placed weeks/months ago
            // shouldn't send a fresh checkout-OTP SMS or a fresh Facebook
            // Purchase event; both would be wrong for data that old. The
            // order itself is still created/updated normally either way.
            'is_historical_sync'   => 'nullable|boolean',
            // Set by the plugin's abandoned-checkout capture (Phase 17,
            // WC()->session-backed) when this order's checkout was
            // previously tracked as in-progress — lets that row flip to
            // "converted" instead of sitting abandoned forever.
            'session_token'        => 'nullable|string|max:64',
        ]);

        $merchant = auth()->user();
        $apiKey   = $request->attributes->get('platform_api_key');

        // Scoped by the specific site (platform_api_key_id), not just the
        // seller — two different WooCommerce sites both number their own
        // orders 1, 2, 3, ... from scratch, so matching on source_ref alone
        // would collide across a seller's connected sites (Phase 16).
        $order = Order::whereIn('user_id', $merchant->shopUserIds())
            ->where('source', 'woocommerce')
            ->where('platform_api_key_id', $apiKey?->id)
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

            $response = $this->orderController->store($formRequest);
            $responseData = json_decode($response->getContent(), true);

            if (! empty($responseData['success'])) {
                // OrderController::store() has its own hardcoded field list
                // (shared with the plain dashboard "create order manually"
                // path, where these columns must stay absent) — tag the
                // site and the match-quality identifiers with a narrow
                // follow-up write instead of threading them through there.
                Order::whereKey($responseData['data']['id'])->update([
                    'platform_api_key_id' => $apiKey?->id,
                    'fbp' => $data['fbp'] ?? null,
                    'fbc' => $data['fbc'] ?? null,
                ]);

                $isHistorical = ! empty($data['is_historical_sync']);
                $otpRequired = false;

                // All three side effects below are for a *live* new order
                // only — skipped entirely for a historical/bulk-sync
                // backfill (see the validation rule's docblock above). For
                // abandoned-checkout conversion specifically: a backfilled
                // order has no real session_token, and phone-only matching
                // against a bulk sync could incorrectly "convert" some
                // unrelated old abandoned-checkout row that just happens to
                // share a phone number.
                if (! $isHistorical) {
                    $newOrder = Order::find($responseData['data']['id']);

                    if ($newOrder) {
                        $this->abandonedCheckoutService->convertMatchingWooCommerce(
                            $merchant->shopOwnerId(),
                            $apiKey?->id,
                            $newOrder,
                            $data['session_token'] ?? null,
                            $data['customer_phone'],
                        );
                    }

                    if ($apiKey && $apiKey->otp_verification_enabled && $newOrder) {
                        $this->checkoutOtpService->maybeSendForOrder(['otp_verification_enabled' => true], $newOrder);
                        $otpRequired = (bool) $newOrder->fresh()->otp_required;
                    }

                    // Purchase event only — fires once, on creation, same as
                    // the landing-page checkout flow (LandingPageController).
                    // A safe no-op for any seller who hasn't configured
                    // Facebook CAPI (T2 — TrackingIngestService's own
                    // tracking_destinations lookup handles that).
                    SendFacebookCapiPurchaseEventJob::dispatch(
                        $responseData['data']['id'],
                        $data['client_ip'] ?? null,
                        $data['user_agent'] ?? null,
                        $data['event_source_url'] ?? ($apiKey ? "https://{$apiKey->domain}/" : ''),
                    );
                }

                $responseData['data']['otp_required'] = $otpRequired;

                return response()->json($responseData, $response->getStatusCode());
            }

            return $response;
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
        $apiKey   = $request->attributes->get('platform_api_key');

        $order = Order::whereIn('user_id', $merchant->shopUserIds())
            ->where('source', 'woocommerce')
            ->where('platform_api_key_id', $apiKey?->id)
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

    /**
     * Streams the seller->customer sales invoice PDF — distinct from the
     * courier waybill/sticker label (ConnectCourierController::waybill()).
     * Unlike waybill(), OrderController::invoicePdf() takes no Request/
     * options at all and has no courier-booking precondition — every
     * synced order the shop owns gets one, so this is a direct call
     * (same shape as ConnectCourierController::track() -> trackOrder()),
     * no synthetic Request needed.
     */
    public function invoicePdf(Request $request): Response
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
        ]);

        $apiKey = $request->attributes->get('platform_api_key');

        $order = Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->where('source', 'woocommerce')
            ->where('platform_api_key_id', $apiKey?->id)
            ->where('source_ref', (string) $data['wc_order_id'])
            ->first();

        if (! $order) {
            return response()->json([
                'success' => false,
                'message' => 'No synced order found for this wc_order_id.',
                'error_code' => 'order_not_found',
            ], 404);
        }

        return $this->orderController->invoicePdf($order->id, $this->orderInvoicePdfService);
    }
}
