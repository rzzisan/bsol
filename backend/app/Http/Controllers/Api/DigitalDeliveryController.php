<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DigitalDelivery;
use App\Services\DigitalDeliveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Public (no auth) — the customer only ever has the token from their
 * email/SMS/order-status page. See digital_product_context.md §7 for the
 * anti-piracy reasoning behind the OTP gate on hosted_file deliveries.
 */
class DigitalDeliveryController extends Controller
{
    public function __construct(
        private readonly DigitalDeliveryService $service,
    ) {}

    public function show(string $token): JsonResponse
    {
        $delivery = $this->resolve($token);

        return response()->json([
            'success' => true,
            'data' => [
                'product_name' => $delivery->product?->name,
                'delivery_type' => $delivery->delivery_type,
                'status' => $delivery->status,
                'expired' => $delivery->isExpired(),
                'downloads_used' => $delivery->download_count,
                'max_downloads' => $delivery->max_downloads,
                'otp_required' => $delivery->isOtpRequired(),
                'otp_verified' => $delivery->isOtpVerified(),
                'otp_sent' => $delivery->otp_sent_at !== null,
                // Masked contact so the OTP-send button can tell the
                // customer where the code will go without exposing the full
                // value to anyone who merely has the link.
                'otp_target' => $this->maskContact($delivery),
                'can_download' => $delivery->canDownload(),
            ],
        ]);
    }

    public function sendOtp(string $token): JsonResponse
    {
        $delivery = $this->resolve($token);

        if (! $delivery->isOtpRequired()) {
            return response()->json(['success' => true, 'message' => 'OTP not required for this delivery.']);
        }

        $result = $this->service->sendOtp($delivery);

        if (! $result['ok']) {
            $rateLimited = in_array($result['message'], ['cooldown', 'limit_reached', 'too_many_requests'], true);

            return response()->json([
                'success' => false,
                'message' => $result['message'],
                'retry_after_seconds' => $result['retry_after_seconds'] ?? null,
            ], $rateLimited ? 429 : 422);
        }

        return response()->json(['success' => true, 'data' => ['channel' => $result['channel']]]);
    }

    public function verifyOtp(Request $request, string $token): JsonResponse
    {
        $delivery = $this->resolve($token);

        $data = $request->validate([
            'otp_code' => ['required', 'string', 'max:10'],
        ]);

        $result = $this->service->verifyOtp($delivery, $data['otp_code']);

        if (! $result['ok']) {
            return response()->json(array_filter([
                'success' => false,
                'message' => $result['message'],
                'remaining_attempts' => $result['remaining_attempts'] ?? null,
            ], fn ($v) => $v !== null), 422);
        }

        return response()->json(['success' => true, 'data' => ['otp_verified' => true]]);
    }

    public function download(Request $request, string $token)
    {
        $delivery = $this->resolve($token);

        if (! $delivery->canDownload()) {
            abort(410, 'This download link is no longer valid.');
        }

        if ($delivery->delivery_type === DigitalDelivery::TYPE_EXTERNAL_URL) {
            $this->service->recordDownload($delivery, $request->ip());
            return redirect()->away((string) $delivery->external_url);
        }

        $product = $delivery->product;
        if (! $product || ! $product->digital_file_path || ! Storage::disk('local')->exists($product->digital_file_path)) {
            abort(404, 'File not found.');
        }

        $this->service->recordDownload($delivery, $request->ip());

        return Storage::disk('local')->download($product->digital_file_path, $product->digital_file_name ?: null);
    }

    private function resolve(string $token): DigitalDelivery
    {
        $delivery = $this->service->findByToken($token);

        // Same 404 for "not found" and "token doesn't match" — mirrors
        // Order.public_token's convention elsewhere in this codebase.
        if (! $delivery || ! hash_equals($delivery->download_token, $token)) {
            abort(404);
        }

        return $delivery->load('product');
    }

    private function maskContact(DigitalDelivery $delivery): ?string
    {
        if (filled($delivery->customer_phone)) {
            $phone = (string) $delivery->customer_phone;
            return substr($phone, 0, 4) . str_repeat('*', max(0, strlen($phone) - 6)) . substr($phone, -2);
        }

        if (filled($delivery->customer_email)) {
            [$name, $domain] = array_pad(explode('@', (string) $delivery->customer_email, 2), 2, '');
            $maskedName = strlen($name) > 2 ? substr($name, 0, 2) . str_repeat('*', strlen($name) - 2) : $name;
            return $maskedName . '@' . $domain;
        }

        return null;
    }
}
