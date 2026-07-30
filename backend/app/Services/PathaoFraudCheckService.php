<?php

namespace App\Services;

use App\Models\CourierSetting;
use App\Services\Contracts\CourierFraudCheckInterface;
use Illuminate\Support\Facades\Http;

/**
 * Fetches delivery-success stats from Pathao's merchant dashboard (merchant.pathao.com).
 * This is a separate login flow from the official Aladdin booking API (api-hermes.pathao.com) —
 * the dashboard is the only place that exposes a per-phone success/cancel breakdown.
 */
class PathaoFraudCheckService implements CourierFraudCheckInterface
{
    private const BASE = 'https://merchant.pathao.com/api/v1';

    public function checkPhone(CourierSetting $settings, string $phone): array
    {
        if (empty($settings->pathao_username) || empty($settings->pathao_password)) {
            return $this->error('Pathao dashboard credentials not configured.');
        }

        $timeout = config('fraud_checker.http_timeout', 15);

        try {
            $login = Http::timeout($timeout)->post(self::BASE . '/login', [
                'username' => $settings->pathao_username,
                'password' => $settings->pathao_password,
            ]);

            if (! $login->successful()) {
                return $this->error('Pathao login failed (HTTP ' . $login->status() . ').');
            }

            $accessToken = trim((string) ($login->json('access_token') ?? ''));
            if ($accessToken === '') {
                return $this->error('Pathao login returned no access token.');
            }

            $stats = Http::timeout($timeout)
                ->withToken($accessToken)
                ->post(self::BASE . '/user/success', ['phone' => $phone]);

            if (! $stats->successful()) {
                return $this->error('Pathao stats request failed (HTTP ' . $stats->status() . ').');
            }

            $customer = $stats->json('data.customer') ?? [];
            $total = (int) ($customer['total_delivery'] ?? 0);
            $delivered = (int) ($customer['successful_delivery'] ?? 0);
            $cancelled = max(0, $total - $delivered);

            return [
                'total' => $total,
                'delivered' => $delivered,
                'cancelled' => $cancelled,
                'success_rate' => $total > 0 ? round(($delivered / $total) * 100, 2) : 0,
                'error' => null,
            ];
        } catch (\Throwable $e) {
            return $this->error('Pathao request exception: ' . $e->getMessage());
        }
    }

    private function error(string $message): array
    {
        return ['total' => 0, 'delivered' => 0, 'cancelled' => 0, 'success_rate' => 0, 'error' => $message];
    }
}
