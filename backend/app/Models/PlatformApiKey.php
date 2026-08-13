<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Domain-bound API key for external platform connectors (currently just the
 * BSOL WordPress/WooCommerce plugin, `platform: woocommerce`). One row per
 * shop owner (Pattern B, owner-only — see staff_team_role_context.md §3.3).
 *
 * The raw key is never persisted — only a sha256 hash — and is shown to the
 * seller exactly once, at generation time. See
 * bsol_history_and_new_context.md §5 for the design this implements.
 */
class PlatformApiKey extends Model
{
    protected $fillable = [
        'user_id', 'platform', 'domain', 'key_hash', 'key_prefix', 'webhook_secret',
        'status', 'last_used_at', 'last_connected_ip', 'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'last_used_at'   => 'datetime',
            'revoked_at'     => 'datetime',
            'webhook_secret' => 'encrypted',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function generateRawKey(): string
    {
        return 'bsol_' . bin2hex(random_bytes(32));
    }

    public static function hashKey(string $rawKey): string
    {
        return hash('sha256', $rawKey);
    }

    /**
     * Indexed lookup by hash, with a hash_equals() re-check on the fetched
     * row as defense in depth (matches the app's existing hash_equals usages
     * in CheckoutOtpController/FacebookGraphClient — never use === on a
     * secret comparison).
     */
    public static function findByRawKey(string $rawKey): ?self
    {
        $hash = self::hashKey($rawKey);
        $record = static::where('key_hash', $hash)->first();

        if ($record && hash_equals($record->key_hash, $hash)) {
            return $record;
        }

        return null;
    }

    public static function normalizeHost(string $domain): string
    {
        $host = parse_url($domain, PHP_URL_HOST) ?: $domain;
        $host = strtolower(trim($host));

        return preg_replace('/^www\./', '', $host);
    }

    public function matchesDomain(string $domain): bool
    {
        return self::normalizeHost($this->domain) === self::normalizeHost($domain);
    }

    public function markUsed(?string $ip = null): void
    {
        $this->last_used_at = now();
        $this->last_connected_ip = $ip;
        if ($this->status === 'pending') {
            $this->status = 'connected';
        }
        $this->save();
    }

    public function masked(): string
    {
        return ($this->key_prefix ?: 'bsol_') . str_repeat('•', 12);
    }
}
