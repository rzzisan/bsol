<?php

namespace App\Support;

use App\Models\ShopProfile;
use App\Models\User;

/**
 * Where to send a seller in the browser — their own branded address when
 * they have one, the platform domain otherwise (custom_domain_context.md §15).
 *
 * Deliberately resolved from the *user*, never from the request's Host
 * header. A Host header is attacker-controlled, and these values end up in
 * password-reset emails and payment-gateway callback URLs, so trusting it
 * would turn every one of those into an open redirect. Looking the shop up
 * instead means the answer is always a host we ourselves issued.
 */
class FrontendUrl
{
    /** The platform's own frontend, with no trailing slash. */
    public static function platform(): string
    {
        return rtrim((string) config('app.frontend_url', config('app.url')), '/');
    }

    /**
     * Base URL for this user: their shop's subdomain if it's active, else
     * the platform. Safe to call with null (unauthenticated flows such as
     * registration, where no shop exists yet).
     */
    public static function forUser(?User $user): string
    {
        if (! $user) {
            return self::platform();
        }

        $host = ShopProfile::where('user_id', $user->shopOwnerId())
            ->first()?->subdomainHost();

        return $host ? 'https://' . $host : self::platform();
    }

    /** Convenience for building a full path on the user's own address. */
    public static function forUserPath(?User $user, string $path): string
    {
        return self::forUser($user) . '/' . ltrim($path, '/');
    }
}
