<?php

namespace App\Services;

use App\Models\CourierSetting;
use App\Services\Contracts\CourierFraudCheckInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class PaperflyFraudCheckService implements CourierFraudCheckInterface
{
    private const BASE = 'https://go-app.paperfly.com.bd/merchant/api/react';

    public function checkPhone(CourierSetting $settings, string $phone): array
    {
        if (empty($settings->paperfly_username) || empty($settings->paperfly_password)) {
            return $this->error('Paperfly credentials not configured.');
        }

        $token = $this->getToken($settings);
        if (! $token) {
            return $this->error('Paperfly login failed or no token received.');
        }

        try {
            $response = Http::timeout(config('fraud_checker.http_timeout', 15))
                ->withToken($token)
                ->withHeaders(['Accept' => 'application/json, text/plain, */*'])
                ->post(self::BASE . '/smart-check/list.php', [
                    'search_text' => $phone,
                    'limit' => 50,
                    'page' => 1,
                ]);

            if (! $response->successful()) {
                return $this->error('Paperfly stats request failed (HTTP ' . $response->status() . ').');
            }

            $total = (int) ($response->json('totalRecords') ?? 0);
            $records = $response->json('records') ?? [];

            $delivered = 0;
            $cancelled = 0;
            foreach ($records as $record) {
                $status = strtolower((string) ($record['status'] ?? ''));
                if (str_contains($status, 'delivered') || str_contains($status, 'success')) {
                    $delivered++;
                } elseif (str_contains($status, 'return') || str_contains($status, 'cancel') || str_contains($status, 'fail')) {
                    $cancelled++;
                }
            }

            $parsed = $delivered + $cancelled;

            return [
                'total' => $total,
                'delivered' => $delivered,
                'cancelled' => $cancelled,
                'success_rate' => $parsed > 0 ? round(($delivered / $parsed) * 100, 2) : 0,
                'error' => null,
            ];
        } catch (\Throwable $e) {
            return $this->error('Paperfly request exception: ' . $e->getMessage());
        }
    }

    private function getToken(CourierSetting $settings): ?string
    {
        return Cache::remember($this->cacheKey($settings), now()->addMinutes(55), function () use ($settings) {
            try {
                $response = Http::timeout(config('fraud_checker.http_timeout', 15))
                    ->post(self::BASE . '/authentication/login_using_password.php', [
                        'username' => $settings->paperfly_username,
                        'password' => $settings->paperfly_password,
                    ]);

                if (! $response->successful()) {
                    return null;
                }

                return $response->json('token');
            } catch (\Throwable $e) {
                return null;
            }
        });
    }

    private function cacheKey(CourierSetting $settings): string
    {
        return 'paperfly_fraud_token:' . $settings->id;
    }

    private function error(string $message): array
    {
        return ['total' => 0, 'delivered' => 0, 'cancelled' => 0, 'success_rate' => 0, 'error' => $message];
    }
}
