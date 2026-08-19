<?php

namespace App\Services\Payment;

use App\Contracts\PaymentGatewayClient;
use App\Models\PaymentGatewayCredential;
use App\Services\Payment\Gateways\AamarpayGatewayClient;
use App\Services\Payment\Gateways\BkashMerchantGatewayClient;
use App\Services\Payment\Gateways\EpsGatewayClient;
use App\Services\Payment\Gateways\NagadMerchantGatewayClient;
use App\Services\Payment\Gateways\ShurjopayGatewayClient;
use App\Services\Payment\Gateways\SslcommerzGatewayClient;
use App\Services\Payment\Gateways\ZinipayGatewayClient;
use InvalidArgumentException;

/**
 * Mirrors CourierFactory's shape (app/Services/Courier/CourierFactory.php).
 * All 7 originally planned providers now supported: Phase B1 (SSLCommerz),
 * Phase B2 (AamarPay, ZiniPay), Phase B3 (ShurjoPay, EPS), Phase C1/C2
 * (bKash Merchant, Nagad Merchant). See online_payment_context.md.
 */
class PaymentGatewayFactory
{
    /** @var array<string, class-string<PaymentGatewayClient>> */
    private const PROVIDERS = [
        'sslcommerz' => SslcommerzGatewayClient::class,
        'aamarpay' => AamarpayGatewayClient::class,
        'zinipay' => ZinipayGatewayClient::class,
        'shurjopay' => ShurjopayGatewayClient::class,
        'eps' => EpsGatewayClient::class,
        'bkash_merchant' => BkashMerchantGatewayClient::class,
        'nagad_merchant' => NagadMerchantGatewayClient::class,
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
