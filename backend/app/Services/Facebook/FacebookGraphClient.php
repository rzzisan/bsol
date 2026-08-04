<?php

namespace App\Services\Facebook;

use App\Models\PlatformFacebookSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin wrapper around the Meta Graph API for the per-seller Page-connect
 * OAuth flow and webhook subscription. Credentials come from
 * PlatformFacebookSetting (super-admin UI: Admin → Settings → Facebook),
 * falling back to FACEBOOK_APP_ID/APP_SECRET/WEBHOOK_VERIFY_TOKEN in .env
 * when unset — see SAAS_MODULE_CONTEXT.md §15.11 for the Meta for
 * Developers setup steps required before this goes live.
 */
class FacebookGraphClient
{
    private function baseUrl(): string
    {
        return 'https://graph.facebook.com/' . PlatformFacebookSetting::resolvedGraphVersion();
    }

    /**
     * Facebook Login for Business apps (this one is, since the Messenger
     * use case pulled it in as a dependency) don't accept the classic
     * `scope`-based OAuth dialog — Meta responds with a "Feature
     * Unavailable" page instead. The permissions are bundled into a Login
     * Configuration created in the App Dashboard instead, referenced here
     * by `config_id`.
     */
    public function loginDialogUrl(string $redirectUri, string $state): string
    {
        $version = PlatformFacebookSetting::resolvedGraphVersion();
        $params = http_build_query([
            'client_id' => PlatformFacebookSetting::resolvedAppId(),
            'redirect_uri' => $redirectUri,
            'state' => $state,
            'response_type' => 'code',
            'config_id' => PlatformFacebookSetting::resolvedLoginConfigId(),
        ]);

        return "https://www.facebook.com/{$version}/dialog/oauth?{$params}";
    }

    /**
     * @return array{access_token:string, expires_in?:int}|null
     */
    public function exchangeCodeForUserToken(string $code, string $redirectUri): ?array
    {
        $response = Http::get("{$this->baseUrl()}/oauth/access_token", [
            'client_id' => PlatformFacebookSetting::resolvedAppId(),
            'client_secret' => PlatformFacebookSetting::resolvedAppSecret(),
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
            'client_id' => PlatformFacebookSetting::resolvedAppId(),
            'client_secret' => PlatformFacebookSetting::resolvedAppSecret(),
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
     * Messenger webhook events only ever include the sender's PSID, never a
     * name — unlike comment events, which carry `from.name` directly in the
     * payload. This is a best-effort lookup for the lead inbox display; Meta
     * can restrict or empty this depending on the messaging-window/tag
     * rules in effect, so a null/failed response is expected and not logged
     * as a warning.
     */
    public function getUserProfileName(string $psid, string $pageAccessToken): ?string
    {
        $response = Http::withToken($pageAccessToken)->get("{$this->baseUrl()}/{$psid}", ['fields' => 'name']);

        return $response->successful() ? $response->json('name') : null;
    }

    /**
     * Sends a Page reply into an existing Messenger thread. Meta only
     * allows this within the standard 24-hour messaging window since the
     * lead's last message (messaging_type RESPONSE) — outside that window
     * Graph API rejects the call, which the caller surfaces as a failure
     * rather than something we can route around.
     */
    public function sendMessage(string $psid, string $pageAccessToken, string $text): bool
    {
        $response = Http::withToken($pageAccessToken)->post("{$this->baseUrl()}/me/messages", [
            'messaging_type' => 'RESPONSE',
            'recipient' => ['id' => $psid],
            'message' => ['text' => $text],
        ]);

        if (! $response->successful()) {
            Log::warning('facebook.messages.send_failed', ['psid' => $psid, 'response' => $response->json()]);
        }

        return $response->successful();
    }

    /**
     * Replies to a Page-post comment as the Page. Requires the
     * pages_manage_engagement permission on the page access token — not
     * yet in Advanced Access for this app (see facebook_integration_context.md),
     * so this will 403 until that permission is granted on reconnect.
     */
    public function replyToComment(string $commentId, string $pageAccessToken, string $text): bool
    {
        $response = Http::withToken($pageAccessToken)->post("{$this->baseUrl()}/{$commentId}/comments", [
            'message' => $text,
        ]);

        if (! $response->successful()) {
            Log::warning('facebook.comments.reply_failed', ['comment_id' => $commentId, 'response' => $response->json()]);
        }

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

        $appSecret = (string) PlatformFacebookSetting::resolvedAppSecret();
        if ($appSecret === '') {
            return false;
        }

        $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $appSecret);

        return hash_equals($expected, $signatureHeader);
    }
}
