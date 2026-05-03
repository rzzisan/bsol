<?php

namespace App\Services;

use App\Models\CourierSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class PathaoLocationService
{
    private const BASE = 'https://api-hermes.pathao.com';
    private const TOKEN_TTL = 3600;

    private function getCredentials(?int $userId = null): ?array
    {
        $settings = null;
        if ($userId) {
            $settings = CourierSetting::where('user_id', $userId)
                ->whereNotNull('pathao_client_id')
                ->whereNotNull('pathao_client_secret')
                ->first();
        }
        if (! $settings) {
            $settings = CourierSetting::whereNotNull('pathao_client_id')
                ->whereNotNull('pathao_client_secret')
                ->first();
        }
        if (! $settings) return null;
        return ['client_id' => $settings->pathao_client_id, 'client_secret' => $settings->pathao_client_secret];
    }

    private function getToken(string $clientId, string $clientSecret): ?string
    {
        $cacheKey = 'pathao_token_' . md5($clientId);
        return Cache::remember($cacheKey, self::TOKEN_TTL - 60, function () use ($clientId, $clientSecret) {
            $res = Http::timeout(15)->post(self::BASE . '/aladdin/api/v1/external/login', [
                'username'      => $clientId,
                'password'      => $clientSecret,
                'grant_type'    => 'password',
                'client_id'     => $clientId,
                'client_secret' => $clientSecret,
            ]);
            return $res->successful() ? $res->json('access_token') : null;
        });
    }

    private function fetchFromPathao(string $endpoint, ?int $userId = null): ?array
    {
        $creds = $this->getCredentials($userId);
        if (! $creds) return null;
        $token = $this->getToken($creds['client_id'], $creds['client_secret']);
        if (! $token) return null;
        $res = Http::timeout(15)->withToken($token)->get(self::BASE . $endpoint);
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
        return $this->getCredentials($userId) !== null;
    }
}