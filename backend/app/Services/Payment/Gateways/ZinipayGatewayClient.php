<?php

namespace App\Services\Payment\Gateways;

use App\Contracts\PaymentGatewayClient;
use App\Models\PaymentGatewayCredential;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * ZiniPay — local mobile wallet aggregator API with server-to-server
 * invoice verification (query-then-trust). Phase B2 of customer-facing online payment.
 *
 * Flow:
 * 1. createPayment() POSTs JSON to https://api.zinipay.com/v1/payment/create with zini-api-key.
 * 2. Customer pays on ZiniPay checkout page (bKash/Nagad/Rocket/Upay/Cards).
 * 3. ZiniPay redirects to our callback URL / triggers webhook.
 * 4. verifyPayment() calls https://api.zinipay.com/v1/payment/verify server-to-server.
 */
class ZinipayGatewayClient implements PaymentGatewayClient
{
    private const CHECKOUT_URL = 'https://api.zinipay.com/v1/payment/create';
    private const VERIFY_URL = 'https://api.zinipay.com/v1/payment/verify';

    public function __construct(private readonly PaymentGatewayCredential $credential) {}

    private function apiKey(): ?string
    {
        return $this->credential->credentials['api_key'] ?? null;
    }

    public function isConfigured(): bool
    {
        return filled($this->apiKey());
    }

    public function createPayment(string $merchantTranId, float $amount, string $returnUrl, array $customer = []): array
    {
        $response = Http::withHeaders([
            'zini-api-key' => (string) $this->apiKey(),
            'accept' => 'application/json',
            'content-type' => 'application/json',
        ])->timeout(15)->post(self::CHECKOUT_URL, [
            'cus_name' => $customer['name'] ?? 'Customer',
            'cus_email' => $customer['email'] ?? 'customer@example.com',
            'cus_phone' => $customer['phone'] ?? 'N/A',
            'amount' => $amount,
            'metadata' => [
                'merchant_tran_id' => $merchantTranId,
            ],
            'redirect_url' => $returnUrl,
            'return_type' => 'GET',
            'cancel_url' => $returnUrl,
            'webhook_url' => $returnUrl,
        ]);

        $data = $response->json();
        $paymentUrl = $data['payment_url'] ?? null;
        $invoiceId = $data['invoice_id'] ?? $data['invoiceId'] ?? null;

        if (! $response->successful() || ! $paymentUrl) {
            Log::warning('ZiniPay createPayment failed', ['tran_id' => $merchantTranId, 'response' => $data]);
            $errorMsg = is_array($data) ? ($data['message'] ?? 'ZiniPay session initiation failed.') : 'ZiniPay session initiation failed.';
            throw new \RuntimeException((string) $errorMsg);
        }

        return [
            'redirect_url' => $paymentUrl,
            'provider_payment_id' => (string) ($invoiceId ?? $merchantTranId),
        ];
    }

    public function verifyPayment(string $merchantTranId, string $providerPaymentId, array $callbackData): array
    {
        // Always verify against OUR OWN stored invoice id, never one taken
        // from $callbackData — that comes straight off the customer's
        // browser (query string on a GET redirect), so a customer could
        // otherwise replay a DIFFERENT invoice_id they've genuinely
        // completed against this same seller (e.g. from a cheap unrelated
        // order) to fraudulently confirm a costlier, still-unpaid one.
        // $providerPaymentId is trustworthy — it was captured from
        // ZiniPay's own createPayment() response at initiate time, never
        // customer-influenced.
        $invoiceId = $providerPaymentId;

        $response = Http::withHeaders([
            'zini-api-key' => (string) $this->apiKey(),
            'accept' => 'application/json',
            'content-type' => 'application/json',
        ])->timeout(15)->post(self::VERIFY_URL, [
            'invoiceId' => $invoiceId,
            'apiKey' => $this->apiKey(),
        ]);

        $data = $response->json() ?? [];
        $valid = (($data['status'] ?? '') === 'COMPLETED');

        // Belt-and-suspenders: if ZiniPay does echo back the metadata we
        // sent at createPayment() time, cross-check it too. Not the
        // primary guard (that's using our own stored $providerPaymentId
        // above) since this field isn't guaranteed to be present.
        if ($valid && isset($data['metadata']['merchant_tran_id']) && $data['metadata']['merchant_tran_id'] !== $merchantTranId) {
            $valid = false;
        }

        if (! $valid) {
            Log::warning('ZiniPay verifyPayment did not validate', [
                'tran_id' => $merchantTranId,
                'invoice_id' => $invoiceId,
                'response' => $data,
            ]);
        }

        return [
            'success' => $valid,
            'trx_id' => $data['transaction_id'] ?? $data['invoice_id'] ?? $invoiceId,
            'amount' => isset($data['amount']) ? (float) $data['amount'] : null,
            'raw' => $data,
        ];
    }
}
