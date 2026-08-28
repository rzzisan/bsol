<?php

namespace App\Services;

use App\Services\Courier\Concerns\CourierHttpRetry;
use App\Models\CourierSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * City/zone/area dropdown lookups for Pathao, backed by a shared
 * `pathao_locations` cache table (this reference data is identical for
 * every merchant, so one seller's account can populate it for everyone).
 *
 * Token issuance used to be duplicated here against a different endpoint
 * (`/aladdin/api/v1/external/login`, client_id/secret passed as
 * username/password) than `PathaoService` (`/aladdin/api/v1/issue-token`,
 * the real merchant username/password). That second endpoint was never a
 * documented Pathao API — it only "worked" as long as `pathao_locations`
 * already had cached rows from before, so a seller with correct
 * credentials but a cold cache would still see empty dropdowns. Fixed by
 * delegating all token handling to `PathaoService`, the one implementation
 * that has actually been exercised against Pathao's real API.
 * See `pre_launch_polish_context.md` §গ.
 */
class PathaoLocationService
{
    use CourierHttpRetry;

    private const BASE = 'https://api-hermes.pathao.com';

    public function __construct(
        private readonly PathaoService $pathaoService = new PathaoService(),
    ) {}

    /**
     * A user id whose CourierSetting has a full, usable Pathao credential
     * set: the requested user if configured, else any other seller's
     * (location data is shared reference data, not seller-specific).
     */
    private function resolveCredentialOwner(?int $userId): ?int
    {
        if ($userId && $this->pathaoService->hasCredentials($userId)) {
            return $userId;
        }

        $settings = CourierSetting::whereNotNull('pathao_client_id')
            ->whereNotNull('pathao_client_secret')
            ->whereNotNull('pathao_username')
            ->whereNotNull('pathao_password')
            ->first();

        return $settings?->user_id;
    }

    private function fetchFromPathao(string $endpoint, ?int $userId = null): ?array
    {
        $ownerId = $this->resolveCredentialOwner($userId);
        if (! $ownerId) return null;

        $token = $this->pathaoService->getToken($ownerId);
        if (! $token) return null;

        $res = Http::timeout(15)->retry(2, 300, $this->retryOnConnectionFailureOnly(), throw: false)->withToken($token)->get(self::BASE . $endpoint);
        return $res->successful() ? $res->json('data.data') : null;
    }

    public function getCities(?int $userId = null): array
    {
        $rows = DB::table('pathao_locations')
            ->where('type', 'city')
            ->orderBy('name')
            ->get(['external_id', 'name']);
        if ($rows->isNotEmpty()) {
            return $rows->map(fn($r) => ['id' => $r->external_id, 'name' => $r->name])->values()->all();
        }
        $items = $this->fetchFromPathao('/aladdin/api/v1/countries/1/city-list', $userId);
        if (! $items) return [];
        $now = now();
        DB::table('pathao_locations')->upsert(
            array_map(fn($i) => ['type' => 'city', 'external_id' => $i['city_id'], 'name' => $i['city_name'], 'parent_id' => null, 'cached_at' => $now], $items),
            ['type', 'external_id'], ['name', 'cached_at']
        );
        return array_map(fn($i) => ['id' => $i['city_id'], 'name' => $i['city_name']], $items);
    }

    public function getZones(int $cityId, ?int $userId = null): array
    {
        $rows = DB::table('pathao_locations')
            ->where('type', 'zone')
            ->where('parent_id', $cityId)
            ->orderBy('name')
            ->get(['external_id', 'name']);
        if ($rows->isNotEmpty()) {
            return $rows->map(fn($r) => ['id' => $r->external_id, 'name' => $r->name])->values()->all();
        }
        $items = $this->fetchFromPathao("/aladdin/api/v1/cities/{$cityId}/zone-list", $userId);
        if (! $items) return [];
        $now = now();
        DB::table('pathao_locations')->upsert(
            array_map(fn($i) => ['type' => 'zone', 'external_id' => $i['zone_id'], 'name' => $i['zone_name'], 'parent_id' => $cityId, 'cached_at' => $now], $items),
            ['type', 'external_id'], ['name', 'parent_id', 'cached_at']
        );
        return array_map(fn($i) => ['id' => $i['zone_id'], 'name' => $i['zone_name']], $items);
    }

    public function getAreas(int $zoneId, ?int $userId = null): array
    {
        $rows = DB::table('pathao_locations')
            ->where('type', 'area')
            ->where('parent_id', $zoneId)
            ->orderBy('name')
            ->get(['external_id', 'name']);
        if ($rows->isNotEmpty()) {
            return $rows->map(fn($r) => ['id' => $r->external_id, 'name' => $r->name])->values()->all();
        }
        $items = $this->fetchFromPathao("/aladdin/api/v1/zones/{$zoneId}/area-list", $userId);
        if (! $items) return [];
        $now = now();
        DB::table('pathao_locations')->upsert(
            array_map(fn($i) => ['type' => 'area', 'external_id' => $i['area_id'], 'name' => $i['area_name'], 'parent_id' => $zoneId, 'cached_at' => $now], $items),
            ['type', 'external_id'], ['name', 'parent_id', 'cached_at']
        );
        return array_map(fn($i) => ['id' => $i['area_id'], 'name' => $i['area_name']], $items);
    }

    public function hasCredentials(?int $userId = null): bool
    {
        return $this->resolveCredentialOwner($userId) !== null;
    }
}
