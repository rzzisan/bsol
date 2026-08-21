<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentGatewayCredential;
use App\Services\OnlinePaymentService;
use App\Support\LandingPageResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Storefront online payment (S3b of seller_storefront_context.md §6/§12).
 * OnlinePaymentService itself needed no changes — it was already built
 * around a plain Order, never a LandingPage — only the controller-level
 * resolution (host instead of page slug, no per-page channel narrowing
 * since a storefront has no "page") is new. gatewayCallback/gatewayIpn
 * stay on OnlinePaymentController (one shared callback URL per provider,
 * source-agnostic — see its resolveRedirectUrl()).
 */
class StorefrontPaymentController extends Controller
{
    public function __construct(
        private readonly OnlinePaymentService $onlinePaymentService,
    ) {}

    public function channels(Request $request): JsonResponse
    {
        $ownerId = $this->ownerId($request);
        if ($ownerId === null) {
            return response()->json(['success' => false, 'message' => 'Unknown shop.'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'cod_enabled' => true,
                'wallet_channels' => $this->onlinePaymentService->getEnabledWalletChannels($ownerId),
                'gateway_channels' => $this->onlinePaymentService->getEnabledGatewayChannels($ownerId),
            ],
        ]);
    }

    public function initiateGateway(Request $request, string $token): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', Rule::in(PaymentGatewayCredential::PROVIDERS)],
        ]);

        $order = $this->resolveOrder($request, $token);
        $result = $this->onlinePaymentService->initiateGateway($order, $data['provider'], url('/api'));

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function submitWalletClaim(Request $request, string $token): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', Rule::in(['bkash', 'nagad', 'rocket'])],
            'sender_number' => ['required', 'string', 'max:20'],
            'customer_trx_id' => ['required', 'string', 'max:60'],
            'screenshot' => ['nullable', 'file', 'image', 'max:4096'],
        ]);

        $order = $this->resolveOrder($request, $token);

        $claim = $this->onlinePaymentService->submitWalletClaim(
            $order,
            $data['provider'],
            $data['sender_number'],
            $data['customer_trx_id'],
            $request->file('screenshot'),
        );

        return response()->json([
            'success' => true,
            'message' => 'পেমেন্টের তথ্য পাঠানো হয়েছে। সেলার যাচাই করার পর কনফার্ম হবে।',
            'data' => ['status' => $claim->status],
        ], 201);
    }

    private function resolveOrder(Request $request, string $token): Order
    {
        $shopUserIds = $this->shopUserIds($request);
        if ($shopUserIds === null) {
            abort(404);
        }

        // Token-in-URL direct lookup — same as
        // StorefrontCheckoutController::showOrder().
        $order = Order::whereIn('user_id', $shopUserIds)
            ->where('source', 'storefront')
            ->where('public_token', $token)
            ->first();

        if (! $order) {
            abort(404);
        }

        return $order;
    }

    private function ownerId(Request $request): ?int
    {
        $label = LandingPageResolver::subdomainLabel($request->getHost());
        return $label === null ? null : LandingPageResolver::shopOwnerIdForLabel($label);
    }

    /** @return array<int, int>|null */
    private function shopUserIds(Request $request): ?array
    {
        $label = LandingPageResolver::subdomainLabel($request->getHost());
        return $label === null ? null : LandingPageResolver::shopUserIdsForLabel($label);
    }
}
