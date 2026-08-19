<?php

namespace App\Services;

use App\Models\PlatformApiKey;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin HTTP client for the one call BSOL makes OUT to a connected
 * WooCommerce site to report a confirmed online payment — the gateway/IPN
 * callback that confirms a payment always lands on BSOL directly (bKash/
 * SSLCommerz/etc. never talk to WordPress), so WooCommerce has no other
 * way to learn "this order got paid". Mirrors WooCommerceStockPushService
 * field-for-field (same webhook_secret header, same never-throws shape) —
 * see wordpress_connect_context.md.
 */
class WooCommercePaymentPushService
{
    public function push(PlatformApiKey $apiKey, string $wcOrderId, array $payload): array
    {
        if (! $apiKey->webhook_secret) {
            return ['success' => false, 'message' => 'No webhook secret on file — site needs to reconnect.'];
        }

        $url = "https://{$apiKey->domain}/wp-json/bsol-connect/v1/payment-status";

        try {
            $response = Http::withHeaders([
                'X-BSOL-Webhook-Secret' => $apiKey->webhook_secret,
            ])->timeout(15)->post($url, array_merge(['wc_order_id' => $wcOrderId], $payload));
        } catch (\Throwable $e) {
            Log::warning('WooCommerce payment-status push failed (network)', [
                'domain' => $apiKey->domain, 'wc_order_id' => $wcOrderId, 'error' => $e->getMessage(),
            ]);

            return ['success' => false, 'message' => $e->getMessage()];
        }

        if (! $response->successful()) {
            Log::warning('WooCommerce payment-status push rejected', [
                'domain' => $apiKey->domain, 'wc_order_id' => $wcOrderId, 'status' => $response->status(),
            ]);

            return ['success' => false, 'message' => 'WordPress responded with HTTP ' . $response->status()];
        }

        return ['success' => true];
    }
}
