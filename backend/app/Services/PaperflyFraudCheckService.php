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
            $headers = ['Accept' => 'application/json, text/plain, */*'];
            if (! empty($settings->paperfly_api_key)) {
                $headers['paperflykey'] = $settings->paperfly_api_key;
            }

            // smart-check-v2.php — the old smart-check/list.php this used to call is dead:
            // it returns a fixed {totalRecords: 1, records: []} stub for literally any
            // phone number (verified live, including nonsense numbers). Reverse-engineered
            // from the merchant panel's Smart Check V2 dashboard network traffic
            // (2026-08-05); search_text is sent both as a query param and JSON body,
            // matching what the real client does.
            $response = Http::timeout(config('fraud_checker.http_timeout', 15))
                ->withToken($token)
                ->withHeaders($headers)
                ->post(self::BASE . '/smart-check/smart-check-v2.php?search_text=' . urlencode($phone), [
                    'search_text' => $phone,
                ]);

            if (! $response->successful()) {
                return $this->error('Paperfly stats request failed (HTTP ' . $response->status() . ').');
            }

            $total = (int) ($response->json('total') ?? 0);
            $delivered = (int) ($response->json('delivered') ?? 0);
            // Partial deliveries are folded into "cancelled" — our schema only tracks
            // delivered vs. not-delivered, and a partial delivery is still a risk signal.
            $cancelled = (int) ($response->json('returned') ?? 0) + (int) ($response->json('partial') ?? 0);

            // Paperfly's own delivery_rate is authoritative (their smart_check algorithm
            // may weight things differently than a plain delivered/(delivered+cancelled)
            // ratio) — fall back to computing it only if it's missing.
            $deliveryRate = $response->json('smart_check.delivery_rate');
            $successRate = $deliveryRate !== null
                ? round((float) $deliveryRate, 2)
                : (($delivered + $cancelled) > 0 ? round(($delivered / ($delivered + $cancelled)) * 100, 2) : 0);

            return [
                'total' => $total,
                'delivered' => $delivered,
                'cancelled' => $cancelled,
                'success_rate' => $successRate,
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
