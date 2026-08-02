<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FacebookPageConnection;
use App\Models\PlatformFacebookSetting;
use App\Services\Facebook\FacebookGraphClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

/**
 * Per-seller "connect your Facebook Page" flow (Facebook Login for
 * Business). The OAuth callback is a full-page browser redirect from Meta,
 * so it can't carry a Sanctum bearer token — identity across that hop is
 * proven by the signed `state` param instead (see redirect()/callback()).
 */
class FacebookConnectController extends Controller
{
    public function __construct(private readonly FacebookGraphClient $graphClient) {}

    public function status(): JsonResponse
    {
        $connection = FacebookPageConnection::where('user_id', auth()->id())->first();

        if (! $connection || $connection->status !== 'connected') {
            return response()->json(['success' => true, 'connected' => false]);
        }

        return response()->json([
            'success' => true,
            'connected' => true,
            'data' => [
                'page_name' => $connection->page_name,
                'fb_page_id' => $connection->fb_page_id,
                'connected_at' => $connection->created_at,
                'webhook_subscribed' => $connection->webhook_subscribed_at !== null,
            ],
        ]);
    }

    public function redirect(): JsonResponse
    {
        if (! PlatformFacebookSetting::resolvedAppId()) {
            return response()->json(['success' => false, 'message' => 'Facebook App is not configured on the server yet.'], 422);
        }

        $state = Crypt::encryptString(json_encode([
            'user_id' => auth()->id(),
            'nonce' => Str::random(24),
            'expires' => now()->addMinutes(10)->timestamp,
        ]));

        return response()->json([
            'success' => true,
            'url' => $this->graphClient->loginDialogUrl($this->callbackUrl(), $state),
        ]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/') . '/dashboard/settings/facebook';

        if ($request->filled('error')) {
            return redirect("{$frontendUrl}?fb_error=" . urlencode((string) $request->query('error_description', 'denied')));
        }

        $state = $this->decodeState((string) $request->query('state', ''));
        if (! $state) {
            return redirect("{$frontendUrl}?fb_error=" . urlencode('Session expired, please try connecting again.'));
        }

        $code = (string) $request->query('code', '');
        $userToken = $this->graphClient->exchangeCodeForUserToken($code, $this->callbackUrl());
        $longLived = $userToken ? $this->graphClient->getLongLivedUserToken($userToken['access_token']) : null;

        if (! $longLived) {
            return redirect("{$frontendUrl}?fb_error=" . urlencode('Could not authenticate with Facebook. Please try again.'));
        }

        $pages = $this->graphClient->getUserPages($longLived['access_token']);

        if (empty($pages)) {
            return redirect("{$frontendUrl}?fb_error=" . urlencode('No Facebook Pages found for this account. You must be an admin of a Page to connect it.'));
        }

        if (count($pages) === 1) {
            $result = $this->persistConnection($state['user_id'], $pages[0], $longLived);

            return $result
                ? redirect("{$frontendUrl}?connected=1")
                : redirect("{$frontendUrl}?fb_error=" . urlencode('That Page is already connected to another BSOL account.'));
        }

        // Multiple pages — let the seller pick one in the dashboard.
        $sessionKey = Str::random(32);
        Cache::put("facebook_connect_pending:{$sessionKey}", [
            'user_id' => $state['user_id'],
            'pages' => $pages,
            'user_access_token' => $longLived['access_token'],
        ], now()->addMinutes(10));

        return redirect("{$frontendUrl}?select_session=" . urlencode($sessionKey));
    }

    public function pendingPages(Request $request): JsonResponse
    {
        $pending = $this->pendingSessionFor($request->query('session', ''));
        if (! $pending) {
            return response()->json(['success' => false, 'message' => 'Selection session expired. Please reconnect.'], 422);
        }

        return response()->json([
            'success' => true,
            'data' => array_map(fn ($p) => ['id' => $p['id'], 'name' => $p['name']], $pending['pages']),
        ]);
    }

    public function select(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session' => 'required|string',
            'page_id' => 'required|string',
        ]);

        $pending = $this->pendingSessionFor($data['session']);
        if (! $pending) {
            return response()->json(['success' => false, 'message' => 'Selection session expired. Please reconnect.'], 422);
        }

        $page = collect($pending['pages'])->firstWhere('id', $data['page_id']);
        if (! $page) {
            return response()->json(['success' => false, 'message' => 'Page not found in this session.'], 422);
        }

        $ok = $this->persistConnection($pending['user_id'], $page, ['access_token' => $pending['user_access_token']]);
        Cache::forget("facebook_connect_pending:{$data['session']}");

        return $ok
            ? response()->json(['success' => true, 'message' => 'Page connected.'])
            : response()->json(['success' => false, 'message' => 'That Page is already connected to another BSOL account.'], 422);
    }

    public function disconnect(): JsonResponse
    {
        $connection = FacebookPageConnection::where('user_id', auth()->id())->first();
        if (! $connection) {
            return response()->json(['success' => true, 'message' => 'Nothing to disconnect.']);
        }

        if ($connection->page_access_token) {
            $this->graphClient->unsubscribeAppFromPage($connection->fb_page_id, $connection->page_access_token);
        }

        $connection->update([
            'status' => 'disconnected',
            'page_access_token' => null,
            'fb_user_access_token' => null,
            'webhook_subscribed_at' => null,
        ]);

        return response()->json(['success' => true, 'message' => 'Facebook Page disconnected.']);
    }

    private function callbackUrl(): string
    {
        return rtrim((string) config('app.url'), '/') . '/api/facebook/connect/callback';
    }

    /**
     * @return array{user_id:int, nonce:string, expires:int}|null
     */
    private function decodeState(string $state): ?array
    {
        try {
            $data = json_decode(Crypt::decryptString($state), true);
        } catch (\Throwable) {
            return null;
        }

        if (! is_array($data) || ($data['expires'] ?? 0) < now()->timestamp) {
            return null;
        }

        return $data;
    }

    /**
     * @return array{user_id:int, pages:array, user_access_token:string}|null
     */
    private function pendingSessionFor(string $sessionKey): ?array
    {
        if ($sessionKey === '') {
            return null;
        }

        $pending = Cache::get("facebook_connect_pending:{$sessionKey}");
        if (! $pending || $pending['user_id'] !== auth()->id()) {
            return null;
        }

        return $pending;
    }

    /**
     * @param  array{id:string, name:string, access_token?:string}  $page
     * @param  array{access_token:string}  $userToken
     */
    private function persistConnection(int $userId, array $page, array $userToken): bool
    {
        $existingOtherUser = FacebookPageConnection::where('fb_page_id', $page['id'])
            ->where('user_id', '!=', $userId)
            ->where('status', 'connected')
            ->exists();

        if ($existingOtherUser) {
            return false;
        }

        $pageAccessToken = $page['access_token'] ?? null;
        if (! $pageAccessToken) {
            return false;
        }

        // The DB-level unique(fb_page_id) index isn't conditioned on status
        // (unlike the sms_automation_logs partial-index pattern) — a page
        // left behind by a previous seller's disconnected connection can
        // still collide here, so the constraint violation is the real
        // final guard beyond the connected-only check above.
        try {
            $connection = FacebookPageConnection::updateOrCreate(
                ['user_id' => $userId],
                [
                    'fb_page_id' => $page['id'],
                    'page_name' => $page['name'] ?? null,
                    'page_access_token' => $pageAccessToken,
                    'fb_user_access_token' => $userToken['access_token'],
                    'status' => 'connected',
                    'last_error' => null,
                ]
            );
        } catch (UniqueConstraintViolationException) {
            return false;
        }

        $subscribed = $this->graphClient->subscribeAppToPage($page['id'], $pageAccessToken);
        $connection->update([
            'webhook_subscribed_at' => $subscribed ? now() : null,
            'last_error' => $subscribed ? null : 'Page connected but webhook subscription failed — comments/messages will not be captured until this is retried.',
        ]);

        return true;
    }
}
