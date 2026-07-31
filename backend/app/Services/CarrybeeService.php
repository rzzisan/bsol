<?php

namespace App\Services;

use App\Models\CourierSetting;
use Illuminate\Support\Facades\Http;

/**
 * CarryBee's official booking API (developers.carrybee.com / sandbox.carrybee.com),
 * distinct from CarrybeeFraudCheckService which scrapes the merchant panel login.
 * Auth is three static headers issued per business per environment.
 */
class CarrybeeService
{
    private function baseUrl(string $environment): string
    {
        return $environment === 'sandbox'
            ? 'https://sandbox.carrybee.com'
            : 'https://developers.carrybee.com';
    }

    /** @return array{client_id:string,client_secret:string,client_context:string,base_url:string,store_id:?string}|null */
    private function credentials(int $userId): ?array
    {
        $settings = CourierSetting::where('user_id', $userId)->first();

        if (! $settings || ! $settings->carrybee_client_id || ! $settings->carrybee_client_secret || ! $settings->carrybee_client_context) {
            return null;
        }

        return [
            'client_id' => $settings->carrybee_client_id,
            'client_secret' => $settings->carrybee_client_secret,
            'client_context' => $settings->carrybee_client_context,
            'base_url' => $this->baseUrl($settings->carrybee_environment ?? 'production'),
            'store_id' => $settings->carrybee_store_id,
        ];
    }

    private function client(array $creds)
    {
        return Http::withHeaders([
            'Client-ID' => $creds['client_id'],
            'Client-Secret' => $creds['client_secret'],
            'Client-Context' => $creds['client_context'],
            'Content-Type' => 'application/json',
        ])->timeout(20);
    }

    public function hasCredentials(int $userId): bool
    {
        return $this->credentials($userId) !== null;
    }

    public function defaultStoreId(int $userId): ?string
    {
        return $this->credentials($userId)['store_id'] ?? null;
    }

    // ── Location ─────────────────────────────────────────────────────────────

    public function getCities(int $userId): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'CarryBee credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->get($creds['base_url'] . '/api/v2/cities');
            $body = $response->json();

            if ($response->successful() && ! ($body['error'] ?? true)) {
                return ['success' => true, 'data' => $body['data']['cities'] ?? []];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to fetch CarryBee cities.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getZones(int $userId, int $cityId): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'CarryBee credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->get($creds['base_url'] . "/api/v2/cities/{$cityId}/zones");
            $body = $response->json();

            if ($response->successful() && ! ($body['error'] ?? true)) {
                return ['success' => true, 'data' => $body['data']['zones'] ?? []];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to fetch CarryBee zones.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getAreas(int $userId, int $cityId, int $zoneId): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'CarryBee credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->get($creds['base_url'] . "/api/v2/cities/{$cityId}/zones/{$zoneId}/areas");
            $body = $response->json();

            if ($response->successful() && ! ($body['error'] ?? true)) {
                return ['success' => true, 'data' => $body['data']['areas'] ?? []];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to fetch CarryBee areas.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /** Free-text search across city/zone/area — returns fully resolved location triples. */
    public function searchAreas(int $userId, string $search): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'CarryBee credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->get($creds['base_url'] . '/api/v2/area-suggestion', ['search' => $search]);
            $body = $response->json();

            if ($response->successful() && ! ($body['error'] ?? true)) {
                return ['success' => true, 'data' => $body['data']['items'] ?? []];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to search CarryBee areas.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Stores ───────────────────────────────────────────────────────────────

    public function createStore(int $userId, array $data): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'CarryBee credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->post($creds['base_url'] . '/api/v2/stores', [
                'name' => $data['name'],
                'contact_person_name' => $data['contact_person_name'],
                'contact_person_number' => $data['contact_person_number'],
                'contact_person_secondary_number' => $data['contact_person_secondary_number'] ?? null,
                'address' => $data['address'],
                'city_id' => (int) $data['city_id'],
                'zone_id' => (int) $data['zone_id'],
                'area_id' => (int) $data['area_id'],
            ]);
            $body = $response->json();

            if ($response->successful() && ! ($body['error'] ?? true)) {
                return ['success' => true, 'message' => $body['message'] ?? 'Store created successfully.'];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to create CarryBee store.', 'raw' => $body];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getStores(int $userId): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'CarryBee credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->get($creds['base_url'] . '/api/v2/stores');
            $body = $response->json();

            if ($response->successful() && ! ($body['error'] ?? true)) {
                return ['success' => true, 'data' => $body['data']['stores'] ?? []];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to fetch CarryBee stores.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Orders ───────────────────────────────────────────────────────────────

    public function createOrder(int $userId, array $payload): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'CarryBee credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->post($creds['base_url'] . '/api/v2/orders', $payload);
            $body = $response->json();

            if ($response->successful() && ! ($body['error'] ?? true) && isset($body['data']['order']['consignment_id'])) {
                return ['success' => true, 'data' => $body['data']['order']];
            }

            return [
                'success' => false,
                'message' => $body['message'] ?? 'Failed to create CarryBee order.',
                'causes' => $body['causes'] ?? null,
                'raw' => $body,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getOrderDetails(int $userId, string $consignmentId): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'CarryBee credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->get($creds['base_url'] . '/api/v2/orders/' . urlencode($consignmentId) . '/details');
            $body = $response->json();

            if ($response->successful() && ! ($body['error'] ?? true)) {
                return ['success' => true, 'data' => $body['data'] ?? []];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to fetch CarryBee order details.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function cancelOrder(int $userId, string $consignmentId, string $reason): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'CarryBee credentials not configured.'];
        }

        try {
            $response = $this->client($creds)->post($creds['base_url'] . '/api/v2/orders/' . urlencode($consignmentId) . '/cancel', [
                'cancellation_reason' => $reason,
            ]);
            $body = $response->json();

            if ($response->successful() && ! ($body['error'] ?? true)) {
                return ['success' => true, 'message' => $body['message'] ?? 'Cancellation confirmed.'];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to cancel CarryBee order.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
