<?php

namespace App\Services\Security;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Bridges the gap between "password checked out" and "token minted" for an
 * admin with two-factor enabled — mirrors SubdomainHandoffService's
 * short-lived, single-use, Cache-backed code pattern (same reasoning: a
 * Sanctum token cannot be minted yet, so a bearer-less client needs
 * something else to carry across the second request).
 *
 * security_hardening_context.md.
 */
class TwoFactorChallengeService
{
    private const TTL_SECONDS = 300; // 5 minutes to open an authenticator app and type a code

    private const MAX_ATTEMPTS = 5;

    private const PREFIX = 'two_factor_challenge:';

    public function issue(User $user, ?string $ip): string
    {
        $token = Str::random(64);

        Cache::put(self::PREFIX . $token, [
            'user_id' => $user->id,
            'attempts' => 0,
            'issued_ip' => $ip,
        ], self::TTL_SECONDS);

        return $token;
    }

    /**
     * Look up the pending challenge without consuming it (attempts are
     * tracked across multiple wrong guesses, so this can't be a
     * get-and-delete like the handoff code's redeem()).
     *
     * @return array{user_id: int, attempts: int, issued_ip: ?string}|null
     */
    public function peek(string $token): ?array
    {
        $payload = Cache::get(self::PREFIX . $token);

        return is_array($payload) ? $payload : null;
    }

    /**
     * Record a failed attempt. Once MAX_ATTEMPTS is reached the challenge
     * is invalidated outright — same 5-attempt ceiling as CheckoutOtpService
     * uses for public OTP verification, applied here for the same reason
     * (a 6-digit code is only ~1M possibilities; a challenge token alone
     * must not be enough to brute-force it).
     *
     * @return int remaining attempts (0 means the challenge is now dead)
     */
    public function recordFailedAttempt(string $token): int
    {
        $payload = $this->peek($token);

        if ($payload === null) {
            return 0;
        }

        $payload['attempts']++;

        if ($payload['attempts'] >= self::MAX_ATTEMPTS) {
            Cache::forget(self::PREFIX . $token);

            return 0;
        }

        Cache::put(self::PREFIX . $token, $payload, self::TTL_SECONDS);

        return self::MAX_ATTEMPTS - $payload['attempts'];
    }

    /**
     * Consume the challenge on success. Cache::pull is get-and-delete in
     * one step — single-use, same as the handoff code's redeem().
     */
    public function redeem(string $token): ?int
    {
        $payload = Cache::pull(self::PREFIX . $token);

        return is_array($payload) ? ($payload['user_id'] ?? null) : null;
    }

    public function invalidate(string $token): void
    {
        Cache::forget(self::PREFIX . $token);
    }
}
