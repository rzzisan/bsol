<?php

namespace App\Contracts;

/**
 * Common shape every automated merchant-gateway provider (SSLCommerz,
 * AamarPay, ZiniPay, ShurjoPay, EPS, bKash Merchant, Nagad Merchant)
 * implements — Phase B/C of customer-facing online payment. See
 * online_payment_context.md.
 */
interface PaymentGatewayClient
{
    public function isConfigured(): bool;

    /**
     * Mint a hosted checkout session. $merchantTranId is a string we always
     * generate ourselves and pass to every provider uniformly, whether or
     * not that provider also mints its own opaque id.
     *
     * @param array<string, mixed> $customer
     * @return array{redirect_url: string, provider_payment_id: string}
     */
    public function createPayment(string $merchantTranId, float $amount, string $returnUrl, array $customer = []): array;

    /**
     * Called from both the browser-redirect callback and the server-to-
     * server IPN/webhook — must always re-verify against the provider's own
     * server (query-then-trust, same discipline as
     * BkashPaymentController::callback()'s existing pattern). Never trust
     * $callbackData's own status field alone.
     *
     * @param array<string, mixed> $callbackData
     * @return array{success: bool, trx_id: ?string, amount: ?float, raw: array<string, mixed>}
     */
    public function verifyPayment(string $merchantTranId, string $providerPaymentId, array $callbackData): array;
}
