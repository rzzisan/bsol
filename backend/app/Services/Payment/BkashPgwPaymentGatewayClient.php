<?php

namespace App\Services\Payment;

use App\Models\PlatformBillingSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * bKash classic Checkout API — internally called "PGW" by bKash's own
 * onboarding emails, NOT the same product as Tokenized Checkout
 * (BkashPaymentGatewayClient). See SAAS_MODULE_CONTEXT.md §18: the
 * business's real merchant credentials were issued for this product, and
 * they are not interchangeable with Tokenized Checkout — different base
 * domain, different endpoint paths, and (client-side) a JS-widget flow
 * instead of a full-page redirect.
 *
 * Flow: bKash's own `bKash-checkout.js` widget (loaded on the subscription
 * page) drives the UI. It calls back into two functions we register with
 * `bKash.init()` — createRequest and executeRequestOnAuthorization — which
 * in turn AJAX our own backend (BkashPgwPaymentController), which is what
 * actually calls grantToken()/createPayment()/executePayment() here. The
 * app_secret/password never reach the browser, only paymentID does.
 */
class BkashPgwPaymentGatewayClient
{
    private const SANDBOX_BASE = 'https://checkout.sandbox.bka.sh/v1.2.0-beta';
    private const LIVE_BASE = 'https://checkout.pay.bka.sh/v1.2.0-beta';
    private const SANDBOX_SCRIPT_URL = 'https://scripts.sandbox.bka.sh/versions/1.2.0-beta/checkout/bKash-checkout-sandbox.js';
    private const LIVE_SCRIPT_URL = 'https://scripts.pay.bka.sh/versions/1.2.0-beta/checkout/bKash-checkout.js';
    private const TOKEN_CACHE_KEY = 'bkash_pgw_classic_id_token';

    private function baseUrl(): string
    {
        return PlatformBillingSetting::resolvedBkashSandbox() ? self::SANDBOX_BASE : self::LIVE_BASE;
    }

    /** Frontend loads this bKash-hosted script to render the payment widget. */
    public function scriptUrl(): string
    {
        return PlatformBillingSetting::resolvedBkashSandbox() ? self::SANDBOX_SCRIPT_URL : self::LIVE_SCRIPT_URL;
    }

    public function isConfigured(): bool
    {
        return filled(PlatformBillingSetting::resolvedBkashAppKey())
            && filled(PlatformBillingSetting::resolvedBkashAppSecret())
            && filled(PlatformBillingSetting::resolvedBkashUsername())
            && filled(PlatformBillingSetting::resolvedBkashPassword());
    }

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
                ->post($this->baseUrl() . '/checkout/token/grant', [
                    'app_key' => $appKey,
                    'app_secret' => $appSecret,
                ]);
        } catch (\Throwable $e) {
            Log::warning('bKash PGW token grant request failed', ['error' => $e->getMessage()]);

            return null;
        }

        if (! $response->successful() || ! $response->json('id_token')) {
            Log::warning('bKash PGW token grant rejected', ['status' => $response->status(), 'body' => $response->json()]);

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
            'X-APP-Key' => PlatformBillingSetting::resolvedBkashAppKey(),
        ];
    }

    /**
     * @return array{paymentID:string}|null
     */
    public function createPayment(string $amount, string $merchantInvoiceNumber): ?array
    {
        $result = $this->withAuthRetry(function (string $idToken) use ($amount, $merchantInvoiceNumber) {
            return Http::asJson()->timeout(15)
                ->withHeaders($this->authHeaders($idToken))
                ->post($this->baseUrl() . '/checkout/payment/create', [
                    'amount' => $amount,
                    'currency' => 'BDT',
                    'intent' => 'sale',
                    'merchantInvoiceNumber' => $merchantInvoiceNumber,
                ]);
        });

        if (! $result || ! $result->json('paymentID')) {
            Log::warning('bKash PGW create payment failed', ['body' => $result?->json()]);

            return null;
        }

        return ['paymentID' => $result->json('paymentID')];
    }

    /**
     * @return array{trxID:?string, transactionStatus:?string, amount:?string}|null
     */
    public function executePayment(string $paymentId): ?array
    {
        $result = $this->withAuthRetry(function (string $idToken) use ($paymentId) {
            return Http::asJson()->timeout(15)
                ->withHeaders($this->authHeaders($idToken))
                ->post($this->baseUrl() . '/checkout/payment/execute/' . $paymentId);
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
     * Reconciliation safety net — same rationale as the Tokenized client's
     * queryPayment(): use if the browser never got back to us with a result.
     *
     * @return array{trxID:?string, transactionStatus:?string}|null
     */
    public function queryPayment(string $paymentId): ?array
    {
        $result = $this->withAuthRetry(function (string $idToken) use ($paymentId) {
            return Http::asJson()->timeout(15)
                ->withHeaders($this->authHeaders($idToken))
                ->post($this->baseUrl() . '/checkout/payment/query/' . $paymentId);
        });

        if (! $result) {
            return null;
        }

        return ['trxID' => $result->json('trxID'), 'transactionStatus' => $result->json('transactionStatus')];
    }

    private function withAuthRetry(callable $call): ?\Illuminate\Http\Client\Response
    {
        $idToken = $this->idToken();
        if (! $idToken) {
            return null;
        }

        try {
            $response = $call($idToken);
        } catch (\Throwable $e) {
            Log::warning('bKash PGW API request failed', ['error' => $e->getMessage()]);

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
                Log::warning('bKash PGW API retry failed', ['error' => $e->getMessage()]);

                return null;
            }
        }

        return $response;
    }
}
