<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformBillingSetting extends Model
{
    protected $fillable = [
        'bkash_number',
        'bkash_type',
        'bkash_app_key',
        'bkash_app_secret',
        'bkash_username',
        'bkash_password',
        'bkash_sandbox',
        'bkash_api_type',
    ];

    protected function casts(): array
    {
        return [
            'bkash_app_secret' => 'encrypted',
            'bkash_password' => 'encrypted',
            'bkash_sandbox' => 'boolean',
        ];
    }

    public static function getSetting(): static
    {
        $setting = static::first();

        if (! $setting) {
            $setting = static::create([
                'bkash_number' => null,
                'bkash_type' => 'Personal',
            ]);
        }

        return $setting;
    }

    /** Admin-display version — bKash secret/password never round-trip, only whether they're set. */
    public function masked(): array
    {
        return [
            'bkash_number' => $this->bkash_number,
            'bkash_type' => $this->bkash_type,
            'bkash_app_key' => $this->bkash_app_key,
            'bkash_app_secret_set' => filled($this->bkash_app_secret),
            'bkash_username' => $this->bkash_username,
            'bkash_password_set' => filled($this->bkash_password),
            'bkash_sandbox' => $this->bkash_sandbox,
            'bkash_api_type' => $this->bkash_api_type ?: 'tokenized',
            'bkash_gateway_configured' => $this->hasBkashGateway(),
        ];
    }

    public function hasBkashGateway(): bool
    {
        return filled($this->bkash_app_key)
            && filled($this->bkash_app_secret)
            && filled($this->bkash_username)
            && filled($this->bkash_password);
    }

    public static function resolvedBkashAppKey(): ?string
    {
        return static::getSetting()->bkash_app_key ?: config('services.bkash.app_key');
    }

    public static function resolvedBkashAppSecret(): ?string
    {
        return static::getSetting()->bkash_app_secret ?: config('services.bkash.app_secret');
    }

    public static function resolvedBkashUsername(): ?string
    {
        return static::getSetting()->bkash_username ?: config('services.bkash.username');
    }

    public static function resolvedBkashPassword(): ?string
    {
        return static::getSetting()->bkash_password ?: config('services.bkash.password');
    }

    public static function resolvedBkashSandbox(): bool
    {
        $setting = static::getSetting();

        return $setting->bkash_app_key ? (bool) $setting->bkash_sandbox : config('services.bkash.sandbox', true);
    }

    /** 'tokenized' (Tokenized Checkout, v1.2.0-beta, tokenized.pay.bka.sh) or 'pgw' (classic Checkout API, checkout.pay.bka.sh). */
    public static function resolvedBkashApiType(): string
    {
        return static::getSetting()->bkash_api_type ?: 'tokenized';
    }
}
