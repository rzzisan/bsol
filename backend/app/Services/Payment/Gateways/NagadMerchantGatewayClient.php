<?php

namespace App\Services\Payment\Gateways;

use App\Contracts\PaymentGatewayClient;
use App\Models\PaymentGatewayCredential;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Nagad Merchant — RSA-signed "Remote Payment Gateway" checkout, per-seller
 * merchant credentials. Phase C2 (final) of customer-facing online
 * payment — see online_payment_context.md.
 *
 * Structurally different from every other gateway in this batch: no plain
 * form POST. Every outgoing request body is itself RSA-encrypted (with
 * Nagad's own PG public key, so only Nagad can read it) AND RSA-signed
 * (with the merchant's own private key, SHA-256, so Nagad can verify it
 * came from us); Nagad's own responses are RSA-encrypted back to us
 * (decrypted with the merchant private key).
 *
 * ⚠️ CONFIDENCE NOTE — read before relying on this in production (see
 * online_payment_context.md §C2, and the EPS integration's own live bug as
 * the cautionary precedent): nagad.com.bd has no public REST reference
 * docs either. The initialize/complete request-and-response shapes below
 * ARE grounded in a real, complete, actively-referenced community PHP SDK
 * (github.com/arif98741/nagadApi) — not guesswork; every field name and
 * the full crypto sequence (openssl_sign/openssl_public_encrypt/
 * openssl_private_decrypt calls) were read directly out of that SDK's
 * source. What could NOT be confirmed: the exact response field names of
 * GET verify/payment/{id} — that SDK forwards the raw response without
 * parsing it, so this client's status-field parsing below is a best-effort
 * defensive guess (several plausible key names checked), not a confirmed
 * shape. Treat this exactly like EPS before its live-test fix: expect one
 * round of real sandbox testing to be needed to nail down verify()'s exact
 * fields, and check production logs the same way if a sandbox test doesn't
 * confirm as paid.
 *
 * Flow:
 * 1. createPayment() step 1 — POST check-out/initialize/{merchantId}/{orderId},
 *    body {accountNumber, dateTime, sensitiveData, signature} where
 *    sensitiveData = RSA-encrypt(json{merchantId, datetime, orderId,
 *    challenge}) and signature = RSA-sign(that same plaintext json, our
 *    private key). Response's own sensitiveData (RSA-decrypted with our
 *    private key) yields {paymentReferenceId, challenge}.
 * 2. createPayment() step 2 — POST check-out/complete/{paymentReferenceId},
 *    body {sensitiveData: RSA-encrypt(json{merchantId, orderId,
 *    currencyCode, amount, challenge}), signature, merchantCallbackURL} →
 *    {callBackUrl} is the hosted checkout page to redirect the browser to.
 * 3. Customer pays on Nagad's hosted page, redirected back to
 *    merchantCallbackURL with query params (merchant, order_id,
 *    payment_ref_id, status, status_code, ...) — never trusted directly.
 * 4. verifyPayment() — GET verify/payment/{paymentReferenceId}, always
 *    using OUR OWN stored provider_payment_id (never a callback param —
 *    same discipline as every other client fixed/built this way in this
 *    batch).
 */
class NagadMerchantGatewayClient implements PaymentGatewayClient
{
    private const SANDBOX_BASE = 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs/';
    private const LIVE_BASE = 'https://api.mynagad.com/api/dfs/';

    public function __construct(private readonly PaymentGatewayCredential $credential) {}

    private function baseUrl(): string
    {
        return $this->credential->is_live ? self::LIVE_BASE : self::SANDBOX_BASE;
    }

    private function merchantId(): ?string
    {
        return $this->credential->credentials['merchant_id'] ?? null;
    }

    private function accountNumber(): ?string
    {
        return $this->credential->credentials['account_number'] ?? null;
    }

    /** Raw base64 body only (no -----BEGIN/END----- markers, no internal
     *  line breaks) — the same convention the reference SDK's own env-var
     *  based config uses. Headers are wrapped on here in code. */
    private function privateKeyBody(): ?string
    {
        return $this->credential->credentials['merchant_private_key'] ?? null;
    }

    private function pgPublicKeyBody(): ?string
    {
        return $this->credential->credentials['pg_public_key'] ?? null;
    }

    public function isConfigured(): bool
    {
        return filled($this->merchantId()) && filled($this->accountNumber())
            && filled($this->privateKeyBody()) && filled($this->pgPublicKeyBody());
    }

    /** Real-world merchant private keys may come out as traditional PKCS#1
     *  ("RSA PRIVATE KEY" — what the reference SDK assumes) or PKCS#8
     *  ("PRIVATE KEY" — what this server's own OpenSSL produces by
     *  default; confirmed empirically, not assumed) depending on how/where
     *  the pair was generated. Tries both header wraps rather than betting
     *  on one — the same "don't assume, confirm" lesson EPS's live bug
     *  taught, applied here proactively instead of after a failure. */
    private function privateKeyResource(): \OpenSSLAsymmetricKey|false
    {
        $body = trim((string) $this->privateKeyBody());
        if ($body === '') {
            return false;
        }

        foreach (['RSA PRIVATE KEY', 'PRIVATE KEY'] as $label) {
            $key = openssl_pkey_get_private("-----BEGIN {$label}-----\n{$body}\n-----END {$label}-----");
            if ($key !== false) {
                return $key;
            }
        }

        return false;
    }

    private function pgPublicKeyPem(): string
    {
        return "-----BEGIN PUBLIC KEY-----\n" . trim((string) $this->pgPublicKeyBody()) . "\n-----END PUBLIC KEY-----";
    }

    /** RSA-SHA256 signature over the plaintext JSON, base64-encoded —
     *  Nagad's own scheme, matches the reference SDK exactly. */
    private function sign(string $data): string
    {
        $key = $this->privateKeyResource();
        if ($key === false) {
            throw new \RuntimeException('Nagad: invalid or unrecognized merchant private key format.');
        }

        $ok = openssl_sign($data, $signature, $key, OPENSSL_ALGO_SHA256);
        if (! $ok) {
            throw new \RuntimeException('Nagad: could not sign request — check the merchant private key.');
        }

        return base64_encode($signature);
    }

    /** RSA-encrypts with Nagad's PG public key so only Nagad can read it,
     *  base64-encoded. Message must stay under the RSA modulus's PKCS1
     *  limit (~245 bytes for a 2048-bit key) — the sensitiveData JSON
     *  payloads here are a handful of short fields, comfortably under that,
     *  matching the reference SDK's own no-chunking design. */
    private function encrypt(string $data): string
    {
        $key = openssl_pkey_get_public($this->pgPublicKeyPem());
        if (! $key) {
            throw new \RuntimeException('Nagad: invalid PG public key.');
        }

        $ok = openssl_public_encrypt($data, $encrypted, $key);
        if (! $ok) {
            throw new \RuntimeException('Nagad: could not encrypt request payload.');
        }

        return base64_encode($encrypted);
    }

    /** Decrypts Nagad's own response payload with our private key. */
    private function decrypt(string $base64Data): ?string
    {
        $key = $this->privateKeyResource();
        if ($key === false) {
            return null;
        }

        $ok = openssl_private_decrypt(base64_decode($base64Data), $decrypted, $key);

        return $ok ? $decrypted : null;
    }

    public function createPayment(string $merchantTranId, float $amount, string $returnUrl, array $customer = []): array
    {
        $challenge = Str::random(40);
        $dateTime = now()->format('YmdHis');

        $initSensitive = json_encode([
            'merchantId' => $this->merchantId(),
            'datetime' => $dateTime,
            'orderId' => $merchantTranId,
            'challenge' => $challenge,
        ]);

        $initResponse = Http::asJson()->timeout(15)->post(
            $this->baseUrl() . 'check-out/initialize/' . $this->merchantId() . '/' . $merchantTranId,
            [
                'accountNumber' => $this->accountNumber(),
                'dateTime' => $dateTime,
                'sensitiveData' => $this->encrypt($initSensitive),
                'signature' => $this->sign($initSensitive),
            ]
        );

        $initData = $initResponse->json();
        $initPlainRaw = isset($initData['sensitiveData']) ? $this->decrypt((string) $initData['sensitiveData']) : null;
        $initPlain = $initPlainRaw ? json_decode($initPlainRaw, true) : null;

        if (! $initResponse->successful() || ! $initPlain || empty($initPlain['paymentReferenceId'])) {
            Log::warning('Nagad initialize failed', ['tran_id' => $merchantTranId, 'response' => $initData]);
            $errorMsg = is_array($initData) ? ($initData['message'] ?? 'Nagad session initiation failed.') : 'Nagad session initiation failed.';
            throw new \RuntimeException((string) $errorMsg);
        }

        $paymentReferenceId = (string) $initPlain['paymentReferenceId'];
        // Nagad rotates the challenge between initialize and complete —
        // the complete call must echo back what initialize returned, not
        // what we originally sent.
        $returnedChallenge = (string) ($initPlain['challenge'] ?? $challenge);

        $completeSensitive = json_encode([
            'merchantId' => $this->merchantId(),
            'orderId' => $merchantTranId,
            'currencyCode' => '050', // BDT — ISO 4217 numeric code
            'amount' => number_format($amount, 2, '.', ''),
            'challenge' => $returnedChallenge,
        ]);

        $completeResponse = Http::asJson()->timeout(15)->post(
            $this->baseUrl() . 'check-out/complete/' . $paymentReferenceId,
            [
                'sensitiveData' => $this->encrypt($completeSensitive),
                'signature' => $this->sign($completeSensitive),
                'merchantCallbackURL' => $returnUrl,
            ]
        );

        $completeData = $completeResponse->json();
        $checkoutUrl = $completeData['callBackUrl'] ?? null;

        if (! $completeResponse->successful() || ! $checkoutUrl) {
            Log::warning('Nagad complete/checkout failed', ['tran_id' => $merchantTranId, 'response' => $completeData]);
            $errorMsg = is_array($completeData) ? ($completeData['message'] ?? 'Nagad checkout page could not be created.') : 'Nagad checkout page could not be created.';
            throw new \RuntimeException((string) $errorMsg);
        }

        return [
            'redirect_url' => $checkoutUrl,
            // Nagad mints its own paymentReferenceId — that's what
            // verify() keys off, not our merchantTranId.
            'provider_payment_id' => $paymentReferenceId,
        ];
    }

    public function verifyPayment(string $merchantTranId, string $providerPaymentId, array $callbackData): array
    {
        // Always verifies OUR OWN stored paymentReferenceId — never a
        // customer-suppliable callback param (same discipline as every
        // other client fixed/built this way in this batch — see class
        // docblock for the wider "always our own stored id" pattern).
        $response = Http::timeout(15)->get($this->baseUrl() . 'verify/payment/' . $providerPaymentId);
        $data = $response->json() ?? [];

        // Field names below are a best-effort, defensively-broad set — NOT
        // confirmed against a real response (see class docblock).
        $status = strtoupper((string) (
            $data['status'] ?? $data['Status'] ?? $data['statusCode'] ?? $data['StatusCode'] ?? ''
        ));
        $valid = in_array($status, ['SUCCESS', 'COMPLETED', 'SUCCESSFUL', '000'], true);

        if (! $valid) {
            Log::warning('Nagad verifyPayment did not validate', [
                'tran_id' => $merchantTranId, 'response' => $data,
            ]);
        }

        return [
            'success' => $valid,
            'trx_id' => $data['issuerPaymentRefNo'] ?? $data['issuerPaymentRef'] ?? $data['paymentRefId'] ?? $providerPaymentId,
            'amount' => isset($data['amount']) ? (float) $data['amount']
                : (isset($data['Amount']) ? (float) $data['Amount'] : null),
            'raw' => $data,
        ];
    }
}
