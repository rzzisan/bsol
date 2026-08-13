<?php

namespace App\Services;

use App\Models\PlatformApiKey;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin HTTP client for the one call BSOL makes OUT to a connected
 * WooCommerce site — pushing a stock change so the store doesn't oversell
 * a unit that was actually consumed by an order from another channel
 * (Facebook, manual). Mirrors the shape of the courier services
 * (SteadfastService etc.): explicit timeout, defensive response handling,
 * never throws — callers (PushWooCommerceStockJob) get a plain result
 * array back and decide what to do with a failure.
 *
 * `domain` on PlatformApiKey is always the normalized bare host (see
 * PlatformApiKey::normalizeHost()), so the URL is built directly from it.
 * HTTPS-only is an accepted limitation for this phase — a seller running
 * plain HTTP on their WordPress site won't receive pushes.
 */
class WooCommerceStockPushService
{
    public function push(PlatformApiKey $apiKey, string $wcId, int $stockQuantity): array
    {
        if (! $apiKey->webhook_secret) {
            return ['success' => false, 'message' => 'No webhook secret on file — site needs to reconnect.'];
        }

        $url = "https://{$apiKey->domain}/wp-json/bsol-connect/v1/stock-update";

        try {
            $response = Http::withHeaders([
                'X-BSOL-Webhook-Secret' => $apiKey->webhook_secret,
            ])->timeout(15)->post($url, [
                'wc_id' => $wcId,
                'stock_quantity' => $stockQuantity,
            ]);
        } catch (\Throwable $e) {
            Log::warning('WooCommerce stock push failed (network)', [
                'domain' => $apiKey->domain, 'wc_id' => $wcId, 'error' => $e->getMessage(),
            ]);

            return ['success' => false, 'message' => $e->getMessage()];
        }

        if (! $response->successful()) {
            Log::warning('WooCommerce stock push rejected', [
                'domain' => $apiKey->domain, 'wc_id' => $wcId, 'status' => $response->status(),
            ]);

            return ['success' => false, 'message' => 'WordPress responded with HTTP ' . $response->status()];
        }

        return ['success' => true];
    }
}
