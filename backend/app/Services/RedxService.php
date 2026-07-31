<?php

namespace App\Services;

use App\Models\CourierSetting;
use Illuminate\Support\Facades\Http;

class RedxService
{
    private function baseUrl(string $environment): string
    {
        return $environment === 'sandbox'
            ? 'https://sandbox.redx.com.bd/v1.0.0-beta'
            : 'https://openapi.redx.com.bd/v1.0.0-beta';
    }

    /** @return array{token:string,base_url:string,pickup_store_id:?int}|null */
    private function credentials(int $userId): ?array
    {
        $settings = CourierSetting::where('user_id', $userId)->first();

        if (! $settings || ! $settings->redx_api_key) {
            return null;
        }

        return [
            'token' => $settings->redx_api_key,
            'base_url' => $this->baseUrl($settings->redx_environment ?? 'production'),
            'pickup_store_id' => $settings->redx_pickup_store_id,
        ];
    }

    private function client(string $token)
    {
        return Http::withHeaders([
            'API-ACCESS-TOKEN' => 'Bearer ' . $token,
            'Content-Type' => 'application/json',
        ])->timeout(20);
    }

    public function hasCredentials(int $userId): bool
    {
        return $this->credentials($userId) !== null;
    }

    public function defaultPickupStoreId(int $userId): ?int
    {
        return $this->credentials($userId)['pickup_store_id'] ?? null;
    }

    // ── Areas ─────────────────────────────────────────────────────────────────

    public function getAreas(int $userId, ?string $postCode = null, ?string $districtName = null): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'RedX credentials not configured.'];
        }

        try {
            $query = array_filter([
                'post_code' => $postCode,
                'district_name' => $districtName,
            ]);

            $response = $this->client($creds['token'])->get($creds['base_url'] . '/areas', $query);
            $body = $response->json();

            if ($response->successful()) {
                return ['success' => true, 'data' => $body['areas'] ?? []];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to fetch RedX areas.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Pickup Stores ─────────────────────────────────────────────────────────

    public function createPickupStore(int $userId, array $data): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'RedX credentials not configured.'];
        }

        try {
            $response = $this->client($creds['token'])->post($creds['base_url'] . '/pickup/store', [
                'name' => $data['name'],
                'phone' => $data['phone'],
                'address' => $data['address'],
                'area_id' => (int) $data['area_id'],
            ]);
            $body = $response->json();

            if ($response->successful() && isset($body['id'])) {
                return ['success' => true, 'data' => $body, 'message' => 'Pickup store created.'];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to create RedX pickup store.', 'raw' => $body];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getPickupStores(int $userId): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'RedX credentials not configured.'];
        }

        try {
            $response = $this->client($creds['token'])->get($creds['base_url'] . '/pickup/stores');
            $body = $response->json();

            if ($response->successful()) {
                return ['success' => true, 'data' => $body['pickup_stores'] ?? []];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to fetch RedX pickup stores.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Charge Calculator ────────────────────────────────────────────────────

    public function calculateCharge(int $userId, int $deliveryAreaId, int $pickupAreaId, float $codAmount, float $weightGrams): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'RedX credentials not configured.'];
        }

        try {
            $response = $this->client($creds['token'])->get($creds['base_url'] . '/charge/charge_calculator', [
                'delivery_area_id' => $deliveryAreaId,
                'pickup_area_id' => $pickupAreaId,
                'cash_collection_amount' => $codAmount,
                'weight' => $weightGrams,
            ]);
            $body = $response->json();

            if ($response->successful()) {
                return ['success' => true, 'data' => $body];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to calculate RedX delivery charge.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Parcel ────────────────────────────────────────────────────────────────

    public function createParcel(int $userId, array $payload): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'RedX credentials not configured.'];
        }

        try {
            $response = $this->client($creds['token'])->post($creds['base_url'] . '/parcel', $payload);
            $body = $response->json();

            if ($response->successful() && isset($body['tracking_id'])) {
                return ['success' => true, 'tracking_id' => $body['tracking_id']];
            }

            return [
                'success' => false,
                'message' => $body['message'] ?? 'Failed to create RedX parcel.',
                'errors' => $body['errors'] ?? null,
                'raw' => $body,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function trackParcel(int $userId, string $trackingId): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'RedX credentials not configured.'];
        }

        try {
            $response = $this->client($creds['token'])->get($creds['base_url'] . '/parcel/track/' . urlencode($trackingId));
            $body = $response->json();

            if ($response->successful()) {
                return ['success' => true, 'data' => $body['tracking'] ?? []];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to track RedX parcel.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getParcelInfo(int $userId, string $trackingId): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'RedX credentials not configured.'];
        }

        try {
            $response = $this->client($creds['token'])->get($creds['base_url'] . '/parcel/info/' . urlencode($trackingId));
            $body = $response->json();

            if ($response->successful()) {
                return ['success' => true, 'data' => $body['parcel'] ?? []];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to fetch RedX parcel info.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function updateParcel(int $userId, string $trackingId, string $property, string $newValue, ?string $reason = null): array
    {
        $creds = $this->credentials($userId);
        if (! $creds) {
            return ['success' => false, 'message' => 'RedX credentials not configured.'];
        }

        try {
            $updateDetails = ['property_name' => $property, 'new_value' => $newValue];
            if ($reason) {
                $updateDetails['reason'] = $reason;
            }

            $response = $this->client($creds['token'])->patch($creds['base_url'] . '/parcels', [
                'entity_type' => 'parcel-tracking-id',
                'entity_id' => $trackingId,
                'update_details' => $updateDetails,
            ]);
            $body = $response->json();

            if ($response->successful() && ($body['success'] ?? false)) {
                return ['success' => true, 'message' => $body['message'] ?? 'Parcel updated.'];
            }

            return ['success' => false, 'message' => $body['message'] ?? 'Failed to update RedX parcel.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
