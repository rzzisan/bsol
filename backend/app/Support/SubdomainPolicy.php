<?php

namespace App\Support;

use App\Models\ShopProfile;
use App\Models\SubdomainTombstone;

/**
 * Single source of truth for which subdomain labels a seller may claim
 * (custom_domain_context.md §5.3/§5.4).
 *
 * The reserved list lives in code, not in the database, on purpose: an admin
 * must not be able to free up 'mail' or 'cpanel' through a UI and silently
 * break email or the hosting control panel. Changing it requires a commit.
 */
class SubdomainPolicy
{
    public const MIN_LENGTH = 3;

    public const MAX_LENGTH = 63;

    /**
     * Labels that already exist as explicit DNS records in the zone
     * (extracted from the live Cloudflare zone, 2026-08-14). A seller who
     * claimed one of these would hijack a running service — the wildcard
     * never overrides an explicit record, so the DNS would keep pointing at
     * the real host while BSOL believed the label belonged to the seller.
     *
     * Keep in sync when a new DNS record is added to zyrotechbd.com.
     */
    private const EXISTING_DNS_LABELS = [
        'ai', 'app', 'autoconfig', 'autodiscover', 'bsol', 'caldav', 'caldavs',
        'carddav', 'carddavs', 'catv', 'catv-dev', 'cpanel', 'cpcalendars',
        'cpcontacts', 'default', 'dishbill', 'dmarc', 'dokploy', 'domainkey',
        'ftp', 'iptv', 'isp', 'mail', 'portal', 'saas', 'sub', 'webdisk',
        'webmail', 'whm', 'www',
    ];

    /**
     * Names we may plausibly need later, plus the usual infrastructure and
     * role-account names. Cheaper to reserve now than to claw back from a
     * seller who is already advertising the URL.
     */
    private const RESERVED_LABELS = [
        // infrastructure
        'api', 'admin', 'ns', 'ns1', 'ns2', 'ns3', 'dns', 'mx', 'smtp', 'imap',
        'pop', 'pop3', 'email', 'relay', 'gateway', 'proxy', 'vpn', 'ssh',
        // environments
        'staging', 'stage', 'dev', 'test', 'testing', 'demo', 'sandbox',
        'beta', 'alpha', 'preview', 'local', 'localhost',
        // assets / delivery
        'cdn', 'static', 'assets', 'media', 'img', 'images', 'files',
        'download', 'downloads', 'upload', 'uploads',
        // ops
        'status', 'health', 'monitor', 'monitoring', 'metrics', 'logs',
        'backup', 'backups', 'grafana', 'kibana',
        // product surfaces we may want
        'support', 'help', 'helpdesk', 'docs', 'doc', 'blog', 'news',
        'shop', 'store', 'pay', 'payment', 'payments', 'checkout',
        'billing', 'invoice', 'account', 'accounts', 'auth', 'sso', 'id',
        'login', 'signup', 'register', 'dashboard', 'panel', 'console',
        'partner', 'partners', 'affiliate', 'reseller', 'agency',
        // mail policy / role accounts
        'dkim', 'spf', 'postmaster', 'hostmaster', 'abuse', 'security',
        'noreply', 'no-reply', 'root', 'info', 'contact', 'sales',
        // brand
        'bsol', 'zyro', 'zyrotech', 'zyrotechbd', 'official', 'www2',
    ];

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
     * Reserved covers three things a seller must never be able to claim:
     * a name already in DNS, a name we have set aside, and a name some other
     * seller used to own (see SubdomainTombstone).
     */
    public static function isReserved(string $label): bool
    {
        if (in_array($label, self::EXISTING_DNS_LABELS, true)) {
            return true;
        }

        if (in_array($label, self::RESERVED_LABELS, true)) {
            return true;
        }

        return SubdomainTombstone::where('label', $label)->exists();
    }
}
