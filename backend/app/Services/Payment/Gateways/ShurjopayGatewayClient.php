<?php

namespace App\Services\Payment\Gateways;

use App\Contracts\PaymentGatewayClient;
use App\Models\PaymentGatewayCredential;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * ShurjoPay — Bangladesh Bank licensed payment gateway with token-based
 * checkout and server-to-server transaction verification (query-then-trust).
 * Phase B3 of customer-facing online payment.
 *
 * Flow:
 * 1. authenticate() calls POST /api/get_token to get Bearer token.
 * 2. createPayment() calls POST /api/secret-pay and returns checkout_url.
 * 3. Customer pays on ShurjoPay hosted checkout page.
 * 4. ShurjoPay redirects to return_url?order_id={sp_order_id}.
 * 5. verifyPayment() calls POST /api/verification server-to-server.
 */
class ShurjopayGatewayClient implements PaymentGatewayClient
{
    private const SANDBOX_BASE = 'https://sandbox.shurjopayment.com/api';
    private const LIVE_BASE = 'https://engine.shurjopayment.com/api';

    public function __construct(private readonly PaymentGatewayCredential $credential) {}

    private function baseUrl(): string
    {
        return $this->credential->is_live ? self::LIVE_BASE : self::SANDBOX_BASE;
    }

    private function username(): ?string
    {
        return $this->credential->credentials['username'] ?? null;
    }

    private function password(): ?string
    {
        return $this->credential->credentials['password'] ?? null;
    }

    private function prefix(): ?string
    {
        return $this->credential->credentials['prefix'] ?? null;
    }

    public function isConfigured(): bool
    {
        return filled($this->username()) && filled($this->password()) && filled($this->prefix());
    }

    /**
     * Obtains auth token from ShurjoPay /get_token endpoint.
     *
     * @return array{token: string, store_id: ?string}
     */
    private function authenticate(): array
    {
        $response = Http::asJson()->timeout(15)->post($this->baseUrl() . '/get_token', [
            'username' => $this->username(),
            'password' => $this->password(),
        ]);

        $data = $response->json();
        $token = $data['token'] ?? null;

        if (! $response->successful() || ! $token) {
            Log::warning('ShurjoPay authentication failed', ['response' => $data]);
            $msg = $data['message'] ?? $data['sp_message'] ?? 'ShurjoPay authentication failed.';
            throw new \RuntimeException((string) $msg);
        }

        return [
            'token' => (string) $token,
            'store_id' => isset($data['store_id']) ? (string) $data['store_id'] : null,
        ];
    }

    public function createPayment(string $merchantTranId, float $amount, string $returnUrl, array $customer = []): array
    {
        $auth = $this->authenticate();
        $token = $auth['token'];
        $storeId = $auth['store_id'];

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$token}",
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ])->timeout(15)->post($this->baseUrl() . '/secret-pay', [
            'token' => $token,
            'store_id' => $storeId,
            'prefix' => $this->prefix(),
            'currency' => 'BDT',
            'return_url' => $returnUrl,
            'cancel_url' => $returnUrl,
            'amount' => $amount,
            'order_id' => $merchantTranId,
            'customer_name' => $customer['name'] ?? 'Customer',
            'customer_phone' => $customer['phone'] ?? '01700000000',
            'customer_address' => $customer['address'] ?? 'Dhaka',
            'customer_city' => 'Dhaka',
            'client_ip' => request()->ip() ?? '127.0.0.1',
        ]);

        $data = $response->json();
        $checkoutUrl = $data['checkout_url'] ?? null;
        $spOrderId = $data['sp_order_id'] ?? $data['order_id'] ?? null;

        if (! $response->successful() || ! $checkoutUrl) {
            Log::warning('ShurjoPay createPayment failed', ['tran_id' => $merchantTranId, 'response' => $data]);
            $errorMsg = $data['message'] ?? $data['sp_message'] ?? 'ShurjoPay payment initiation failed.';
            throw new \RuntimeException((string) $errorMsg);
        }

        return [
            'redirect_url' => $checkoutUrl,
            'provider_payment_id' => (string) ($spOrderId ?? $merchantTranId),
        ];
    }

    public function verifyPayment(string $merchantTranId, string $providerPaymentId, array $callbackData): array
    {
        $spOrderId = $callbackData['order_id'] ?? $callbackData['sp_order_id'] ?? $providerPaymentId;

        $auth = $this->authenticate();
        $token = $auth['token'];

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$token}",
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ])->timeout(15)->post($this->baseUrl() . '/verification', [
            'order_id' => $spOrderId,
        ]);

        $data = $response->json() ?? [];

        // Response can be a JSON array of records or a single record object
        $txn = isset($data[0]) && is_array($data[0]) ? $data[0] : $data;

        $spCode = (int) ($txn['sp_code'] ?? 0);
        $spMessage = strtolower((string) ($txn['sp_message'] ?? ''));
        $status = strtolower((string) ($txn['transaction_status'] ?? ''));

        $valid = ($spCode === 1000 || in_array($spMessage, ['success', 'successful'], true) || in_array($status, ['completed', 'success', 'successful'], true));

        // Tampering guard: verified customer_order_id must match our merchantTranId
        if ($valid && isset($txn['customer_order_id']) && $txn['customer_order_id'] !== $merchantTranId) {
            $valid = false;
        }

        if (! $valid) {
            Log::warning('ShurjoPay verifyPayment did not validate', [
                'tran_id' => $merchantTranId,
                'sp_order_id' => $spOrderId,
                'response' => $data,
            ]);
        }

        return [
            'success' => $valid,
            'trx_id' => $txn['bank_trx_id'] ?? $txn['order_id'] ?? $spOrderId,
            'amount' => isset($txn['amount']) ? (float) $txn['amount'] : null,
            'raw' => $data,
        ];
    }
}
