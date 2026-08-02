<?php

namespace App\Services\Facebook;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin wrapper around the Meta Graph API for the per-seller Page-connect
 * OAuth flow and webhook subscription. Credentials come from
 * config('services.facebook') (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET /
 * FACEBOOK_WEBHOOK_VERIFY_TOKEN in .env) — see SAAS_MODULE_CONTEXT.md §16.3
 * for the Meta for Developers setup steps required before this goes live.
 */
class FacebookGraphClient
{
    private function baseUrl(): string
    {
        $version = config('services.facebook.graph_version', 'v21.0');

        return "https://graph.facebook.com/{$version}";
    }

    public function loginDialogUrl(string $redirectUri, string $state): string
    {
        $version = config('services.facebook.graph_version', 'v21.0');
        $params = http_build_query([
            'client_id' => config('services.facebook.app_id'),
            'redirect_uri' => $redirectUri,
            'state' => $state,
            'response_type' => 'code',
            'scope' => implode(',', [
                'pages_show_list',
                'pages_manage_metadata',
                'pages_read_engagement',
                'pages_manage_engagement',
                'pages_messaging',
            ]),
        ]);

        return "https://www.facebook.com/{$version}/dialog/oauth?{$params}";
    }

    /**
     * @return array{access_token:string, expires_in?:int}|null
     */
    public function exchangeCodeForUserToken(string $code, string $redirectUri): ?array
    {
        $response = Http::get("{$this->baseUrl()}/oauth/access_token", [
            'client_id' => config('services.facebook.app_id'),
            'client_secret' => config('services.facebook.app_secret'),
            'redirect_uri' => $redirectUri,
            'code' => $code,
        ]);

        if (! $response->successful() || ! isset($response->json()['access_token'])) {
            Log::warning('facebook.oauth.code_exchange_failed', ['response' => $response->json()]);

            return null;
        }

        return $response->json();
    }

    /**
     * Short-lived user tokens (~2h) are exchanged for a long-lived one
     * (~60 days) so the seller doesn't have to reconnect constantly.
     *
     * @return array{access_token:string, expires_in?:int}|null
     */
    public function getLongLivedUserToken(string $shortLivedToken): ?array
    {
        $response = Http::get("{$this->baseUrl()}/oauth/access_token", [
            'grant_type' => 'fb_exchange_token',
            'client_id' => config('services.facebook.app_id'),
            'client_secret' => config('services.facebook.app_secret'),
            'fb_exchange_token' => $shortLivedToken,
        ]);

        if (! $response->successful() || ! isset($response->json()['access_token'])) {
            Log::warning('facebook.oauth.long_lived_exchange_failed', ['response' => $response->json()]);

            return null;
        }

        return $response->json();
    }

    /**
     * Pages the connecting FB user manages, each with its own (effectively
     * non-expiring, since it's derived from a long-lived user token) Page
     * access token.
     *
     * @return array<int, array{id:string, name:string, access_token:string}>
     */
    public function getUserPages(string $userAccessToken): array
    {
        $response = Http::withToken($userAccessToken)
            ->get("{$this->baseUrl()}/me/accounts", ['fields' => 'id,name,access_token']);

        if (! $response->successful()) {
            Log::warning('facebook.oauth.list_pages_failed', ['response' => $response->json()]);

            return [];
        }

        return $response->json('data', []);
    }

    public function subscribeAppToPage(string $pageId, string $pageAccessToken): bool
    {
        $response = Http::withToken($pageAccessToken)
            ->post("{$this->baseUrl()}/{$pageId}/subscribed_apps", [
                'subscribed_fields' => 'feed,messages',
            ]);

        if (! $response->successful()) {
            Log::warning('facebook.webhook.subscribe_failed', ['page_id' => $pageId, 'response' => $response->json()]);
        }

        return $response->successful() && (bool) ($response->json()['success'] ?? false);
    }

    public function unsubscribeAppFromPage(string $pageId, string $pageAccessToken): bool
    {
        $response = Http::withToken($pageAccessToken)->delete("{$this->baseUrl()}/{$pageId}/subscribed_apps");

        return $response->successful();
    }

    /**
     * Verifies the `X-Hub-Signature-256` header Meta signs every webhook
     * POST body with (HMAC-SHA256 over the raw body, keyed by the app
     * secret) — this is the sole authentication boundary on the public
     * webhook route, so a missing/invalid signature must always reject.
     */
    public function verifySignature(string $rawBody, ?string $signatureHeader): bool
    {
        if (! $signatureHeader || ! str_starts_with($signatureHeader, 'sha256=')) {
            return false;
        }

        $appSecret = (string) config('services.facebook.app_secret');
        if ($appSecret === '') {
            return false;
        }

        $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $appSecret);

        return hash_equals($expected, $signatureHeader);
    }
}
