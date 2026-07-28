<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\PhoneOtpVerification;
use App\Services\CheckoutOtpService;
use App\Services\OrderStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CheckoutOtpController extends Controller
{
    public function __construct(
        private readonly CheckoutOtpService $checkoutOtpService,
        private readonly OrderStatusService $orderStatusService,
    ) {}

    public function verify(Request $request, string $slug, int $orderId): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'otp_code' => ['required', 'string', 'max:10'],
        ]);

        $page = $this->resolvePage($slug);
        $order = $this->resolveOrder($page, $orderId, $validated['token']);

        if ($order->otp_verified_at) {
            return response()->json([
                'success' => true,
                'data' => ['status' => $order->status, 'otp_verified' => true],
            ]);
        }

        $record = PhoneOtpVerification::query()
            ->where('order_id', $order->id)
            ->where('purpose', 'checkout_verification')
            ->whereNull('verified_at')
            ->latest('id')
            ->first();

        if (!$record) {
            return response()->json(['success' => false, 'message' => 'OTP সেশন খুঁজে পাওয়া যায়নি।'], 422);
        }

        if ($record->isExpired()) {
            return response()->json(['success' => false, 'message' => 'OTP-এর মেয়াদ শেষ হয়ে গেছে। আবার পাঠান।'], 422);
        }

        if ($record->attempts >= 5) {
            return response()->json(['success' => false, 'message' => 'সর্বোচ্চ চেষ্টার সীমা শেষ। আবার পাঠান।'], 422);
        }

        $record->increment('attempts');

        if ($record->otp_code !== $validated['otp_code']) {
            return response()->json([
                'success' => false,
                'message' => 'ভুল OTP। আবার চেষ্টা করুন।',
                'remaining_attempts' => max(0, 5 - $record->attempts),
            ], 422);
        }

        $record->update(['verified_at' => now()]);
        $order->update(['otp_verified_at' => now()]);
        $this->orderStatusService->transition($order, 'confirmed', 'Verified via checkout OTP.');

        return response()->json([
            'success' => true,
            'data' => ['status' => $order->fresh()->status, 'otp_verified' => true],
        ]);
    }

    public function resend(Request $request, string $slug, int $orderId): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:64'],
        ]);

        $page = $this->resolvePage($slug);
        $order = $this->resolveOrder($page, $orderId, $validated['token']);

        if ($order->otp_verified_at) {
            return response()->json(['success' => true, 'data' => ['otp_verified' => true]]);
        }

        $record = PhoneOtpVerification::query()
            ->where('order_id', $order->id)
            ->where('purpose', 'checkout_verification')
            ->whereNull('verified_at')
            ->latest('id')
            ->first();

        if (!$record) {
            return response()->json(['success' => false, 'message' => 'OTP সেশন খুঁজে পাওয়া যায়নি।'], 422);
        }

        $result = $this->checkoutOtpService->resend($page, $order, $record);

        if (!$result['ok']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'] ?? 'OTP পাঠানো যায়নি।',
                'retry_after_seconds' => $result['retry_after_seconds'] ?? null,
            ], 429);
        }

        return response()->json(['success' => true, 'message' => 'OTP আবার পাঠানো হয়েছে।']);
    }

    private function resolvePage(string $slug): LandingPage
    {
        return LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->firstOrFail();
    }

    private function resolveOrder(LandingPage $page, int $orderId, string $token): Order
    {
        $order = Order::query()
            ->with('items')
            ->where('id', $orderId)
            ->where('source', 'landing_page')
            ->where('source_ref', (string) $page->id)
            ->whereNotNull('public_token')
            ->first();

        // Same 404 for every failure mode — don't reveal which check failed.
        if (!$order || !hash_equals($order->public_token, $token)) {
            abort(404);
        }

        return $order;
    }
}
