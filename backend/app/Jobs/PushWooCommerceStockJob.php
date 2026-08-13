<?php

namespace App\Jobs;

use App\Models\PlatformApiKey;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\WooCommerceStockPushService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Dispatched by Product::booted()/ProductVariant::booted() whenever a
 * WooCommerce-linked product/variant's stock changes. Queued (not sync)
 * for the same reason as every other outbound-HTTP job in this codebase
 * (SendFacebookCapiPurchaseEventJob) — a real network call shouldn't block
 * the request that changed the stock (a dashboard save, an order
 * transition inside a DB transaction in OrderStatusService, etc.).
 */
class PushWooCommerceStockJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        private readonly string $modelType,
        private readonly int $modelId,
    ) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(WooCommerceStockPushService $service): void
    {
        if ($this->modelType === 'variant') {
            $variant = ProductVariant::with('product.user')->find($this->modelId);
            if (! $variant || ! $variant->product || ! $variant->product->user) {
                return;
            }
            $ownerId = $variant->product->user->shopOwnerId();
            $wcId = $variant->source_ref;
            $stock = $variant->stock_qty;
        } else {
            $product = Product::with('user')->find($this->modelId);
            if (! $product || ! $product->user) {
                return;
            }
            $ownerId = $product->user->shopOwnerId();
            $wcId = $product->source_ref;
            $stock = $product->stock;
        }

        if (! $wcId) {
            return;
        }

        $apiKey = PlatformApiKey::where('user_id', $ownerId)
            ->where('platform', 'woocommerce')
            ->where('status', 'connected')
            ->first();

        if (! $apiKey) {
            // Not connected (or disconnected since the change happened) —
            // nothing to push to.
            return;
        }

        $service->push($apiKey, $wcId, (int) $stock);
    }
}
