<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentGatewayCredential;
use App\Services\OnlinePaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Plugin-facing customer online payment — /api/connect/v1/payment/*.
 * Delegates entirely to OnlinePaymentService, the exact same engine
 * landing-page checkout uses — no new payment logic here, only order
 * resolution + delegation, matching every other Connect controller. See
 * wordpress_connect_context.md's new "Payment gateways" phase and
 * online_payment_context.md.
 *
 * These are server-to-server calls (WordPress backend → BSOL) — the
 * shopper's browser never sees the API key. The actual off-site redirect
 * (for gateway_auto) is returned as a plain URL for the plugin's
 * process_payment() to hand back to WooCommerce, which does the browser
 * redirect itself.
 */
class ConnectPaymentController extends Controller
{
    public function __construct(
        private readonly OnlinePaymentService $onlinePaymentService,
    ) {}

    /** Shop-wide enabled channels — not page/site-scoped, unlike landing
     *  pages (PaymentGatewayCredential/PaymentGatewaySetting are already
     *  shop-wide; see online_payment_context.md decision on config scope).
     *  The plugin uses this to decide which WooCommerce payment methods to
     *  register at all. */
    public function channels(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();

        return response()->json([
            'success' => true,
            'data' => [
                'wallet_channels' => $this->onlinePaymentService->getEnabledWalletChannels($ownerId),
                'gateway_channels' => $this->onlinePaymentService->getEnabledGatewayChannels($ownerId),
            ],
        ]);
    }

    public function initiateGateway(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
            'provider' => ['required', Rule::in(PaymentGatewayCredential::PROVIDERS)],
        ]);

        $order = $this->findOrder($data['wc_order_id']);
        if (! $order) {
            return $this->orderNotFound();
        }

        try {
            $result = $this->onlinePaymentService->initiateGateway($order, $data['provider'], url('/api'));
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function walletClaim(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
            'provider' => ['required', Rule::in(['bkash', 'nagad', 'rocket'])],
            'sender_number' => ['required', 'string', 'max:20'],
            'customer_trx_id' => ['required', 'string', 'max:60'],
            'screenshot' => ['nullable', 'file', 'image', 'max:4096'],
        ]);

        $order = $this->findOrder($data['wc_order_id']);
        if (! $order) {
            return $this->orderNotFound();
        }

        try {
            $claim = $this->onlinePaymentService->submitWalletClaim(
                $order,
                $data['provider'],
                $data['sender_number'],
                $data['customer_trx_id'],
                $request->file('screenshot'),
            );
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'পেমেন্টের তথ্য পাঠানো হয়েছে। সেলার যাচাই করার পর কনফার্ম হবে।',
            'data' => ['status' => $claim->status],
        ], 201);
    }

    /** Same scoped-lookup shape as ConnectCourierController::findOrder() —
     *  by the specific connected site (platform_api_key_id), not just the
     *  seller (Phase 16). */
    private function findOrder(string $wcOrderId): ?Order
    {
        return Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->where('source', 'woocommerce')
            ->where('platform_api_key_id', optional(request()->attributes->get('platform_api_key'))->id)
            ->where('source_ref', $wcOrderId)
            ->first();
    }

    /**
     * A customer choosing one of our gateways at checkout implies
     * woocommerce_new_order already fired and synced this order — this
     * miss means that sync hasn't landed yet (network hiccup, WP-Cron
     * retry still pending). Clean local error rather than a cryptic
     * downstream failure (wordpress_connect_context.md decision #3) — the
     * plugin surfaces this as a normal "please try again" checkout error.
     */
    private function orderNotFound(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'No synced order found for this wc_order_id yet — it may still be syncing.',
            'error_code' => 'order_not_found',
        ], 404);
    }
}
