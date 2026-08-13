<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PhoneOtpVerification;
use App\Services\CheckoutOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Plugin-facing checkout OTP verify/resend — /api/connect/v1/orders/*-otp.
 * The shopper types the code on WooCommerce's own order-received page; the
 * browser has no BSOL API key, so the WordPress plugin relays it server-side
 * (the same shape every other interactive Connect feature already uses,
 * just triggered from the storefront instead of wp-admin — see
 * class-bsol-checkout-otp.php). Delegates the actual state machine
 * (attempts/expiry/success) to CheckoutOtpService::verify()/resend(), the
 * same methods the landing-page flow uses — see Phase 9 in
 * wordpress_connect_context.md.
 *
 * No per-connection language setting exists yet for WooCommerce, so
 * messages are Bengali-only, matching the 'bn' default used everywhere
 * else in this connector.
 */
class ConnectCheckoutOtpController extends Controller
{
    private const MESSAGES = [
        'session_not_found' => 'OTP সেশন খুঁজে পাওয়া যায়নি।',
        'expired' => 'OTP-এর মেয়াদ শেষ হয়ে গেছে। আবার পাঠান।',
        'max_attempts' => 'সর্বোচ্চ চেষ্টার সীমা শেষ। আবার পাঠান।',
        'wrong_code' => 'ভুল OTP। আবার চেষ্টা করুন।',
        'resend_failed' => 'OTP পাঠানো যায়নি।',
        'resent' => 'OTP আবার পাঠানো হয়েছে।',
    ];

    public function __construct(
        private readonly CheckoutOtpService $checkoutOtpService,
    ) {}

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
            'otp_code' => 'required|string|max:10',
        ]);

        $order = $this->findOrder($data['wc_order_id']);
        if (! $order) {
            return $this->orderNotFound();
        }

        $result = $this->checkoutOtpService->verify($order, $data['otp_code'], self::MESSAGES);

        if (! $result['ok']) {
            return response()->json(array_filter([
                'success' => false,
                'message' => $result['message'],
                'remaining_attempts' => $result['remaining_attempts'] ?? null,
            ], fn ($v) => $v !== null), 422);
        }

        return response()->json([
            'success' => true,
            'data' => ['status' => $order->fresh()->status, 'otp_verified' => true],
        ]);
    }

    public function resend(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
        ]);

        $order = $this->findOrder($data['wc_order_id']);
        if (! $order) {
            return $this->orderNotFound();
        }

        if ($order->otp_verified_at) {
            return response()->json(['success' => true, 'data' => ['otp_verified' => true]]);
        }

        $record = PhoneOtpVerification::query()
            ->where('order_id', $order->id)
            ->where('purpose', 'checkout_verification')
            ->whereNull('verified_at')
            ->latest('id')
            ->first();

        if (! $record) {
            return response()->json(['success' => false, 'message' => self::MESSAGES['session_not_found']], 422);
        }

        $result = $this->checkoutOtpService->resend(['otp_verification_enabled' => true], $order, $record);

        if (! $result['ok']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'] ?? self::MESSAGES['resend_failed'],
                'retry_after_seconds' => $result['retry_after_seconds'] ?? null,
            ], 429);
        }

        return response()->json(['success' => true, 'message' => self::MESSAGES['resent']]);
    }

    private function findOrder(string $wcOrderId): ?Order
    {
        return Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->where('source', 'woocommerce')
            ->where('source_ref', $wcOrderId)
            ->first();
    }

    private function orderNotFound(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'No synced order found for this wc_order_id.',
            'error_code' => 'order_not_found',
        ], 404);
    }
}
