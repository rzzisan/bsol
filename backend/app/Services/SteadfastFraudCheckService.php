<?php

namespace App\Services;

use App\Models\CourierSetting;
use App\Services\Contracts\CourierFraudCheckInterface;

/**
 * Thin adapter over SteadfastService::fraudCheck() so Steadfast fits the same
 * CourierFraudCheckInterface used by the scraped couriers, even though it's
 * stateless (official api_key/secret_key header auth, no login flow).
 */
class SteadfastFraudCheckService implements CourierFraudCheckInterface
{
    public function __construct(private readonly SteadfastService $steadfast = new SteadfastService())
    {
    }

    public function checkPhone(CourierSetting $settings, string $phone): array
    {
        if (empty($settings->steadfast_api_key) || empty($settings->steadfast_secret_key)) {
            return $this->error('Steadfast API credentials not configured.');
        }

        $result = $this->steadfast->fraudCheck($settings->steadfast_api_key, $settings->steadfast_secret_key, $phone);

        if (! isset($result['total_delivered']) && ! isset($result['total_parcels'])) {
            return $this->error($result['message'] ?? 'Steadfast fraud_check request failed.');
        }

        $delivered = (int) ($result['total_delivered'] ?? 0);
        $cancelled = (int) ($result['total_cancelled'] ?? 0);
        $total = (int) ($result['total_parcels'] ?? ($delivered + $cancelled));

        return [
            'total' => $total,
            'delivered' => $delivered,
            'cancelled' => $cancelled,
            'success_rate' => $total > 0 ? round(($delivered / $total) * 100, 2) : 0,
            'error' => null,
        ];
    }

    private function error(string $message): array
    {
        return ['total' => 0, 'delivered' => 0, 'cancelled' => 0, 'success_rate' => 0, 'error' => $message];
    }
}
