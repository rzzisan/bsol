<?php

namespace App\Jobs;

use App\Models\FacebookPixelSetting;
use App\Models\Order;
use App\Services\Facebook\FacebookCapiClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Sends a server-side Purchase event to the seller's own Facebook Pixel
 * (Conversions API) after a landing-page checkout completes — §6 item 4 in
 * facebook_integration_context.md. Queued (not sync, unlike the webhook
 * receiver) because this makes a real outbound HTTP call to Meta and
 * checkout shouldn't wait on it; the queue worker is confirmed running
 * (§4 of the same doc).
 */
class SendFacebookCapiPurchaseEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        private readonly int $orderId,
        private readonly ?string $clientIp,
        private readonly ?string $userAgent,
        private readonly string $eventSourceUrl,
    ) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(FacebookCapiClient $capi): void
    {
        $order = Order::with('items')->find($this->orderId);
        if (! $order) {
            return;
        }

        $settings = FacebookPixelSetting::where('user_id', $order->user_id)
            ->where('enabled', true)
            ->first();

        if (! $settings || ! $settings->pixel_id || ! $settings->access_token) {
            return;
        }

        $userData = array_filter([
            'ph' => [hash('sha256', $this->normalizePhone($order->customer_phone))],
            'client_ip_address' => $this->clientIp,
            'client_user_agent' => $this->userAgent,
        ]);

        $eventData = [
            'event_name' => 'Purchase',
            'event_time' => $order->created_at->timestamp,
            // Stable per-order id — lets a client-side Pixel Purchase event
            // (if the seller ever adds one) dedupe against this CAPI event.
            'event_id' => 'order_' . $order->id,
            'action_source' => 'website',
            'event_source_url' => $this->eventSourceUrl,
            'user_data' => $userData,
            'custom_data' => [
                'currency' => 'BDT',
                'value' => (float) $order->total,
                'num_items' => (int) $order->items->sum('quantity'),
                'content_ids' => $order->items->pluck('product_id')->filter()->values()->all(),
                'content_type' => 'product',
            ],
        ];

        $ok = $capi->sendEvent($settings->pixel_id, $settings->access_token, $eventData, $settings->test_event_code ?: null);

        $settings->update([
            'last_sent_at' => now(),
            'last_error' => $ok ? null : 'Facebook rejected the last Purchase event — check the Pixel ID / Access Token in Events Manager.',
        ]);
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if (str_starts_with($digits, '880')) {
            return $digits;
        }

        return '880' . ltrim($digits, '0');
    }
}
