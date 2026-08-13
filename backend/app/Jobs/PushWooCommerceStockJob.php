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
            $wcId = $variant->source_ref;
            $stock = $variant->stock_qty;
            $platformApiKeyId = $variant->product->platform_api_key_id;
        } else {
            $product = Product::with('user')->find($this->modelId);
            if (! $product || ! $product->user) {
                return;
            }
            $wcId = $product->source_ref;
            $stock = $product->stock;
            $platformApiKeyId = $product->platform_api_key_id;
        }

        if (! $wcId) {
            return;
        }

        // Resolve the specific connected site this product/variant came
        // from — not just "any connected site for this seller" (the old
        // query), which would silently push to the wrong site once a
        // seller has more than one connected (Phase 16). A variant
        // inherits its parent product's platform_api_key_id rather than
        // carrying its own column — a variant's site is always its
        // product's site.
        $apiKey = $platformApiKeyId ? PlatformApiKey::find($platformApiKeyId) : null;

        if (! $apiKey || $apiKey->status !== 'connected') {
            // Not connected (or disconnected since the change happened), or
            // this row predates Phase 16 and was never backfilled — nothing
            // to push to.
            return;
        }

        $service->push($apiKey, $wcId, (int) $stock);
    }
}
