<?php

namespace App\Support;

use App\Models\ReservedSubdomain;
use App\Models\ShopProfile;
use App\Models\SubdomainTombstone;

/**
 * Single source of truth for which subdomain labels a seller may claim
 * (custom_domain_context.md §5.3/§5.4).
 *
 * The reserved list lives in reserved_subdomains, managed from the admin
 * panel, so adding a DNS record to the zone no longer needs a deploy to stay
 * safe. Rows flagged is_system cannot be deleted through that UI — see the
 * model — which keeps the original guarantee that nobody can free up 'mail'
 * or 'cpanel' and hand a seller someone else's live service.
 */
class SubdomainPolicy
{
    public const MIN_LENGTH = 3;

    public const MAX_LENGTH = 63;

    /**
     * Lowercase and strip anything that is obviously not part of the label,
     * so 'Zareen.zyrotechbd.com ' and 'ZAREEN' both resolve to 'zareen'
     * before validation runs.
     */
    public static function normalize(?string $input): string
    {
        $label = strtolower(trim((string) $input));
        $label = preg_replace('/^https?:\/\//', '', $label) ?? $label;

        // Accept a pasted full host by taking its first label.
        if (str_contains($label, '.')) {
            $label = explode('.', $label)[0];
        }

        return preg_replace('/[^a-z0-9-]/', '', $label) ?? '';
    }

    /**
     * Reason the label cannot be used, or null when it is free.
     *
     * Ordered cheapest-first so an obviously malformed label never reaches
     * the database.
     *
     * @return null|'too_short'|'too_long'|'invalid_format'|'reserved'|'taken'
     */
    public static function rejectionReason(string $label, ?int $ignoreUserId = null): ?string
    {
        if (strlen($label) < self::MIN_LENGTH) {
            return 'too_short';
        }

        if (strlen($label) > self::MAX_LENGTH) {
            return 'too_long';
        }

        // A DNS label: alphanumeric ends, hyphens only in the middle.
        if (! preg_match('/^[a-z0-9][a-z0-9-]*[a-z0-9]$/', $label)) {
            return 'invalid_format';
        }

        if (str_contains($label, '--')) {
            // Rejected wholesale rather than only at positions 3-4 (the
            // 'xn--' punycode prefix): a double hyphen has no legitimate use
            // in a shop name and reads as a typo to customers.
            return 'invalid_format';
        }

        if (self::isReserved($label)) {
            return 'reserved';
        }

        $taken = ShopProfile::where('subdomain', $label)
            ->when($ignoreUserId, fn ($q) => $q->where('user_id', '!=', $ignoreUserId))
            ->exists();

        return $taken ? 'taken' : null;
    }

    public static function isAvailable(string $label, ?int $ignoreUserId = null): bool
    {
        return self::rejectionReason($label, $ignoreUserId) === null;
    }

    /**
     * Reserved covers two things a seller must never be able to claim: a
     * label an admin has set aside (reserved_subdomains), and one some other
     * seller used to own (SubdomainTombstone).
     */
    public static function isReserved(string $label): bool
    {
        if (ReservedSubdomain::where('label', $label)->exists()) {
            return true;
        }

        return SubdomainTombstone::where('label', $label)->exists();
    }
}
