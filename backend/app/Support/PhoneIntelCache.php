<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Cache;

class PhoneIntelCache
{
    public static function normalizePhone(?string $phone): string
    {
        $digits = preg_replace('/\D/', '', (string) $phone) ?? '';

        if (str_starts_with($digits, '880') && strlen($digits) >= 13) {
            $digits = '0' . substr($digits, -10);
        }

        return substr($digits, -11);
    }

    public static function phone10(?string $phone): string
    {
        return substr(self::normalizePhone($phone), -10);
    }

    public static function remember(
        string $scope,
        string $phone10,
        int $ttlSeconds,
        Closure $callback,
        ?int $userId = null,
    ): mixed {
        if (strlen($phone10) !== 10) {
            return $callback();
        }

        $version = self::version($phone10);
        $userKey = $userId ? ":u:{$userId}" : '';
        $key     = "phone-intel:{$scope}:v{$version}:{$phone10}{$userKey}";

        return Cache::remember($key, $ttlSeconds, $callback);
    }

    public static function bump(?string $phone): void
    {
        $phone10 = self::phone10($phone);
        if (strlen($phone10) !== 10) {
            return;
        }

        $versionKey = self::versionKey($phone10);
        $current    = (int) Cache::get($versionKey, 1);
        Cache::forever($versionKey, $current + 1);
    }

    private static function version(string $phone10): int
    {
        return (int) Cache::get(self::versionKey($phone10), 1);
    }

    private static function versionKey(string $phone10): string
    {
        return "phone-intel:version:{$phone10}";
    }
}
