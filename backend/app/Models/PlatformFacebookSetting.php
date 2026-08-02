<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Super-admin-configured Meta for Developers App credentials (single row,
 * platform-wide — one BSOL app shared by every seller's per-Page OAuth
 * connect flow, see FacebookPageConnection). Falls back to the
 * FACEBOOK_APP_ID/APP_SECRET/WEBHOOK_VERIFY_TOKEN env vars when the DB row
 * is empty, so either configuration path (.env or this admin UI) works.
 */
class PlatformFacebookSetting extends Model
{
    protected $fillable = [
        'app_id', 'app_secret', 'webhook_verify_token',
    ];

    protected $hidden = [
        'app_secret', 'webhook_verify_token',
    ];

    protected function casts(): array
    {
        return [
            'app_secret' => 'encrypted',
            'webhook_verify_token' => 'encrypted',
        ];
    }

    public static function getSetting(): static
    {
        return static::first() ?? static::create([]);
    }

    /** Admin-display version — never returns the real secret, only whether one is set. */
    public function masked(): array
    {
        return [
            'app_id' => $this->app_id,
            'app_secret_set' => filled($this->app_secret),
            'webhook_verify_token_set' => filled($this->webhook_verify_token),
        ];
    }

    public static function resolvedAppId(): ?string
    {
        return static::getSetting()->app_id ?: config('services.facebook.app_id');
    }

    public static function resolvedAppSecret(): ?string
    {
        return static::getSetting()->app_secret ?: config('services.facebook.app_secret');
    }

    public static function resolvedWebhookVerifyToken(): ?string
    {
        return static::getSetting()->webhook_verify_token ?: config('services.facebook.webhook_verify_token');
    }

    public static function resolvedGraphVersion(): string
    {
        return config('services.facebook.graph_version', 'v21.0');
    }
}
