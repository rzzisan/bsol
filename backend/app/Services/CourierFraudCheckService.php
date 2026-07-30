<?php

namespace App\Services;

use App\Models\CourierFraudStat;
use App\Models\CourierSetting;
use App\Services\Contracts\CourierFraudCheckInterface;
use App\Support\PhoneIntelCache;

/**
 * Aggregates delivery-success stats for a phone number across the couriers the
 * requesting user has credentials for, backed by a shared (phone, courier) cache
 * so the same phone isn't re-queried against courier servers on every check.
 */
class CourierFraudCheckService
{
    private const COURIERS = ['pathao', 'steadfast', 'redx', 'carrybee', 'paperfly'];

    public function check(int $userId, string $rawPhone): array
    {
        $phone = PhoneIntelCache::normalizePhone($rawPhone);

        if (strlen($phone) !== 11 || ! str_starts_with($phone, '0')) {
            return ['success' => false, 'message' => 'Invalid phone number format. Use 01xxxxxxxxx.'];
        }

        $settings = CourierSetting::where('user_id', $userId)->first();

        $cards = [];
        foreach (self::COURIERS as $courier) {
            if (! $settings || ! $this->isConfigured($courier, $settings)) {
                $cards[] = $this->notConfiguredCard($courier);
                continue;
            }

            $cached = CourierFraudStat::where('phone_number', $phone)
                ->where('courier_name', $courier)
                ->first();

            if ($cached && $this->isFresh($cached)) {
                $cards[] = $this->cardFromModel($courier, $cached);
                continue;
            }

            $result = $this->resolveService($courier)->checkPhone($settings, $phone);
            $status = $result['error'] ? 'error' : 'ok';

            $row = CourierFraudStat::updateOrCreate(
                ['phone_number' => $phone, 'courier_name' => $courier],
                [
                    'total_parcels' => $result['total'],
                    'total_delivered' => $result['delivered'],
                    'total_cancelled' => $result['cancelled'],
                    'success_rate' => $result['success_rate'],
                    'status' => $status,
                    'error_message' => $result['error'],
                    'fetched_by_user_id' => $userId,
                    'last_checked_at' => now(),
                ]
            );

            $cards[] = $this->cardFromModel($courier, $row);
        }

        return [
            'success' => true,
            'data' => [
                'phone' => $phone,
                'overall' => $this->buildOverall($cards),
                'couriers' => $cards,
            ],
        ];
    }

    private function isFresh(CourierFraudStat $row): bool
    {
        if (! $row->last_checked_at) {
            return false;
        }

        $ageMinutes = $row->last_checked_at->diffInMinutes(now());

        return $row->status === 'ok'
            ? $ageMinutes < config('fraud_checker.cache_ttl_hours', 24) * 60
            : $ageMinutes < config('fraud_checker.error_cooldown_minutes', 30);
    }

    private function isConfigured(string $courier, CourierSetting $settings): bool
    {
        return match ($courier) {
            'pathao' => ! empty($settings->pathao_username) && ! empty($settings->pathao_password),
            'steadfast' => ! empty($settings->steadfast_api_key) && ! empty($settings->steadfast_secret_key),
            'redx' => ! empty($settings->redx_phone) && ! empty($settings->redx_password),
            'carrybee' => ! empty($settings->carrybee_phone) && ! empty($settings->carrybee_password),
            'paperfly' => ! empty($settings->paperfly_username) && ! empty($settings->paperfly_password),
            default => false,
        };
    }

    private function resolveService(string $courier): CourierFraudCheckInterface
    {
        return match ($courier) {
            'pathao' => new PathaoFraudCheckService(),
            'steadfast' => new SteadfastFraudCheckService(),
            'redx' => new RedxFraudCheckService(),
            'carrybee' => new CarrybeeFraudCheckService(),
            'paperfly' => new PaperflyFraudCheckService(),
        };
    }

    private function cardFromModel(string $courier, CourierFraudStat $row): array
    {
        return [
            'name' => $courier,
            'total' => $row->total_parcels,
            'success' => $row->total_delivered,
            'cancelled' => $row->total_cancelled,
            'success_rate' => $row->success_rate,
            'status' => $row->status,
            'message' => $row->error_message,
            'last_checked_at' => optional($row->last_checked_at)->toISOString(),
        ];
    }

    private function notConfiguredCard(string $courier): array
    {
        return [
            'name' => $courier,
            'total' => 0,
            'success' => 0,
            'cancelled' => 0,
            'success_rate' => 0,
            'status' => 'not_configured',
            'message' => null,
            'last_checked_at' => null,
        ];
    }

    private function buildOverall(array $cards): array
    {
        $ok = array_filter($cards, fn ($c) => $c['status'] === 'ok');
        $total = array_sum(array_column($ok, 'total'));
        $success = array_sum(array_column($ok, 'success'));
        $cancelled = array_sum(array_column($ok, 'cancelled'));

        return [
            'total' => $total,
            'success' => $success,
            'cancelled' => $cancelled,
            'success_rate' => $total > 0 ? round(($success / $total) * 100, 2) : 0,
        ];
    }
}
