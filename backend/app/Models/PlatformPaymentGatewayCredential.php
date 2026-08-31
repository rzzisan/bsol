<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Admin's own credentials for the 7 merchant-gateway providers, used for
 * seller→platform billing (subscription, SMS credit, order-credit add-on,
 * storefront add-on). Platform-wide counterpart to PaymentGatewayCredential
 * (per-seller, customer→seller checkout) — same shape, no user_id, exactly
 * one row per provider. See online_payment_context.md §12.
 */
class PlatformPaymentGatewayCredential extends Model
{
    public const PROVIDERS = ['sslcommerz', 'aamarpay', 'zinipay', 'shurjopay', 'eps', 'bkash_merchant', 'nagad_merchant'];

    protected $fillable = [
        'provider', 'enabled', 'is_live', 'credentials',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'is_live' => 'boolean',
            'credentials' => 'encrypted:array',
        ];
    }

    /** Same masking convention as PaymentGatewayCredential::masked(). */
    public function masked(): array
    {
        $data = $this->toArray();
        $data['credentials'] = collect($this->credentials ?? [])->map(function ($value) {
            $value = (string) $value;
            return $value !== '' ? substr($value, 0, 4) . str_repeat('*', max(0, strlen($value) - 4)) : $value;
        })->all();
        return $data;
    }
}
