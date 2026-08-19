<?php

namespace App\Services\Payment\Gateways;

use App\Contracts\PaymentGatewayClient;
use App\Models\PaymentGatewayCredential;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * AamarPay — hosted checkout JSON API with server-to-server transaction status
 * verification (query-then-trust). Phase B2 of customer-facing online payment.
 *
 * Flow:
 * 1. createPayment() POSTs JSON to /jsonpost.php and gets payment_url.
 * 2. Customer pays on AamarPay hosted page.
 * 3. AamarPay redirects to our callback URL (carrying mer_txnid/pg_txnid).
 * 4. verifyPayment() calls /api/v1/trxcheck/request.php server-to-server to
 *    confirm the transaction and guard against tampering.
 */
class AamarpayGatewayClient implements PaymentGatewayClient
{
    private const SANDBOX_BASE = 'https://sandbox.aamarpay.com';
    private const LIVE_BASE = 'https://secure.aamarpay.com';

    public function __construct(private readonly PaymentGatewayCredential $credential) {}

    private function baseUrl(): string
    {
        return $this->credential->is_live ? self::LIVE_BASE : self::SANDBOX_BASE;
    }

    private function storeId(): ?string
    {
        return $this->credential->credentials['store_id'] ?? null;
    }

    private function signatureKey(): ?string
    {
        return $this->credential->credentials['signature_key'] ?? null;
    }

    public function isConfigured(): bool
    {
        return filled($this->storeId()) && filled($this->signatureKey());
    }

    public function createPayment(string $merchantTranId, float $amount, string $returnUrl, array $customer = []): array
    {
        $response = Http::asJson()->timeout(15)->post($this->baseUrl() . '/jsonpost.php', [
            'store_id' => $this->storeId(),
            'signature_key' => $this->signatureKey(),
            'tran_id' => $merchantTranId,
            'amount' => number_format($amount, 2, '.', ''),
            'currency' => 'BDT',
            'desc' => 'Order ' . $merchantTranId,
            'cus_name' => $customer['name'] ?? 'Customer',
            'cus_email' => $customer['email'] ?? 'customer@example.com',
            'cus_phone' => $customer['phone'] ?? 'N/A',
            'cus_add1' => $customer['address'] ?? 'N/A',
            'cus_city' => $customer['city'] ?? 'Dhaka',
            'cus_country' => 'Bangladesh',
            'success_url' => $returnUrl,
            'fail_url' => $returnUrl,
            'cancel_url' => $returnUrl,
            'opt_a' => $merchantTranId,
            'type' => 'json',
        ]);

        $data = $response->json();

        $paymentUrl = $data['payment_url'] ?? null;
        $result = $data['result'] ?? null;

        if (! $response->successful() || (! $paymentUrl && $result !== 'true')) {
            Log::warning('AamarPay createPayment failed', ['tran_id' => $merchantTranId, 'response' => $data]);
            $errorMsg = is_array($data) ? ($data['message'] ?? $data['errors'] ?? 'AamarPay session initiation failed.') : 'AamarPay session initiation failed.';
            throw new \RuntimeException(is_array($errorMsg) ? json_encode($errorMsg) : (string) $errorMsg);
        }

        return [
            'redirect_url' => $paymentUrl,
            'provider_payment_id' => $merchantTranId,
        ];
    }

    public function verifyPayment(string $merchantTranId, string $providerPaymentId, array $callbackData): array
    {
        $requestId = $callbackData['mer_txnid'] ?? $callbackData['opt_a'] ?? $merchantTranId;

        $response = Http::timeout(15)->get($this->baseUrl() . '/api/v1/trxcheck/request.php', [
            'request_id' => $requestId,
            'store_id' => $this->storeId(),
            'signature_key' => $this->signatureKey(),
            'type' => 'json',
        ]);

        $data = $response->json() ?? [];

        $statusCode = (int) ($data['status_code'] ?? 0);
        $payStatus = (string) ($data['pay_status'] ?? '');
        $valid = ($statusCode === 2 || strcasecmp($payStatus, 'Successful') === 0);

        // Tampering guard: verified mer_txnid must match what we initiated
        if ($valid && isset($data['mer_txnid']) && $data['mer_txnid'] !== $merchantTranId) {
            $valid = false;
        }

        if (! $valid) {
            Log::warning('AamarPay verifyPayment did not validate', [
                'tran_id' => $merchantTranId,
                'request_id' => $requestId,
                'response' => $data,
            ]);
        }

        return [
            'success' => $valid,
            'trx_id' => $data['pg_txnid'] ?? $data['mer_txnid'] ?? null,
            'amount' => isset($data['amount']) ? (float) $data['amount'] : null,
            'raw' => $data,
        ];
    }
}
