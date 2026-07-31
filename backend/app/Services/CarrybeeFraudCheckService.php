<?php

namespace App\Services;

use App\Models\CourierSetting;
use App\Services\Contracts\CourierFraudCheckInterface;
use GuzzleHttp\Cookie\CookieJar;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Carrybee's merchant panel (merchant.carrybee.com) uses a NextAuth login flow:
 * csrf token -> form-post callback login -> session lookup for the access token + businessId.
 */
class CarrybeeFraudCheckService implements CourierFraudCheckInterface
{
    private const MERCHANT_BASE = 'https://merchant.carrybee.com';
    private const API_BASE = 'https://api-merchant.carrybee.com';

    private const HEADERS = [
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept' => 'application/json',
        'Referer' => 'https://merchant.carrybee.com/login',
    ];

    public function checkPhone(CourierSetting $settings, string $phone): array
    {
        if (empty($settings->carrybee_phone) || empty($settings->carrybee_password)) {
            return $this->error('CarryBee credentials not configured.');
        }

        $auth = $this->getAuth($settings);
        if (! $auth) {
            return $this->error('CarryBee login failed or no session established.');
        }

        try {
            $response = Http::timeout(config('fraud_checker.http_timeout', 15))
                ->withHeaders(array_merge(self::HEADERS, [
                    'Authorization' => 'Bearer ' . $auth['accessToken'],
                ]))
                ->get(self::API_BASE . "/api/v2/businesses/{$auth['businessId']}/customers/{$phone}");

            if ($response->status() === 401) {
                Cache::forget($this->cacheKey($settings));
                return $this->error('CarryBee session expired. Please retry.');
            }

            if (! $response->successful() || $response->json('error')) {
                return $this->error('CarryBee stats request failed (HTTP ' . $response->status() . ').');
            }

            $data = $response->json('data') ?? [];
            $total = (int) ($data['total_order'] ?? 0);
            $cancelled = (int) ($data['cancelled_order'] ?? 0);
            $delivered = max(0, $total - $cancelled);
            $successRate = isset($data['success_rate'])
                ? (float) $data['success_rate']
                : ($total > 0 ? round(($delivered / $total) * 100, 2) : 0);

            return [
                'total' => $total,
                'delivered' => $delivered,
                'cancelled' => $cancelled,
                'success_rate' => $successRate,
                'error' => null,
            ];
        } catch (\Throwable $e) {
            return $this->error('CarryBee request exception: ' . $e->getMessage());
        }
    }

    private function getAuth(CourierSetting $settings): ?array
    {
        return Cache::remember($this->cacheKey($settings), now()->addMinutes(55), function () use ($settings) {
            try {
                $jar = new CookieJar();
                $timeout = config('fraud_checker.http_timeout', 15);

                $csrf = Http::timeout($timeout)
                    ->withOptions(['cookies' => $jar])
                    ->withHeaders(self::HEADERS)
                    ->get(self::MERCHANT_BASE . '/api/auth/csrf');

                $csrfToken = $csrf->json('csrfToken');
                if (! $csrf->successful() || ! $csrfToken) {
                    return null;
                }

                $login = Http::timeout($timeout)
                    ->withOptions(['cookies' => $jar])
                    ->withHeaders(self::HEADERS)
                    ->asForm()
                    ->post(self::MERCHANT_BASE . '/api/auth/callback/login', [
                        'phone' => '+88' . ltrim($settings->carrybee_phone, '+88'),
                        'password' => $settings->carrybee_password,
                        'csrfToken' => $csrfToken,
                        'callbackUrl' => self::MERCHANT_BASE . '/login',
                    ]);

                if (! $login->successful()) {
                    return null;
                }

                $session = Http::timeout($timeout)
                    ->withOptions(['cookies' => $jar])
                    ->withHeaders(self::HEADERS)
                    ->get(self::MERCHANT_BASE . '/api/auth/session');

                $accessToken = $session->json('accessToken');
                $businessId = $session->json('user.selectedBusinessId');

                if (! $session->successful() || ! $accessToken || ! $businessId) {
                    return null;
                }

                return ['accessToken' => $accessToken, 'businessId' => $businessId];
            } catch (\Throwable $e) {
                return null;
            }
        });
    }

    private function cacheKey(CourierSetting $settings): string
    {
        return 'carrybee_fraud_session:' . $settings->id;
    }

    private function error(string $message): array
    {
        return ['total' => 0, 'delivered' => 0, 'cancelled' => 0, 'success_rate' => 0, 'error' => $message];
    }
}
