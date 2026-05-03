<?php

namespace App\Services;

use App\Models\CourierSetting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PathaoService
{
    const BASE_URL = 'https://api-hermes.pathao.com';
    const TOKEN_ENDPOINT = '/aladdin/api/v1/issue-token';

    // ── Token Management ──────────────────────────────────────────────────────

    /**
     * Get a valid access token for the user. Issues or refreshes automatically.
     */
    public function getToken(int $userId): ?string
    {
        $settings = CourierSetting::where('user_id', $userId)->first();

        if (! $settings || ! $settings->pathao_client_id || ! $settings->pathao_client_secret) {
            return null;
        }

        // If we have a valid token that hasn't expired (with 5-minute buffer), use it
        if ($settings->pathao_access_token && $settings->pathao_token_expires_at) {
            $expiresAt = Carbon::parse($settings->pathao_token_expires_at);
            if ($expiresAt->gt(now()->addMinutes(5))) {
                return $settings->pathao_access_token;
            }
        }

        // Try to refresh using refresh_token
        if ($settings->pathao_refresh_token) {
            $result = $this->issueTokenFromRefresh(
                $settings->pathao_client_id,
                $settings->pathao_client_secret,
                $settings->pathao_refresh_token
            );
            if ($result) {
                $this->saveTokens($settings, $result);
                return $result['access_token'];
            }
        }

        // Issue new token using username/password
        if (! $settings->pathao_username || ! $settings->pathao_password) {
            return null;
        }

        $result = $this->issueTokenFromPassword(
            $settings->pathao_client_id,
            $settings->pathao_client_secret,
            $settings->pathao_username,
            $settings->pathao_password
        );

        if ($result) {
            $this->saveTokens($settings, $result);
            return $result['access_token'];
        }

        return null;
    }

    private function issueTokenFromPassword(string $clientId, string $clientSecret, string $username, string $password): ?array
    {
        try {
            $response = Http::post(self::BASE_URL . self::TOKEN_ENDPOINT, [
                'client_id'     => $clientId,
                'client_secret' => $clientSecret,
                'grant_type'    => 'password',
                'username'      => $username,
                'password'      => $password,
            ]);

            if ($response->successful() && isset($response->json()['access_token'])) {
                return $response->json();
            }
        } catch (\Exception $e) {
            Log::error('Pathao token issue failed: ' . $e->getMessage());
        }
        return null;
    }

    private function issueTokenFromRefresh(string $clientId, string $clientSecret, string $refreshToken): ?array
    {
        try {
            $response = Http::post(self::BASE_URL . self::TOKEN_ENDPOINT, [
                'client_id'     => $clientId,
                'client_secret' => $clientSecret,
                'grant_type'    => 'refresh_token',
                'refresh_token' => $refreshToken,
            ]);

            if ($response->successful() && isset($response->json()['access_token'])) {
                return $response->json();
            }
        } catch (\Exception $e) {
            Log::error('Pathao token refresh failed: ' . $e->getMessage());
        }
        return null;
    }

    private function saveTokens(CourierSetting $settings, array $tokenData): void
    {
        $expiresIn    = (int) ($tokenData['expires_in'] ?? 432000);
        $expiresAt    = now()->addSeconds($expiresIn);

        $settings->update([
            'pathao_access_token'    => $tokenData['access_token'],
            'pathao_refresh_token'   => $tokenData['refresh_token'] ?? $settings->pathao_refresh_token,
            'pathao_token_expires_at'=> $expiresAt,
        ]);
    }

    // ── Store Management ──────────────────────────────────────────────────────

    /**
     * Get all stores for the merchant.
     */
    public function getStores(int $userId): array
    {
        $token = $this->getToken($userId);
        if (! $token) return ['success' => false, 'message' => 'Pathao credentials not configured or invalid.'];

        try {
            $response = Http::withToken($token)->get(self::BASE_URL . '/aladdin/api/v1/stores');
            $data = $response->json();
            if ($response->successful()) {
                return ['success' => true, 'data' => $data['data']['data'] ?? []];
            }
            return ['success' => false, 'message' => $data['message'] ?? 'Failed to fetch stores.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Create a new Pathao store.
     */
    public function createStore(int $userId, array $data): array
    {
        $token = $this->getToken($userId);
        if (! $token) return ['success' => false, 'message' => 'Pathao credentials not configured.'];

        try {
            $response = Http::withToken($token)->post(self::BASE_URL . '/aladdin/api/v1/stores', $data);
            $body = $response->json();
            if ($response->successful()) {
                return ['success' => true, 'data' => $body['data'] ?? $body, 'message' => $body['message'] ?? 'Store created.'];
            }
            return ['success' => false, 'message' => $body['message'] ?? 'Failed to create store.', 'errors' => $body['errors'] ?? null];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Order Management ──────────────────────────────────────────────────────

    /**
     * Create a single Pathao order.
     */
    public function createOrder(int $userId, array $orderData): array
    {
        $token = $this->getToken($userId);
        if (! $token) return ['success' => false, 'message' => 'Pathao credentials not configured.'];

        try {
            $response = Http::withToken($token)->post(self::BASE_URL . '/aladdin/api/v1/orders', $orderData);
            $body = $response->json();
            if ($response->successful() && isset($body['data']['consignment_id'])) {
                return [
                    'success'         => true,
                    'consignment_id'  => $body['data']['consignment_id'],
                    'order_status'    => $body['data']['order_status'] ?? 'Pending',
                    'delivery_fee'    => $body['data']['delivery_fee'] ?? null,
                    'message'         => $body['message'] ?? 'Order created.',
                ];
            }
            return ['success' => false, 'message' => $body['message'] ?? 'Failed to create order.', 'errors' => $body['errors'] ?? null, 'raw' => $body];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Create bulk Pathao orders.
     */
    public function createBulkOrders(int $userId, array $orders): array
    {
        $token = $this->getToken($userId);
        if (! $token) return ['success' => false, 'message' => 'Pathao credentials not configured.'];

        try {
            $response = Http::withToken($token)->post(self::BASE_URL . '/aladdin/api/v1/orders/bulk', [
                'orders' => $orders,
            ]);
            $body = $response->json();
            if ($response->successful()) {
                return ['success' => true, 'message' => $body['message'] ?? 'Bulk order request accepted.'];
            }
            return ['success' => false, 'message' => $body['message'] ?? 'Bulk order failed.', 'raw' => $body];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Get order info / tracking status by consignment ID.
     */
    public function getOrderInfo(int $userId, string $consignmentId): array
    {
        $token = $this->getToken($userId);
        if (! $token) return ['success' => false, 'message' => 'Pathao credentials not configured.'];

        try {
            $response = Http::withToken($token)->get(self::BASE_URL . "/aladdin/api/v1/orders/{$consignmentId}/info");
            $body = $response->json();
            if ($response->successful()) {
                return ['success' => true, 'data' => $body['data'] ?? $body];
            }
            return ['success' => false, 'message' => $body['message'] ?? 'Failed to fetch order info.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Price Calculation ─────────────────────────────────────────────────────

    /**
     * Calculate delivery price for a parcel.
     */
    public function calculatePrice(int $userId, array $data): array
    {
        $token = $this->getToken($userId);
        if (! $token) return ['success' => false, 'message' => 'Pathao credentials not configured.'];

        try {
            $response = Http::withToken($token)->post(self::BASE_URL . '/aladdin/api/v1/merchant/price-plan', $data);
            $body = $response->json();
            if ($response->successful()) {
                return ['success' => true, 'data' => $body['data'] ?? $body];
            }
            return ['success' => false, 'message' => $body['message'] ?? 'Price calculation failed.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Location Lists ────────────────────────────────────────────────────────

    public function getCities(int $userId): array
    {
        $token = $this->getToken($userId);
        if (! $token) return [];

        try {
            $response = Http::withToken($token)->get(self::BASE_URL . '/aladdin/api/v1/city-list');
            if ($response->successful()) {
                return $response->json()['data']['data'] ?? [];
            }
        } catch (\Exception $e) {
            Log::error('Pathao getCities failed: ' . $e->getMessage());
        }
        return [];
    }

    public function getZones(int $userId, int $cityId): array
    {
        $token = $this->getToken($userId);
        if (! $token) return [];

        try {
            $response = Http::withToken($token)->get(self::BASE_URL . "/aladdin/api/v1/cities/{$cityId}/zone-list");
            if ($response->successful()) {
                return $response->json()['data']['data'] ?? [];
            }
        } catch (\Exception $e) {
            Log::error('Pathao getZones failed: ' . $e->getMessage());
        }
        return [];
    }

    public function getAreas(int $userId, int $zoneId): array
    {
        $token = $this->getToken($userId);
        if (! $token) return [];

        try {
            $response = Http::withToken($token)->get(self::BASE_URL . "/aladdin/api/v1/zones/{$zoneId}/area-list");
            if ($response->successful()) {
                return $response->json()['data']['data'] ?? [];
            }
        } catch (\Exception $e) {
            Log::error('Pathao getAreas failed: ' . $e->getMessage());
        }
        return [];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Check if user has Pathao credentials configured.
     */
    public function hasCredentials(int $userId): bool
    {
        $settings = CourierSetting::where('user_id', $userId)->first();
        return $settings
            && $settings->pathao_client_id
            && $settings->pathao_client_secret
            && $settings->pathao_username
            && $settings->pathao_password;
    }
}
