<?php

namespace App\Services\Payment\Gateways;

use App\Contracts\PaymentGatewayClient;
use App\Models\PaymentGatewayCredential;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * bKash Merchant — Tokenized Checkout (v1.2.0-beta), per-seller merchant
 * credentials. Phase C1 of customer-facing online payment — see
 * online_payment_context.md.
 *
 * Deliberately mirrors App\Services\Payment\BkashPaymentGatewayClient
 * (subscription billing's platform-wide singleton client — proven against
 * the real, live bKash API) mechanics field-for-field: grant/execute/
 * token-cache/401-retry. The only differences are (1) credentials resolve
 * per-seller from PaymentGatewayCredential instead of PlatformBillingSetting,
 * and (2) the token cache key is scoped per credential row, not global —
 * this is the ONLY provider in this batch grounded in code already proven
 * against the real production API (not third-party docs/SDKs), so it
 * carries the least "will it actually match the real response" risk.
 *
 * Flow: grantToken() → createPayment() returns paymentID + bkashURL to
 * redirect the browser to → customer completes payment on bKash's hosted
 * page → bKash redirects back to our callback → verifyPayment() ALWAYS
 * calls bKash's own executePayment() using OUR OWN stored paymentID (never
 * a customer-suppliable callback param — same discipline as every other
 * client fixed/built this way in this batch). execute() both finalizes AND
 * authoritatively reports the real outcome in one call — unlike the other
 * gateway clients' read-only verify calls, this one is a one-shot mutating
 * action (bKash rejects a second execute() on the same paymentID); that's
 * safe here only because OnlinePaymentService::completeGatewayCallback()'s
 * lockForUpdate()+isTerminal() guard already ensures verifyPayment() runs
 * at most once per claim.
 */
class BkashMerchantGatewayClient implements PaymentGatewayClient
{
    private const SANDBOX_BASE = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
    private const LIVE_BASE = 'https://tokenized.pay.bka.sh/v1.2.0-beta';

    public function __construct(private readonly PaymentGatewayCredential $credential) {}

    private function baseUrl(): string
    {
        return $this->credential->is_live ? self::LIVE_BASE : self::SANDBOX_BASE;
    }

    private function appKey(): ?string
    {
        return $this->credential->credentials['app_key'] ?? null;
    }

    private function appSecret(): ?string
    {
        return $this->credential->credentials['app_secret'] ?? null;
    }

    private function username(): ?string
    {
        return $this->credential->credentials['username'] ?? null;
    }

    private function password(): ?string
    {
        return $this->credential->credentials['password'] ?? null;
    }

    public function isConfigured(): bool
    {
        return filled($this->appKey()) && filled($this->appSecret())
            && filled($this->username()) && filled($this->password());
    }

    private function tokenCacheKey(): string
    {
        return 'bkash_merchant_token_' . $this->credential->id;
    }

    /** Grants (or returns a cached) id_token — same TTL discipline as the
     *  subscription-billing client (~55 min, id_token is ~1h per bKash docs). */
    private function idToken(bool $forceFresh = false): ?string
    {
        if (! $forceFresh) {
            $cached = Cache::get($this->tokenCacheKey());
            if ($cached) {
                return $cached;
            }
        }

        try {
            $response = Http::asJson()->timeout(15)
                ->withHeaders(['username' => $this->username(), 'password' => $this->password()])
                ->post($this->baseUrl() . '/tokenized/checkout/token/grant', [
                    'app_key' => $this->appKey(),
                    'app_secret' => $this->appSecret(),
                ]);
        } catch (\Throwable $e) {
            Log::warning('bKash Merchant token grant request failed', ['error' => $e->getMessage()]);

            return null;
        }

        if (! $response->successful() || ! $response->json('id_token')) {
            Log::warning('bKash Merchant token grant rejected', ['status' => $response->status(), 'body' => $response->json()]);

            return null;
        }

        $idToken = $response->json('id_token');
        $ttl = max(60, (int) ($response->json('expires_in') ?? 3300) - 120);
        Cache::put($this->tokenCacheKey(), $idToken, $ttl);

        return $idToken;
    }

    private function authHeaders(string $idToken): array
    {
        return ['Authorization' => $idToken, 'X-App-Key' => $this->appKey()];
    }

    public function createPayment(string $merchantTranId, float $amount, string $returnUrl, array $customer = []): array
    {
        $result = $this->withAuthRetry(function (string $idToken) use ($merchantTranId, $amount, $returnUrl, $customer) {
            return Http::asJson()->timeout(15)
                ->withHeaders($this->authHeaders($idToken))
                ->post($this->baseUrl() . '/tokenized/checkout/create', [
                    'mode' => '0011',
                    'payerReference' => $customer['phone'] ?? $merchantTranId,
                    'callbackURL' => $returnUrl,
                    'amount' => number_format($amount, 2, '.', ''),
                    'currency' => 'BDT',
                    'intent' => 'sale',
                    'merchantInvoiceNumber' => $merchantTranId,
                ]);
        });

        $data = $result?->json();

        if (! $result || ! ($data['paymentID'] ?? null) || ! ($data['bkashURL'] ?? null)) {
            Log::warning('bKash Merchant createPayment failed', ['tran_id' => $merchantTranId, 'response' => $data]);
            throw new \RuntimeException($data['errorMessage'] ?? 'bKash session initiation failed.');
        }

        return [
            'redirect_url' => $data['bkashURL'],
            // bKash mints its own paymentID — that's what execute()/query()
            // key off, not our merchantInvoiceNumber.
            'provider_payment_id' => $data['paymentID'],
        ];
    }

    public function verifyPayment(string $merchantTranId, string $providerPaymentId, array $callbackData): array
    {
        $result = $this->withAuthRetry(function (string $idToken) use ($providerPaymentId) {
            return Http::asJson()->timeout(15)
                ->withHeaders($this->authHeaders($idToken))
                ->post($this->baseUrl() . '/tokenized/checkout/execute', ['paymentID' => $providerPaymentId]);
        });

        $data = $result?->json() ?? [];
        $valid = ($data['transactionStatus'] ?? null) === 'Completed';

        if (! $valid) {
            Log::warning('bKash Merchant verifyPayment did not validate', [
                'tran_id' => $merchantTranId, 'response' => $data,
            ]);
        }

        return [
            'success' => $valid,
            'trx_id' => $data['trxID'] ?? null,
            'amount' => isset($data['amount']) ? (float) $data['amount'] : null,
            'raw' => $data,
        ];
    }

    /** Runs an authenticated call; on a 401 (expired/invalid cached token)
     *  forces one fresh grant + retry before giving up. */
    private function withAuthRetry(callable $call): ?\Illuminate\Http\Client\Response
    {
        $idToken = $this->idToken();
        if (! $idToken) {
            return null;
        }

        try {
            $response = $call($idToken);
        } catch (\Throwable $e) {
            Log::warning('bKash Merchant API request failed', ['error' => $e->getMessage()]);

            return null;
        }

        if ($response->status() === 401) {
            $idToken = $this->idToken(forceFresh: true);
            if (! $idToken) {
                return null;
            }

            try {
                $response = $call($idToken);
            } catch (\Throwable $e) {
                Log::warning('bKash Merchant API retry failed', ['error' => $e->getMessage()]);

                return null;
            }
        }

        return $response;
    }
}
