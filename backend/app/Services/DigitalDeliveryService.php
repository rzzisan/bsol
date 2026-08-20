<?php

namespace App\Services;

use App\Models\DigitalDelivery;
use App\Models\DigitalProductSetting;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Support\FrontendUrl;
use Illuminate\Support\Str;

/**
 * Creates + delivers digital-product download links once an order is
 * actually paid, and gates the download itself behind an OTP for
 * hosted_file deliveries (anti-piracy — a shared link alone isn't enough).
 * See digital_product_context.md §2, §4, §7.
 *
 * Notification channels reuse the platform's shared NotificationDispatchService
 * (App\Services\NotificationDispatchService) — the ONLY working email/SMS
 * infra in this codebase (EmailConfiguration/NotificationTemplate/
 * NotificationUseCaseBinding are all admin-scoped, single-tenant-style —
 * there's no per-seller SMTP surface yet, correcting an earlier assumption
 * in digital_product_context.md §1খ). dispatch() must be called with an
 * *admin* User (to resolve the shared binding+template config), never the
 * seller/customer — see the platformAdmin() note below. The in-app download
 * page (linked from the order-status page) is always available regardless
 * of whether SMS/email actually send, so it's the one guaranteed channel.
 */
class DigitalDeliveryService
{
    private const OTP_TTL_MINUTES = 5;
    private const OTP_MAX_ATTEMPTS = 5;
    private const OTP_MAX_RESENDS = 3;
    private const OTP_RESEND_COOLDOWN_SECONDS = 60;

    public function __construct(
        private readonly NotificationDispatchService $notifications,
    ) {}

    /**
     * Called from OrderStatusService::transition() when an order reaches
     * 'confirmed' (payment recorded — automated gateway callback or a
     * seller-approved wallet claim, both funnel through
     * OnlinePaymentService::applyConfirmedPayment()). Idempotent: a
     * digital_deliveries row already existing for an order_item (unique
     * constraint) means "already delivered, don't re-notify".
     */
    public function deliverForOrder(Order $order): void
    {
        $items = $order->items()->with('product')->get()
            ->filter(fn ($item) => $item->product && $item->product->isDigital());

        if ($items->isEmpty()) {
            return;
        }

        $policy = DigitalProductSetting::effective();

        foreach ($items as $item) {
            if (DigitalDelivery::where('order_item_id', $item->id)->exists()) {
                continue;
            }

            $product = $item->product;
            $deliveryType = $product->digital_delivery_type ?: Product::DIGITAL_DELIVERY_HOSTED_FILE;

            $delivery = DigitalDelivery::create([
                'order_id' => $order->id,
                'order_item_id' => $item->id,
                'product_id' => $product->id,
                'user_id' => $order->user_id,
                'customer_phone' => $order->customer_phone,
                'customer_email' => $order->customer_email,
                'delivery_type' => $deliveryType,
                'external_url' => $deliveryType === Product::DIGITAL_DELIVERY_EXTERNAL_URL
                    ? $product->digital_external_url
                    : null,
                'download_token' => Str::random(48),
                'max_downloads' => $policy['max_downloads_per_purchase'],
                'expires_at' => now()->addHours($policy['download_link_expiry_hours']),
                'status' => DigitalDelivery::STATUS_DELIVERED,
            ]);

            $this->sendDeliveryLink($delivery, $order, $product);
        }
    }

    private function sendDeliveryLink(DigitalDelivery $delivery, Order $order, Product $product): void
    {
        $channels = (array) ($product->digital_delivery_channels ?: []);
        $admin = $this->platformAdmin();
        $delivered = [];

        if ($admin && (in_array('sms', $channels, true) || in_array('email', $channels, true))) {
            $link = FrontendUrl::forUserPath($order->user, 'd/' . $delivery->download_token);

            $result = $this->notifications->dispatch(
                $admin,
                'digital_product_delivered',
                in_array('sms', $channels, true) ? $delivery->customer_phone : null,
                in_array('email', $channels, true) ? $delivery->customer_email : null,
                [
                    'customer_name' => (string) ($order->customer_name ?: 'Customer'),
                    'product_name' => (string) $product->name,
                    'order_number' => (string) $order->order_number,
                    'download_link' => $link,
                ],
            );

            foreach ($result['results'] ?? [] as $row) {
                if (($row['status'] ?? null) === 'sent') {
                    $delivered[] = $row['channel'];
                }
            }
        }

        $delivery->update(['delivered_via' => $delivered]);
    }

    /**
     * Any admin resolves the shared binding+template config — see the
     * class docblock. NotificationUseCaseBinding rows are keyed by
     * whichever admin created them (adminScopeUserIds() shows the same
     * shared list to every admin), so the specific admin id doesn't matter.
     */
    private function platformAdmin(): ?User
    {
        return User::where('role', 'admin')->orderBy('id')->first();
    }

    // ── Public download flow (App\Http\Controllers\Api\DigitalDeliveryController) ──

    public function findByToken(string $token): ?DigitalDelivery
    {
        // hash_equals-safe lookup: the token column itself is the lookup
        // key (unique, random 48 chars) — no separate compare needed since
        // we're not comparing against a caller-supplied value here, we're
        // looking it up directly by it. hash_equals is used at the
        // controller layer when re-checking a caller-supplied token against
        // the resolved row, mirroring Order.public_token's convention.
        return DigitalDelivery::where('download_token', $token)->first();
    }

    public function sendOtp(DigitalDelivery $delivery): array
    {
        if ($delivery->otp_blocked_until && now()->lt($delivery->otp_blocked_until)) {
            return ['ok' => false, 'message' => 'too_many_requests', 'retry_after_seconds' => now()->diffInSeconds($delivery->otp_blocked_until)];
        }

        if ($delivery->otp_next_resend_at && now()->lt($delivery->otp_next_resend_at)) {
            return ['ok' => false, 'message' => 'cooldown', 'retry_after_seconds' => now()->diffInSeconds($delivery->otp_next_resend_at)];
        }

        if ($delivery->otp_resend_count >= self::OTP_MAX_RESENDS) {
            $delivery->update(['otp_blocked_until' => now()->addHour()]);
            return ['ok' => false, 'message' => 'limit_reached', 'retry_after_seconds' => 3600];
        }

        $channel = filled($delivery->customer_phone) ? 'sms' : (filled($delivery->customer_email) ? 'email' : null);
        if (! $channel) {
            return ['ok' => false, 'message' => 'no_recipient'];
        }

        $admin = $this->platformAdmin();
        if (! $admin) {
            return ['ok' => false, 'message' => 'send_failed'];
        }

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $result = $this->notifications->dispatch(
            $admin,
            'digital_download_otp',
            $channel === 'sms' ? $delivery->customer_phone : null,
            $channel === 'email' ? $delivery->customer_email : null,
            ['otp' => $otp, 'product_name' => (string) ($delivery->product?->name ?? '')],
        );

        $sent = collect($result['results'] ?? [])->contains(fn ($r) => ($r['status'] ?? null) === 'sent');
        if (! $sent) {
            return ['ok' => false, 'message' => 'send_failed'];
        }

        $delivery->update([
            'otp_code' => $otp,
            'otp_channel' => $channel,
            'otp_sent_at' => now(),
            'otp_attempts' => 0,
            'otp_resend_count' => $delivery->otp_resend_count + 1,
            'otp_next_resend_at' => now()->addSeconds(self::OTP_RESEND_COOLDOWN_SECONDS),
        ]);

        return ['ok' => true, 'channel' => $channel];
    }

    public function verifyOtp(DigitalDelivery $delivery, string $code): array
    {
        if ($delivery->isOtpVerified()) {
            return ['ok' => true, 'already_verified' => true];
        }

        if (! $delivery->otp_code || ! $delivery->otp_sent_at) {
            return ['ok' => false, 'message' => 'not_sent'];
        }

        if (now()->diffInMinutes($delivery->otp_sent_at) >= self::OTP_TTL_MINUTES) {
            return ['ok' => false, 'message' => 'expired'];
        }

        if ($delivery->otp_attempts >= self::OTP_MAX_ATTEMPTS) {
            return ['ok' => false, 'message' => 'max_attempts'];
        }

        $delivery->increment('otp_attempts');

        if (! hash_equals((string) $delivery->otp_code, $code)) {
            return ['ok' => false, 'message' => 'wrong_code', 'remaining_attempts' => max(0, self::OTP_MAX_ATTEMPTS - $delivery->otp_attempts)];
        }

        $delivery->update(['otp_verified_at' => now()]);

        return ['ok' => true];
    }

    public function recordDownload(DigitalDelivery $delivery, ?string $ip): void
    {
        $delivery->increment('download_count');
        $delivery->update([
            'last_downloaded_at' => now(),
            'last_download_ip' => $ip,
        ]);
    }
}
