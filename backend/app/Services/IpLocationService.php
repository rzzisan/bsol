<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class IpLocationService
{
    private string $apiProvider;
    private string $cachePrefix = 'ip_location_';
    private int $cacheTtl = 30 * 24 * 60 * 60; // 30 days

    public function __construct()
    {
        $this->apiProvider = config('services.ip_location.provider', 'ipapi');
    }

    /**
     * Get location information for an IP address
     */
    public function getLocation(string $ip): ?array
    {
        // Check cache first
        $cached = Cache::get($this->cachePrefix . $ip);
        if ($cached) {
            return $cached;
        }

        // Get from API
        $location = $this->fetchFromApi($ip);
        
        if ($location) {
            // Cache the result
            Cache::put($this->cachePrefix . $ip, $location, $this->cacheTtl);
        }

        return $location;
    }

    /**
     * Fetch location from external API
     */
    private function fetchFromApi(string $ip): ?array
    {
        try {
            if ($ip === '127.0.0.1' || $ip === 'localhost') {
                return $this->getLocalHostLocation();
            }

            return match ($this->apiProvider) {
                'ipapi' => $this->fetchFromIpApi($ip),
                'maxmind' => $this->fetchFromMaxMind($ip),
                'ipstack' => $this->fetchFromIpStack($ip),
                default => $this->fetchFromIpApi($ip),
            };
        } catch (\Exception $e) {
            \Log::error('IP Location Service Error', [
                'ip' => $ip,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Fetch from ip-api.com (free service)
     */
    private function fetchFromIpApi(string $ip): ?array
    {
        $response = Http::timeout(5)
            ->get("http://ip-api.com/json/{$ip}", [
                'fields' => 'status,country,city,lat,lon,isp',
            ]);

        if ($response->successful() && $response->json('status') === 'success') {
            return [
                'country' => $response->json('country'),
                'city' => $response->json('city'),
                'latitude' => $response->json('lat'),
                'longitude' => $response->json('lon'),
                'isp' => $response->json('isp'),
            ];
        }

        return null;
    }

    /**
     * Fetch from ipstack (requires API key)
     */
    private function fetchFromIpStack(string $ip): ?array
    {
        $apiKey = config('services.ip_location.ipstack_key');
        if (!$apiKey) {
            return null;
        }

        $response = Http::timeout(5)
            ->get("http://api.ipstack.com/{$ip}", [
                'access_key' => $apiKey,
                'fields' => 'country_name,city,latitude,longitude',
            ]);

        if ($response->successful()) {
            return [
                'country' => $response->json('country_name'),
                'city' => $response->json('city'),
                'latitude' => $response->json('latitude'),
                'longitude' => $response->json('longitude'),
            ];
        }

        return null;
    }

    /**
     * Fetch from MaxMind (requires subscription)
     */
    private function fetchFromMaxMind(string $ip): ?array
    {
        // MaxMind integration would go here
        return null;
    }

    /**
     * Get localhost location
     */
    private function getLocalHostLocation(): array
    {
        return [
            'country' => 'Local',
            'city' => 'Localhost',
            'latitude' => 0.0,
            'longitude' => 0.0,
        ];
    }

    /**
     * Get batch locations for multiple IPs
     */
    public function getLocations(array $ips): array
    {
        $results = [];
        foreach ($ips as $ip) {
            $results[$ip] = $this->getLocation($ip);
        }
        return $results;
    }
}
