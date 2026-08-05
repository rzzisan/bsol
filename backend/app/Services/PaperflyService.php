<?php

namespace App\Services;

use App\Models\CourierSetting;
use Illuminate\Support\Facades\Http;

/**
 * Paperfly's official merchant REST API (api.paperfly.com.bd) — distinct
 * from PaperflyFraudCheckService, which logs into the internal merchant
 * panel (go-app.paperfly.com.bd) purely to read delivery-history stats for
 * the fraud checker. Auth here is HTTP Basic (merchant panel username +
 * password) plus a static `paperflykey` header issued per merchant on the
 * Developer Guide page (go.paperfly.com.bd/merchant/developer-guide).
 */
class PaperflyService
{
    private const BASE = 'https://api.paperfly.com.bd';

    /** @return array{username:string,password:string,api_key:string,store_name:?string}|null */
    private function credentials(int $userId): ?array
    {
        $settings = CourierSetting::where('user_id', $userId)->first();

        if (! $settings || ! $settings->paperfly_username || ! $settings->paperfly_password || ! $settings->paperfly_api_key) {
            return null;
        }

        return [
            'username' => $settings->paperfly_username,
            'password' => $settings->paperfly_password,
            'api_key' => $settings->paperfly_api_key,
            'store_name' => $settings->paperfly_store_name,
        ];
    }

    private function client(array $creds)
    {
        return Http::withBasicAuth($creds['username'], $creds['password'])
            ->withHeaders([
                'paperflykey' => $creds['api_key'],
                'Content-Type' => 'application/json',
            ])
            ->timeout(20);
    }

    public function hasCredentials(int $userId): bool
    {
        return $this->credentials($userId) !== null;
    }

    public function defaultStoreName(int $userId): ?string
    {
        return $this->credentials($userId)['store_name'] ?? null;
    }

    // ── Orders ───────────────────────────────────────────────────────────────

    public function createOrder(int $userId, array $payload): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'Paperfly credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->post(self::BASE . '/merchant/api/service/new_order_v2.php', $payload);
            $body = $response->json();

            if ($response->successful() && isset($body['success']['tracking_number'])) {
                return ['success' => true, 'data' => $body['success']];
            }

            return [
                'success' => false,
                'message' => $body['error']['message'] ?? $body['message'] ?? 'Failed to create Paperfly order.',
                'raw' => $body,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Tracked by our own order reference (merchantOrderReference sent at
     * booking time), not by the tracking_number Paperfly returns — that's
     * how their API is documented.
     */
    public function trackOrder(int $userId, string $referenceNumber): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'Paperfly credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->post(self::BASE . '/API-Order-Tracking', [
                'ReferenceNumber' => $referenceNumber,
            ]);
            $body = $response->json();

            if ($response->successful() && isset($body['success']['trackingStatus'])) {
                return ['success' => true, 'data' => $body['success']];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to track Paperfly order.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /** Also keyed by our own order reference, same as trackOrder(). */
    public function cancelOrder(int $userId, string $orderId): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'Paperfly credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->post(self::BASE . '/api/v1/cancel-order', [
                'order_id' => $orderId,
            ]);
            $body = $response->json();

            if ($response->successful() && isset($body['success'])) {
                return ['success' => true, 'message' => $body['success']['message'] ?? 'Order cancelled.'];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to cancel Paperfly order.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
