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
        'app_id', 'login_config_id', 'app_secret', 'webhook_verify_token',
        'marketing_pixel_id', 'marketing_capi_access_token', 'marketing_test_event_code',
    ];

    protected $hidden = [
        'app_secret', 'webhook_verify_token', 'marketing_capi_access_token',
    ];

    protected function casts(): array
    {
        return [
            'app_secret' => 'encrypted',
            'webhook_verify_token' => 'encrypted',
            'marketing_capi_access_token' => 'encrypted',
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
            'login_config_id' => $this->login_config_id,
            'app_secret_set' => filled($this->app_secret),
            'webhook_verify_token_set' => filled($this->webhook_verify_token),
            'marketing_pixel_id' => $this->marketing_pixel_id,
            'marketing_capi_access_token_set' => filled($this->marketing_capi_access_token),
            'marketing_test_event_code' => $this->marketing_test_event_code,
        ];
    }

    public static function resolvedAppId(): ?string
    {
        return static::getSetting()->app_id ?: config('services.facebook.app_id');
    }

    /**
     * The seller-connect OAuth dialog is a Facebook Login for Business app
     * (Meta requires this once a Business-Login-dependent use case like
     * Messenger is added) — that flow is invoked with a Login Configuration
     * ID instead of a `scope` param. Without it Meta serves a "Feature
     * Unavailable" wall instead of the login dialog.
     */
    public static function resolvedLoginConfigId(): ?string
    {
        return static::getSetting()->login_config_id ?: config('services.facebook.login_config_id');
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

    /**
     * BSOL's own acquisition-funnel Pixel — platform_marketing_tracking_context.md.
     * Deliberately separate concept from app_id/app_secret above (those are
     * OAuth credentials for the seller Page-connect flow); this is a
     * Pixel ID + CAPI access token pasted from Meta Events Manager, same as
     * a seller's own facebook_pixel_settings row, just platform-scoped.
     */
    public static function resolvedMarketingPixelId(): ?string
    {
        return static::getSetting()->marketing_pixel_id ?: config('services.facebook.marketing_pixel_id');
    }

    public static function resolvedMarketingCapiAccessToken(): ?string
    {
        return static::getSetting()->marketing_capi_access_token ?: config('services.facebook.marketing_capi_access_token');
    }

    public static function resolvedMarketingTestEventCode(): ?string
    {
        return static::getSetting()->marketing_test_event_code ?: config('services.facebook.marketing_test_event_code');
    }
}
