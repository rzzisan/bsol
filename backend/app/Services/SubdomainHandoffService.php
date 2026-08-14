<?php

namespace App\Services;

use App\Models\ShopProfile;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Moves an authenticated session from one origin to another when a seller
 * logs in at bsol.zyrotechbd.com but owns a branded subdomain
 * (custom_domain_context.md §6).
 *
 * Why this exists at all: the auth token lives in localStorage, which is
 * scoped per origin, so a token minted on bsol. is unreachable from
 * seller1. Putting the token itself in the redirect URL is not an option —
 * URLs end up in browser history, Referer headers and proxy logs. Instead a
 * short-lived, single-use code travels in the URL and is exchanged for a
 * real token by the destination origin.
 */
class SubdomainHandoffService
{
    private const TTL_SECONDS = 60;

    private const PREFIX = 'subdomain_handoff:';

    /**
     * The host this user should be sent to, or null to stay where they are.
     *
     * Admins are deliberately never redirected: seller subdomains also serve
     * seller-authored landing-page HTML, so an admin session on that origin
     * is the one remaining way a token could be stolen
     * (custom_domain_context.md §9 rule 3).
     */
    public function redirectHostFor(User $user, string $currentHost): ?string
    {
        if ($user->isAdmin()) {
            return null;
        }

        $profile = ShopProfile::where('user_id', $user->shopOwnerId())->first();
        $host = $profile?->subdomainHost();

        if (! $host || strcasecmp($host, $currentHost) === 0) {
            return null;
        }

        return $host;
    }

    /**
     * Mint a code bound to one user and one destination host.
     */
    public function issue(User $user, string $targetHost, ?string $ip): string
    {
        $code = Str::random(64);

        Cache::put(self::PREFIX . $code, [
            'user_id' => $user->id,
            'target_host' => $targetHost,
            'issued_ip' => $ip,
        ], self::TTL_SECONDS);

        return $code;
    }

    public function redirectUrl(string $targetHost, string $code): string
    {
        return 'https://' . $targetHost . '/auth/handoff?code=' . $code;
    }

    /**
     * Consume a code. Returns the user, or null when the code is unknown,
     * expired, already used, or presented on the wrong host.
     *
     * Cache::pull is get-and-delete in one step, which is what makes this
     * genuinely single-use: two tabs racing on the same code cannot both
     * come away with a token.
     */
    public function redeem(string $code, string $requestHost, ?string $ip = null): ?User
    {
        $payload = Cache::pull(self::PREFIX . $code);

        if (! is_array($payload)) {
            return null;
        }

        // The host binding is the important check: without it a leaked code
        // could be replayed against a different seller's origin.
        if (strcasecmp($payload['target_host'] ?? '', $requestHost) !== 0) {
            Log::warning('Subdomain handoff rejected: host mismatch', [
                'expected' => $payload['target_host'] ?? null,
                'actual' => $requestHost,
            ]);

            return null;
        }

        // IP is recorded for audit but deliberately not enforced — a phone
        // switching between mobile data and wifi mid-redirect would fail an
        // IP check, and locking a legitimate seller out of their dashboard
        // is worse than the marginal gain over an already single-use,
        // host-bound, 60-second code.
        if ($ip && ($payload['issued_ip'] ?? null) && $payload['issued_ip'] !== $ip) {
            Log::info('Subdomain handoff redeemed from a different IP', [
                'issued_ip' => $payload['issued_ip'],
                'redeemed_ip' => $ip,
                'user_id' => $payload['user_id'] ?? null,
            ]);
        }

        return User::find($payload['user_id'] ?? null);
    }
}
