<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\PlatformApiKey;
use App\Services\WooCommercePaymentPushService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Dispatched by OnlinePaymentService::applyConfirmedPayment() whenever a
 * woocommerce-sourced order's online payment is confirmed (wallet-claim
 * approve, or a gateway_auto callback — applyConfirmedPayment() is the
 * single shared cascade for both). Queued for the same reason as every
 * other outbound-HTTP job in this codebase (PushWooCommerceStockJob) — a
 * real network call shouldn't block the request/transaction that
 * confirmed the payment.
 */
class PushWooCommercePaymentStatusJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        private readonly int $orderId,
        private readonly string $method,
        private readonly ?string $trxId,
        private readonly float $amount,
    ) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(WooCommercePaymentPushService $service): void
    {
        $order = Order::find($this->orderId);
        if (! $order || $order->source !== 'woocommerce' || ! $order->source_ref || ! $order->platform_api_key_id) {
            return;
        }

        $apiKey = PlatformApiKey::find($order->platform_api_key_id);
        if (! $apiKey || $apiKey->status !== 'connected') {
            return;
        }

        $service->push($apiKey, $order->source_ref, [
            'status' => 'paid',
            'method' => $this->method,
            'trx_id' => $this->trxId,
            'amount' => $this->amount,
        ]);
    }
}
