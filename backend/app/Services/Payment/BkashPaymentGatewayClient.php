<?php

namespace App\Services\Payment;

use App\Models\PlatformBillingSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * bKash Payment Gateway — Tokenized Checkout (v1.2.0-beta). Used only for
 * the platform's own subscription billing (§16.4 in SAAS_MODULE_CONTEXT.md)
 * — a single shared merchant account, not per-seller, so there's no
 * per-user credential resolution here (unlike FacebookGraphClient, which
 * always takes a page_access_token argument).
 *
 * Flow: grantToken() → createPayment() returns a bkashURL to redirect the
 * browser to → customer completes payment on bKash's hosted page → bKash
 * redirects back to our callback with paymentID+status → executePayment()
 * finalizes and returns the real transaction id.
 */
class BkashPaymentGatewayClient
{
    private const SANDBOX_BASE = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
    private const LIVE_BASE = 'https://tokenized.pay.bka.sh/v1.2.0-beta';
    private const TOKEN_CACHE_KEY = 'bkash_pgw_id_token';

    private function baseUrl(): string
    {
        return PlatformBillingSetting::resolvedBkashSandbox() ? self::SANDBOX_BASE : self::LIVE_BASE;
    }

    public function isConfigured(): bool
    {
        return filled(PlatformBillingSetting::resolvedBkashAppKey())
            && filled(PlatformBillingSetting::resolvedBkashAppSecret())
            && filled(PlatformBillingSetting::resolvedBkashUsername())
            && filled(PlatformBillingSetting::resolvedBkashPassword());
    }

    /**
     * Grants (or returns a cached) id_token. Cached platform-wide since
     * there's only one merchant account — id_token is short-lived
     * (~1 hour per bKash docs), cached for slightly less to be safe.
     */
    private function idToken(bool $forceFresh = false): ?string
    {
        if (! $forceFresh) {
            $cached = Cache::get(self::TOKEN_CACHE_KEY);
            if ($cached) {
                return $cached;
            }
        }

        $appKey = PlatformBillingSetting::resolvedBkashAppKey();
        $appSecret = PlatformBillingSetting::resolvedBkashAppSecret();
        $username = PlatformBillingSetting::resolvedBkashUsername();
        $password = PlatformBillingSetting::resolvedBkashPassword();

        if (! $appKey || ! $appSecret || ! $username || ! $password) {
            return null;
        }

        try {
            $response = Http::asJson()->timeout(15)
                ->withHeaders(['username' => $username, 'password' => $password])
                ->post($this->baseUrl() . '/tokenized/checkout/token/grant', [
                    'app_key' => $appKey,
                    'app_secret' => $appSecret,
                ]);
        } catch (\Throwable $e) {
            Log::warning('bKash token grant request failed', ['error' => $e->getMessage()]);

            return null;
        }

        if (! $response->successful() || ! $response->json('id_token')) {
            Log::warning('bKash token grant rejected', ['status' => $response->status(), 'body' => $response->json()]);

            return null;
        }

        $idToken = $response->json('id_token');
        $ttl = max(60, (int) ($response->json('expires_in') ?? 3300) - 120);
        Cache::put(self::TOKEN_CACHE_KEY, $idToken, $ttl);

        return $idToken;
    }

    private function authHeaders(string $idToken): array
    {
        return [
            'Authorization' => $idToken,
            'X-App-Key' => PlatformBillingSetting::resolvedBkashAppKey(),
        ];
    }

    /**
     * @return array{paymentID:string, bkashURL:string}|null
     */
    public function createPayment(string $amount, string $merchantInvoiceNumber, string $payerReference, string $callbackUrl): ?array
    {
        $result = $this->withAuthRetry(function (string $idToken) use ($amount, $merchantInvoiceNumber, $payerReference, $callbackUrl) {
            return Http::asJson()->timeout(15)
                ->withHeaders($this->authHeaders($idToken))
                ->post($this->baseUrl() . '/tokenized/checkout/create', [
                    'mode' => '0011',
                    'payerReference' => $payerReference,
                    'callbackURL' => $callbackUrl,
                    'amount' => $amount,
                    'currency' => 'BDT',
                    'intent' => 'sale',
                    'merchantInvoiceNumber' => $merchantInvoiceNumber,
                ]);
        });

        if (! $result || ! $result->json('paymentID') || ! $result->json('bkashURL')) {
            Log::warning('bKash create payment failed', ['body' => $result?->json()]);

            return null;
        }

        return ['paymentID' => $result->json('paymentID'), 'bkashURL' => $result->json('bkashURL')];
    }

    /**
     * @return array{trxID:?string, transactionStatus:?string, amount:?string}|null
     */
    public function executePayment(string $paymentId): ?array
    {
        $result = $this->withAuthRetry(function (string $idToken) use ($paymentId) {
            return Http::asJson()->timeout(15)
                ->withHeaders($this->authHeaders($idToken))
                ->post($this->baseUrl() . '/tokenized/checkout/execute', ['paymentID' => $paymentId]);
        });

        if (! $result) {
            return null;
        }

        return [
            'trxID' => $result->json('trxID'),
            'transactionStatus' => $result->json('transactionStatus'),
            'amount' => $result->json('amount'),
        ];
    }

    /**
     * Reconciliation safety net — bKash recommends querying status if the
     * customer's browser never made it back to our callback (network drop,
     * closed tab, etc.) rather than assuming failure.
     *
     * @return array{trxID:?string, transactionStatus:?string}|null
     */
    public function queryPayment(string $paymentId): ?array
    {
        $result = $this->withAuthRetry(function (string $idToken) use ($paymentId) {
            return Http::asJson()->timeout(15)
                ->withHeaders($this->authHeaders($idToken))
                ->post($this->baseUrl() . '/tokenized/checkout/payment/status', ['paymentID' => $paymentId]);
        });

        if (! $result) {
            return null;
        }

        return ['trxID' => $result->json('trxID'), 'transactionStatus' => $result->json('transactionStatus')];
    }

    /**
     * Runs an authenticated call; on a 401 (expired/invalid cached token)
     * forces one fresh grant + retry before giving up.
     */
    private function withAuthRetry(callable $call): ?\Illuminate\Http\Client\Response
    {
        $idToken = $this->idToken();
        if (! $idToken) {
            return null;
        }

        try {
            $response = $call($idToken);
        } catch (\Throwable $e) {
            Log::warning('bKash API request failed', ['error' => $e->getMessage()]);

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
                Log::warning('bKash API retry failed', ['error' => $e->getMessage()]);

                return null;
            }
        }

        return $response;
    }
}
