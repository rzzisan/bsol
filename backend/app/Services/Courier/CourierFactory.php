<?php

namespace App\Services\Courier;

class CourierFactory
{
    /**
     * @var array<string, class-string<CourierProviderInterface>>
     */
    private const PROVIDERS = [
        'steadfast' => SteadfastCourierProvider::class,
        'pathao'    => PathaoCourierProvider::class,
        'redx'      => RedxCourierProvider::class,
        'carrybee'  => CarrybeeCourierProvider::class,
    ];

    public static function make(?string $courier): ?CourierProviderInterface
    {
        $class = self::PROVIDERS[$courier] ?? null;

        return $class ? new $class() : null;
    }

    public static function supports(string $courier): bool
    {
        return isset(self::PROVIDERS[$courier]);
    }
}
