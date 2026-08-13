<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\PhoneOtpVerification;
use App\Services\CheckoutOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CheckoutOtpController extends Controller
{
    // Customer-facing messages for the public thank-you page's OTP card — picked by content.settings.language.
    private const MESSAGES = [
        'bn' => [
            'session_not_found' => 'OTP সেশন খুঁজে পাওয়া যায়নি।',
            'expired' => 'OTP-এর মেয়াদ শেষ হয়ে গেছে। আবার পাঠান।',
            'max_attempts' => 'সর্বোচ্চ চেষ্টার সীমা শেষ। আবার পাঠান।',
            'wrong_code' => 'ভুল OTP। আবার চেষ্টা করুন।',
            'resend_failed' => 'OTP পাঠানো যায়নি।',
            'resent' => 'OTP আবার পাঠানো হয়েছে।',
        ],
        'en' => [
            'session_not_found' => 'OTP session not found.',
            'expired' => 'The OTP has expired. Please resend.',
            'max_attempts' => 'Maximum attempts reached. Please resend.',
            'wrong_code' => 'Incorrect OTP. Please try again.',
            'resend_failed' => 'OTP could not be sent.',
            'resent' => 'OTP has been resent.',
        ],
    ];

    public function __construct(
        private readonly CheckoutOtpService $checkoutOtpService,
    ) {}

    private function messages(LandingPage $page): array
    {
        $language = ($page->content['settings'] ?? [])['language'] ?? 'bn';
        return self::MESSAGES[$language] ?? self::MESSAGES['bn'];
    }

    public function verify(Request $request, string $slug, int $orderId): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'otp_code' => ['required', 'string', 'max:10'],
        ]);

        $page = $this->resolvePage($slug);
        $order = $this->resolveOrder($page, $orderId, $validated['token']);
        $messages = $this->messages($page);

        $result = $this->checkoutOtpService->verify($order, $validated['otp_code'], $messages);

        if (!$result['ok']) {
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

    public function resend(Request $request, string $slug, int $orderId): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:64'],
        ]);

        $page = $this->resolvePage($slug);
        $order = $this->resolveOrder($page, $orderId, $validated['token']);
        $messages = $this->messages($page);

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
            return response()->json(['success' => false, 'message' => $messages['session_not_found']], 422);
        }

        $result = $this->checkoutOtpService->resend($page->content['settings'] ?? [], $order, $record);

        if (!$result['ok']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'] ?? $messages['resend_failed'],
                'retry_after_seconds' => $result['retry_after_seconds'] ?? null,
            ], 429);
        }

        return response()->json(['success' => true, 'message' => $messages['resent']]);
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
