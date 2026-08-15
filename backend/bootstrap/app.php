<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Http\Middleware\AuthenticatePlatformApiKey;
use App\Http\Middleware\EnsureActiveSubscription;
use App\Http\Middleware\EnsureShopOwner;
use App\Http\Middleware\EnsureStaffPermission;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\ForcePasswordChange;
use App\Http\Middleware\TrackLandingPageVisit;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Trust only private/loopback ranges as forwarding proxies — NOT '*'.
        // nginx (this host's origin, connected via Unix socket to php-fpm)
        // already sets REMOTE_ADDR to the real client IP itself, so it never
        // matches these ranges and the raw client-supplied X-Forwarded-For
        // header is correctly ignored here. This range only takes effect for
        // deployments that sit behind a private-network hop (e.g. a
        // Docker/Traefik proxy on the Dokploy branch), where it's needed to
        // resolve the real client IP. Trusting '*' let any caller spoof
        // X-Forwarded-For directly and defeat every IP-keyed rate limit.
        // Reject requests carrying a Host we don't serve. Laravel builds
        // absolute URLs (e.g. WordpressApiKeyController's download_url) from
        // the Host header, so an unrecognised one would be reflected back
        // into a response. The wildcard covers every seller subdomain; the
        // platform apex and its subdomains cover the rest.
        $middleware->trustHosts(at: fn () => [
            config('app.subdomain_apex', 'zyrotechbd.com'),
            '^(.+\\.)?' . preg_quote(config('app.subdomain_apex', 'zyrotechbd.com'), '/') . '$',
            'localhost',
            '127.0.0.1',
        ]);

        $middleware->trustProxies(at: [
            '127.0.0.1',
            '10.0.0.0/8',
            '172.16.0.0/12',
            '192.168.0.0/16',
        ]);

        $middleware->alias([
            'is_admin' => EnsureUserIsAdmin::class,
            'track_landing_page_visit' => TrackLandingPageVisit::class,
            'active_subscription' => EnsureActiveSubscription::class,
            // Staff/Team sub-account role — see staff_team_role_context.md §3.4/§3.7
            'staff_permission' => EnsureStaffPermission::class,
            'owner_only' => EnsureShopOwner::class,
            'force_password_change' => ForcePasswordChange::class,
            // WordPress/WooCommerce connector — bsol_history_and_new_context.md §5
            'connect_api_key' => AuthenticatePlatformApiKey::class,
        ]);

        $middleware->redirectGuestsTo(function (Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return null;
            }

            return '/';
        });
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Always render JSON for API routes, even if the client omitted an
        // Accept header — otherwise validation/auth failures fall back to
        // Laravel's web-style redirect response, which silently breaks
        // fetch() callers expecting JSON (they get a redirect to follow,
        // not an error body).
        $exceptions->shouldRenderJsonWhen(function (Request $request, \Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $bearer = (string) $request->bearerToken();
            $tokenId = str_contains($bearer, '|') ? strstr($bearer, '|', true) : null;

            Log::warning('api.401_unauthenticated', [
                'path' => $request->path(),
                'method' => $request->method(),
                'ip' => $request->ip(),
                'has_bearer_token' => $bearer !== '',
                'bearer_token_id' => $tokenId,
                'bearer_token_length' => strlen($bearer),
                'user_agent' => $request->userAgent(),
                'referer' => $request->header('referer'),
            ]);

            return null;
        });
    })->create();
