<?php

namespace App\Services;

use App\Models\LandingPage;
use App\Models\Order;
use App\Models\PhoneOtpVerification;
use App\Models\SmsGateway;
use App\Models\SmsHistory;
use App\Models\User;
use Illuminate\Support\Facades\Http;

class CheckoutOtpService
{
    // Mirrors DEFAULT_SETTINGS.otp_sms_template in frontend/src/lib/landing-pages.ts.
    private const DEFAULT_SMS_TEMPLATE = 'আপনার অর্ডার #{order_number} কনফার্ম করতে {otp} কোডটি লিখুন। কোডটি ৫ মিনিটের জন্য বৈধ।';

    public function __construct(private readonly SmsCreditService $creditService) {}

    /**
     * Send a checkout-verification OTP for a freshly-created order, if the
     * landing page has the feature enabled and the merchant can actually
     * receive the SMS (gateway configured + enough credit). Any failure here
     * (no gateway, no credit, send failure) leaves the order untouched —
     * behaving exactly as if OTP verification were off for this order.
     */
    public function maybeSendForOrder(LandingPage $page, Order $order): void
    {
        $settings = $page->content['settings'] ?? [];
        if (!(bool) ($settings['otp_verification_enabled'] ?? false)) {
            return;
        }

        $user = User::find($page->user_id);
        if (!$user || !$user->sms_gateway_id) {
            return;
        }

        $gateway = SmsGateway::find($user->sms_gateway_id);
        if (!$this->gatewayIsUsable($gateway)) {
            return;
        }

        $recipient = $this->formatBdPhoneNumber((string) $order->customer_phone);
        if (!$recipient) {
            return;
        }

        $otp = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        $message = $this->renderOtpMessage($settings['otp_sms_template'] ?? null, $order, $otp);

        $creditsRequired = $this->creditService->calculateCreditsRequired($message);
        $balance = $this->creditService->getBalance($user->id);
        if ($balance < $creditsRequired) {
            // No SMS balance: feature behaves as if it were off for this order.
            return;
        }

        $sent = $this->send($gateway, $user, $recipient, $message);
        if (!$sent) {
            return;
        }

        $this->creditService->deduct(
            userId: $user->id,
            credits: $creditsRequired,
            note: "Checkout OTP for order {$order->order_number}",
        );

        PhoneOtpVerification::create([
            'token' => $order->public_token,
            'order_id' => $order->id,
            'mobile' => $recipient,
            'otp_code' => $otp,
            'purpose' => 'checkout_verification',
            'resend_count' => 0,
            'last_sent_at' => now(),
            'next_resend_at' => now()->addMinute(),
            'expires_at' => now()->addMinutes(5),
        ]);

        $order->update(['otp_required' => true]);
    }

    /**
     * Resend a fresh OTP for an order that already has an active verification
     * flow. Returns a result array the controller can turn into a response.
     *
     * @return array{ok: bool, message?: string, retry_after_seconds?: int}
     */
    public function resend(LandingPage $page, Order $order, PhoneOtpVerification $record): array
    {
        if ($record->blocked_until && now()->lt($record->blocked_until)) {
            return [
                'ok' => false,
                'message' => 'এই নম্বরটি অতিরিক্ত রিসেন্ড অনুরোধের কারণে ১ ঘণ্টার জন্য ব্লক করা হয়েছে।',
                'retry_after_seconds' => now()->diffInSeconds($record->blocked_until),
            ];
        }

        if ($record->isExpired()) {
            return ['ok' => false, 'message' => 'OTP-এর মেয়াদ শেষ হয়ে গেছে।'];
        }

        if ($record->resend_count >= 2) {
            $record->update(['blocked_until' => now()->addHour()]);
            return [
                'ok' => false,
                'message' => 'সর্বোচ্চ রিসেন্ড সীমা শেষ। এই নম্বরটি ১ ঘণ্টার জন্য ব্লক করা হয়েছে।',
                'retry_after_seconds' => 3600,
            ];
        }

        if ($record->next_resend_at && now()->lt($record->next_resend_at)) {
            return [
                'ok' => false,
                'message' => 'পরবর্তী OTP পাঠানোর আগে একটু অপেক্ষা করুন।',
                'retry_after_seconds' => now()->diffInSeconds($record->next_resend_at),
            ];
        }

        $user = User::find($order->user_id);
        $gateway = $user?->sms_gateway_id ? SmsGateway::find($user->sms_gateway_id) : null;
        if (!$user || !$this->gatewayIsUsable($gateway)) {
            return ['ok' => false, 'message' => 'SMS পাঠানো সম্ভব হচ্ছে না। অনুগ্রহ করে বিক্রেতার সাথে যোগাযোগ করুন।'];
        }

        $otp = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        $settings = $page->content['settings'] ?? [];
        $message = $this->renderOtpMessage($settings['otp_sms_template'] ?? null, $order, $otp);

        $creditsRequired = $this->creditService->calculateCreditsRequired($message);
        $balance = $this->creditService->getBalance($user->id);
        if ($balance < $creditsRequired) {
            return ['ok' => false, 'message' => 'SMS ব্যালেন্স নেই। অনুগ্রহ করে বিক্রেতার সাথে যোগাযোগ করুন।'];
        }

        $sent = $this->send($gateway, $user, (string) $record->mobile, $message);
        if (!$sent) {
            return ['ok' => false, 'message' => 'OTP পাঠানো ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'];
        }

        $this->creditService->deduct(
            userId: $user->id,
            credits: $creditsRequired,
            note: "Checkout OTP resend for order {$order->order_number}",
        );

        $nextResendCount = $record->resend_count + 1;
        $record->update([
            'otp_code' => $otp,
            'attempts' => 0,
            'resend_count' => $nextResendCount,
            'last_sent_at' => now(),
            'next_resend_at' => $nextResendCount === 1 ? now()->addMinutes(2) : null,
            'expires_at' => now()->addMinutes(5),
        ]);

        return ['ok' => true];
    }

    private function renderOtpMessage(?string $template, Order $order, string $otp): string
    {
        $template = trim((string) $template) ?: self::DEFAULT_SMS_TEMPLATE;

        $map = [
            '{customer_name}' => (string) ($order->customer_name ?: 'Customer'),
            '{order_number}' => (string) $order->order_number,
            '{order_total}' => number_format((float) $order->total, 2, '.', ''),
            '{order_items}' => $this->formatOrderItems($order),
            '{otp}' => $otp,
        ];

        return trim(strtr($template, $map));
    }

    private function formatOrderItems(Order $order): string
    {
        return $order->items
            ->map(fn ($item) => "{$item->product_name} x{$item->quantity}")
            ->implode(', ');
    }

    private function gatewayIsUsable(?SmsGateway $gateway): bool
    {
        return $gateway
            && $gateway->is_enabled
            && filled($gateway->endpoint_url)
            && filled($gateway->api_key)
            && filled($gateway->secret_key)
            && filled($gateway->sender_id)
            && $gateway->provider === 'khudebarta';
    }

    private function send(SmsGateway $gateway, User $user, string $recipient, string $message): bool
    {
        $response = Http::asForm()
            ->timeout(20)
            ->post($gateway->endpoint_url, [
                'apikey' => $gateway->api_key,
                'secretkey' => $gateway->secret_key,
                'callerID' => $gateway->sender_id,
                'toUser' => $recipient,
                'messageContent' => $message,
            ]);

        $body = (string) $response->body();
        $looksFailed = preg_match('/(error|failed|invalid|unauthorized)/i', $body) === 1;
        $ok = $response->successful() && !$looksFailed;

        SmsHistory::create([
            'gateway_id' => $gateway->id,
            'user_id' => $user->id,
            'gateway_name' => $gateway->name,
            'provider' => $gateway->provider,
            'phone_number' => $recipient,
            'message' => $message,
            'status' => $ok ? 'sent' : 'failed',
            'http_status_code' => $response->status(),
            'response_body' => mb_substr($body, 0, 4000),
            'error_message' => $ok ? null : 'Gateway responded with failure signal.',
            'sent_at' => $ok ? now() : null,
        ]);

        return $ok;
    }

    private function formatBdPhoneNumber(string $phone): ?string
    {
        $number = preg_replace('/[^0-9]/', '', $phone) ?? '';

        if (str_starts_with($number, '00880')) {
            $number = substr($number, 2);
        }

        if (str_starts_with($number, '880')) {
            // already normalized
        } elseif (str_starts_with($number, '01')) {
            $number = '88' . $number;
        } elseif (strlen($number) === 10 && str_starts_with($number, '1')) {
            $number = '880' . $number;
        } else {
            $number = '88' . $number;
        }

        return preg_match('/^8801[0-9]{9}$/', $number) === 1 ? $number : null;
    }
}
