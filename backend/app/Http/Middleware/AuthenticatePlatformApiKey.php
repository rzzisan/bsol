<?php

namespace App\Http\Middleware;

use App\Models\PlatformApiKey;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticates /api/connect/v1/* requests from external platform connectors
 * (the BSOL WordPress/WooCommerce plugin) via a domain-bound API key — a
 * different trust boundary from Sanctum browser sessions, so this sits
 * outside the auth:sanctum group entirely. See
 * bsol_history_and_new_context.md §5.
 *
 * Accepts the key via X-API-KEY header (fallback: api_key in the body) and
 * the calling domain via X-Client-Domain header (fallback: client_domain,
 * then domain, in the body) — the body fallbacks keep compatibility with
 * zayroo-connect's proven remote_post() convention, which only ever sent
 * these in the JSON body.
 *
 * On success, resolves the connected merchant as the request's Auth user (via
 * the sanctum guard, the same one auth:sanctum routes use) so that reused
 * controllers/services/middleware (EnsureActiveSubscription, OrderController,
 * FraudController, ...) work with zero further modification.
 */
class AuthenticatePlatformApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $rawKey = $request->header('X-API-KEY') ?: $request->input('api_key');

        if (! $rawKey) {
            return response()->json([
                'success' => false,
                'message' => 'Missing API key.',
                'error_code' => 'missing_api_key',
            ], 401);
        }

        $domain = $request->header('X-Client-Domain')
            ?: $request->input('client_domain')
            ?: $request->input('domain');

        if (! $domain) {
            return response()->json([
                'success' => false,
                'message' => 'Missing client domain.',
                'error_code' => 'missing_domain',
            ], 400);
        }

        $apiKey = PlatformApiKey::findByRawKey($rawKey);

        if (! $apiKey) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid API key.',
                'error_code' => 'invalid_api_key',
            ], 401);
        }

        if ($apiKey->status === 'revoked') {
            return response()->json([
                'success' => false,
                'message' => 'This API key has been revoked.',
                'error_code' => 'key_revoked',
            ], 401);
        }

        if (! $apiKey->matchesDomain($domain)) {
            return response()->json([
                'success' => false,
                'message' => 'This API key is not authorized for this domain.',
                'error_code' => 'domain_mismatch',
            ], 403);
        }

        $merchant = $apiKey->user;

        if (! $merchant) {
            return response()->json([
                'success' => false,
                'message' => 'Connected account not found.',
                'error_code' => 'account_not_found',
            ], 401);
        }

        $apiKey->markUsed($request->ip());

        Auth::guard('sanctum')->setUser($merchant);
        Auth::shouldUse('sanctum');

        $request->attributes->set('platform_api_key', $apiKey);

        return $next($request);
    }
}
