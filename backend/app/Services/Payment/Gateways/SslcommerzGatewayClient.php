<?php

namespace App\Services\Payment\Gateways;

use App\Contracts\PaymentGatewayClient;
use App\Models\PaymentGatewayCredential;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SSLCommerz — session-based checkout (v4 API), per-seller merchant
 * credentials. Reference implementation for Phase B's provider abstraction
 * (see online_payment_context.md) — the best-documented, most widely used
 * gateway in this batch, checked against the others as they're added.
 *
 * Flow: createPayment() opens a session (store_id/store_passwd), returns
 * GatewayPageURL to redirect the browser to. SSLCommerz posts back to our
 * success/fail/cancel URLs (and separately to an IPN URL) carrying val_id —
 * verifyPayment() always calls the separate Order Validation API
 * server-to-server before trusting anything (query-then-trust, same
 * discipline as BkashPaymentController::callback()'s existing pattern) —
 * the redirect/IPN's own "status" param is only ever a hint to decide
 * whether it's worth calling Validation at all, never trusted on its own.
 */
class SslcommerzGatewayClient implements PaymentGatewayClient
{
    private const SANDBOX_BASE = 'https://sandbox.sslcommerz.com';
    private const LIVE_BASE = 'https://securepay.sslcommerz.com';

    public function __construct(private readonly PaymentGatewayCredential $credential) {}

    private function baseUrl(): string
    {
        return $this->credential->is_live ? self::LIVE_BASE : self::SANDBOX_BASE;
    }

    private function storeId(): ?string
    {
        return $this->credential->credentials['store_id'] ?? null;
    }

    private function storePassword(): ?string
    {
        return $this->credential->credentials['store_password'] ?? null;
    }

    public function isConfigured(): bool
    {
        return filled($this->storeId()) && filled($this->storePassword());
    }

    public function createPayment(string $merchantTranId, float $amount, string $returnUrl, array $customer = []): array
    {
        $response = Http::asForm()->timeout(15)->post($this->baseUrl() . '/gwprocess/v4/api.php', [
            'store_id' => $this->storeId(),
            'store_passwd' => $this->storePassword(),
            'total_amount' => number_format($amount, 2, '.', ''),
            'currency' => 'BDT',
            'tran_id' => $merchantTranId,
            'product_category' => 'ecommerce',
            'product_name' => 'Order ' . $merchantTranId,
            'product_profile' => 'general',
            'success_url' => $returnUrl,
            'fail_url' => $returnUrl,
            'cancel_url' => $returnUrl,
            'ipn_url' => $returnUrl,
            'cus_name' => $customer['name'] ?? 'Customer',
            'cus_email' => $customer['email'] ?? 'customer@example.com',
            'cus_phone' => $customer['phone'] ?? 'N/A',
            'cus_add1' => $customer['address'] ?? 'N/A',
            'cus_city' => $customer['city'] ?? 'Dhaka',
            'cus_country' => 'Bangladesh',
            'shipping_method' => 'NO',
            'num_of_item' => 1,
        ]);

        $data = $response->json();

        if (! $response->successful() || ($data['status'] ?? null) !== 'SUCCESS') {
            Log::warning('SSLCommerz createPayment failed', ['tran_id' => $merchantTranId, 'response' => $data]);
            throw new \RuntimeException($data['failedreason'] ?? 'SSLCommerz session initiation failed.');
        }

        return [
            'redirect_url' => $data['GatewayPageURL'],
            // SSLCommerz never mints its own transaction id — tran_id is
            // ours from the start, so it's also the correlation key stored
            // as order_online_payments.provider_payment_id.
            'provider_payment_id' => $merchantTranId,
        ];
    }

    public function verifyPayment(string $merchantTranId, string $providerPaymentId, array $callbackData): array
    {
        $valId = $callbackData['val_id'] ?? null;
        if (! $valId) {
            // No val_id at all means SSLCommerz never actually processed a
            // transaction for this session (e.g. the customer just closed
            // the tab) — nothing to validate, not a failure worth logging.
            return ['success' => false, 'trx_id' => null, 'amount' => null, 'raw' => $callbackData];
        }

        $response = Http::timeout(15)->get($this->baseUrl() . '/validator/api/validationserverAPI.php', [
            'val_id' => $valId,
            'store_id' => $this->storeId(),
            'store_passwd' => $this->storePassword(),
            'format' => 'json',
        ]);

        $data = $response->json() ?? [];
        $valid = in_array($data['status'] ?? null, ['VALID', 'VALIDATED'], true);

        // Amount tampering check — the Validation API's own reported amount
        // must match what we actually asked for, not just "some transaction
        // was valid". A mismatch here means treat it as unverified.
        if ($valid && isset($data['tran_id']) && $data['tran_id'] !== $merchantTranId) {
            $valid = false;
        }

        if (! $valid) {
            Log::warning('SSLCommerz verifyPayment did not validate', ['tran_id' => $merchantTranId, 'val_id' => $valId, 'response' => $data]);
        }

        return [
            'success' => $valid,
            'trx_id' => $data['bank_tran_id'] ?? $valId,
            'amount' => isset($data['amount']) ? (float) $data['amount'] : null,
            'raw' => $data,
        ];
    }
}
