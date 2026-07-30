<?php

namespace App\Services;

use App\Models\CourierSetting;
use App\Services\Contracts\CourierFraudCheckInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class RedxFraudCheckService implements CourierFraudCheckInterface
{
    private const AUTH_URL = 'https://api.redx.com.bd/v4/auth/login';
    private const STATS_URL = 'https://redx.com.bd/api/redx_se/admin/parcel/customer-success-return-rate';

    private const UA_HEADERS = [
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept' => 'application/json, text/plain, */*',
    ];

    public function checkPhone(CourierSetting $settings, string $phone): array
    {
        if (empty($settings->redx_phone) || empty($settings->redx_password)) {
            return $this->error('RedX credentials not configured.');
        }

        $accessToken = $this->getAccessToken($settings);
        if (! $accessToken) {
            return $this->error('RedX login failed or no access token received.');
        }

        $result = $this->fetchStats($accessToken, $phone);

        if ($result['status'] === 401) {
            // Token might have expired between cache-check and use; forget and retry once.
            Cache::forget($this->cacheKey($settings));
            $accessToken = $this->getAccessToken($settings);
            if (! $accessToken) {
                return $this->error('RedX token expired and re-login failed.');
            }
            $result = $this->fetchStats($accessToken, $phone);
        }

        if (! $result['ok']) {
            return $this->error('RedX stats request failed (HTTP ' . $result['status'] . ').');
        }

        $total = (int) ($result['body']['data']['totalParcels'] ?? 0);
        $delivered = (int) ($result['body']['data']['deliveredParcels'] ?? 0);
        $cancelled = max(0, $total - $delivered);

        return [
            'total' => $total,
            'delivered' => $delivered,
            'cancelled' => $cancelled,
            'success_rate' => $total > 0 ? round(($delivered / $total) * 100, 2) : 0,
            'error' => null,
        ];
    }

    private function getAccessToken(CourierSetting $settings): ?string
    {
        return Cache::remember($this->cacheKey($settings), now()->addMinutes(50), function () use ($settings) {
            try {
                $response = Http::timeout(config('fraud_checker.http_timeout', 15))
                    ->withHeaders(self::UA_HEADERS)
                    ->post(self::AUTH_URL, [
                        'phone' => '88' . $settings->redx_phone,
                        'password' => $settings->redx_password,
                    ]);

                if (! $response->successful()) {
                    return null;
                }

                return $response->json('data.accessToken');
            } catch (\Throwable $e) {
                return null;
            }
        });
    }

    private function fetchStats(string $accessToken, string $phone): array
    {
        try {
            $response = Http::timeout(config('fraud_checker.http_timeout', 15))
                ->withHeaders(array_merge(self::UA_HEADERS, [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer ' . $accessToken,
                ]))
                ->get(self::STATS_URL, ['phoneNumber' => '88' . $phone]);

            return [
                'ok' => $response->successful(),
                'status' => $response->status(),
                'body' => $response->json() ?? [],
            ];
        } catch (\Throwable $e) {
            return ['ok' => false, 'status' => 0, 'body' => []];
        }
    }

    private function cacheKey(CourierSetting $settings): string
    {
        return 'redx_fraud_token:' . $settings->id;
    }

    private function error(string $message): array
    {
        return ['total' => 0, 'delivered' => 0, 'cancelled' => 0, 'success_rate' => 0, 'error' => $message];
    }
}
