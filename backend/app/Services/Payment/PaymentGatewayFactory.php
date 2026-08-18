<?php

namespace App\Services\Payment;

use App\Contracts\PaymentGatewayClient;
use App\Models\PaymentGatewayCredential;
use App\Services\Payment\Gateways\SslcommerzGatewayClient;
use InvalidArgumentException;

/**
 * Mirrors CourierFactory's shape (app/Services/Courier/CourierFactory.php).
 * Phase B1 ships SSLCommerz only — AamarPay/ZiniPay (B2), ShurjoPay/EPS
 * (B3), bKash Merchant/Nagad Merchant (C1/C2) join this map as each is
 * built, per online_payment_context.md's build order.
 */
class PaymentGatewayFactory
{
    /** @var array<string, class-string<PaymentGatewayClient>> */
    private const PROVIDERS = [
        'sslcommerz' => SslcommerzGatewayClient::class,
    ];

    public static function make(string $provider, PaymentGatewayCredential $credential): PaymentGatewayClient
    {
        $class = self::PROVIDERS[$provider] ?? null;

        if (! $class) {
            throw new InvalidArgumentException("Unsupported payment gateway provider: {$provider}");
        }

        return new $class($credential);
    }

    public static function supports(string $provider): bool
    {
        return isset(self::PROVIDERS[$provider]);
    }

    /** @return string[] */
    public static function supportedProviders(): array
    {
        return array_keys(self::PROVIDERS);
    }
}
