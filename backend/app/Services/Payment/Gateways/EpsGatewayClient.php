<?php

namespace App\Services\Payment\Gateways;

use App\Contracts\PaymentGatewayClient;
use App\Models\PaymentGatewayCredential;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * EPS (Easy Payment System) — Bangladesh Bank licensed aggregator (bKash/
 * Nagad/Rocket/cards/banks in one integration). Final Phase B provider —
 * see online_payment_context.md.
 *
 * eps.com.bd publishes no public REST reference docs; this implementation
 * is grounded directly in EPS's own official reference code
 * (github.com/EPS-PG/EPS_PHP, Sandbox&ProductionPhP.php) — real endpoint
 * paths, header/hash scheme and field names, not guesswork.
 *
 * Flow:
 * 1. getToken() — POST /v1/Auth/GetToken, x-hash header =
 *    base64(HMAC-SHA512(username, hashKey)), body {userName, password} →
 *    {token}.
 * 2. createPayment() — POST /v1/EPSEngine/InitializeEPS, Bearer token +
 *    x-hash = base64(HMAC-SHA512(merchantTranId, hashKey)) → {RedirectURL}.
 * 3. Customer pays on EPS's hosted page, redirected back to our callback URL.
 * 4. verifyPayment() — GET /v1/EPSEngine/CheckMerchantTransactionStatus
 *    ?merchantTransactionId=... — always queried with OUR OWN stored
 *    provider_payment_id, never a customer-suppliable callback param (the
 *    same discipline the ZiniPay tampering fix established — see
 *    online_payment_context.md). Same x-hash/Bearer scheme; response is a
 *    FLAT object with PascalCase keys (Status, MerchantTransactionId,
 *    EPSTransactionId, TotalAmount) — confirmed against a real sandbox
 *    card-test response 2026-08-19, NOT the nested/lowercase shape the
 *    official PHP sample's prose implied (that mismatch was this
 *    integration's first live bug — sandbox payments succeeded on EPS's
 *    side but our verify() never recognized them). Always-verify-our-own-id
 *    is the primary tampering guard; MerchantTransactionId is also echoed
 *    back and cross-checked as a secondary one.
 */
class EpsGatewayClient implements PaymentGatewayClient
{
    private const SANDBOX_BASE = 'https://sandboxpgapi.eps.com.bd';
    private const LIVE_BASE = 'https://pgapi.eps.com.bd';

    public function __construct(private readonly PaymentGatewayCredential $credential) {}

    private function baseUrl(): string
    {
        return $this->credential->is_live ? self::LIVE_BASE : self::SANDBOX_BASE;
    }

    private function merchantId(): ?string
    {
        return $this->credential->credentials['merchant_id'] ?? null;
    }

    private function storeId(): ?string
    {
        return $this->credential->credentials['store_id'] ?? null;
    }

    private function username(): ?string
    {
        return $this->credential->credentials['username'] ?? null;
    }

    private function password(): ?string
    {
        return $this->credential->credentials['password'] ?? null;
    }

    private function hashKey(): ?string
    {
        return $this->credential->credentials['hash_key'] ?? null;
    }

    public function isConfigured(): bool
    {
        return filled($this->merchantId()) && filled($this->storeId()) && filled($this->username())
            && filled($this->password()) && filled($this->hashKey());
    }

    /** EPS's own request-signing scheme (matches their official reference
     *  implementation exactly): base64(HMAC-SHA512($data, hash_key)). */
    private function sign(string $data): string
    {
        return base64_encode(hash_hmac('sha512', $data, (string) $this->hashKey(), true));
    }

    private function getToken(): string
    {
        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
            'x-hash' => $this->sign((string) $this->username()),
        ])->timeout(15)->post($this->baseUrl() . '/v1/Auth/GetToken', [
            'userName' => $this->username(),
            'password' => $this->password(),
        ]);

        $data = $response->json();
        $token = $data['token'] ?? null;

        if (! $response->successful() || ! $token) {
            Log::warning('EPS getToken failed', ['response' => $data]);
            throw new \RuntimeException(is_array($data) ? ($data['message'] ?? 'EPS authentication failed.') : 'EPS authentication failed.');
        }

        return (string) $token;
    }

    public function createPayment(string $merchantTranId, float $amount, string $returnUrl, array $customer = []): array
    {
        $token = $this->getToken();

        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
            'x-hash' => $this->sign($merchantTranId),
            'Authorization' => "Bearer {$token}",
        ])->timeout(15)->post($this->baseUrl() . '/v1/EPSEngine/InitializeEPS', [
            'merchantId' => $this->merchantId(),
            'storeId' => $this->storeId(),
            'CustomerOrderId' => $merchantTranId,
            'merchantTransactionId' => $merchantTranId,
            'transactionTypeId' => 1,
            'totalAmount' => (float) number_format($amount, 2, '.', ''),
            'successUrl' => $returnUrl,
            'failUrl' => $returnUrl,
            'cancelUrl' => $returnUrl,
            'customerName' => $customer['name'] ?? 'Customer',
            'customerEmail' => $customer['email'] ?? 'customer@example.com',
            'customerAddress' => $customer['address'] ?? 'N/A',
            'customerCity' => $customer['city'] ?? 'Dhaka',
            'customerState' => 'Dhaka',
            'customerPostcode' => '1200',
            'customerCountry' => 'BD',
            'customerPhone' => $customer['phone'] ?? '01700000000',
            'productName' => 'Order ' . $merchantTranId,
            'productProfile' => 'general',
            'productCategory' => 'ecommerce',
        ]);

        $data = $response->json();
        $redirectUrl = $data['RedirectURL'] ?? null;

        if (! $response->successful() || ! $redirectUrl) {
            Log::warning('EPS createPayment failed', ['tran_id' => $merchantTranId, 'response' => $data]);
            $errorMsg = is_array($data) ? ($data['message'] ?? $data['ErrorMessage'] ?? 'EPS session initiation failed.') : 'EPS session initiation failed.';
            throw new \RuntimeException((string) $errorMsg);
        }

        return [
            'redirect_url' => $redirectUrl,
            // EPS never mints its own id — merchantTransactionId is ours
            // from the start, same as SSLCommerz's tran_id.
            'provider_payment_id' => $merchantTranId,
        ];
    }

    public function verifyPayment(string $merchantTranId, string $providerPaymentId, array $callbackData): array
    {
        // Deliberately ignores $callbackData for choosing which transaction
        // to check — always queries OUR OWN stored $providerPaymentId. EPS's
        // status API doesn't echo back an independent id to cross-check
        // after the fact, so unlike SSLCommerz/AamarPay/ShurjoPay (which
        // verify-then-match), this client never gives a customer-suppliable
        // value a chance to influence the lookup in the first place.
        $token = $this->getToken();

        $response = Http::withHeaders([
            'x-hash' => $this->sign($providerPaymentId),
            'Authorization' => "Bearer {$token}",
        ])->timeout(15)->get($this->baseUrl() . '/v1/EPSEngine/CheckMerchantTransactionStatus', [
            'merchantTransactionId' => $providerPaymentId,
        ]);

        $data = $response->json() ?? [];
        // Confirmed against EPS's real sandbox response (2026-08-19 live
        // test): a FLAT object with PascalCase keys — Status,
        // MerchantTransactionId, EPSTransactionId, TotalAmount,
        // StoreAmount — not the nested/lowercase shape the official PHP
        // sample's prose implied. Old camelCase/nested fallbacks kept in
        // case live differs from sandbox, but PascalCase is now primary.
        $nested = $data['data'] ?? $data['Data'] ?? [];
        $status = strtoupper((string) (
            $data['Status'] ?? $data['status'] ?? $data['transactionStatus']
            ?? $nested['Status'] ?? $nested['status'] ?? $nested['transactionStatus'] ?? ''
        ));

        $valid = in_array($status, ['SUCCESS', 'COMPLETED', 'SUCCESSFUL'], true);

        // Belt-and-suspenders: EPS's real response does echo back
        // MerchantTransactionId, so cross-check it too — even though the
        // primary guard is already "we only ever query our own stored id"
        // (see class docblock; $providerPaymentId never comes from
        // $callbackData).
        $echoedTranId = $data['MerchantTransactionId'] ?? $nested['MerchantTransactionId'] ?? null;
        if ($valid && $echoedTranId !== null && (string) $echoedTranId !== $providerPaymentId) {
            $valid = false;
        }

        if (! $valid) {
            Log::warning('EPS verifyPayment did not validate', [
                'tran_id' => $merchantTranId, 'response' => $data,
            ]);
        }

        return [
            'success' => $valid,
            'trx_id' => $data['EPSTransactionId'] ?? $nested['EPSTransactionId']
                ?? $data['transactionId'] ?? $nested['transactionId'] ?? $providerPaymentId,
            // TotalAmount is what the customer paid (order total); StoreAmount
            // is the seller's net after EPS's fee — not what we track.
            'amount' => isset($data['TotalAmount']) ? (float) $data['TotalAmount']
                : (isset($nested['TotalAmount']) ? (float) $nested['TotalAmount']
                : (isset($nested['amount']) ? (float) $nested['amount']
                : (isset($data['amount']) ? (float) $data['amount'] : null))),
            'raw' => $data,
        ];
    }
}
