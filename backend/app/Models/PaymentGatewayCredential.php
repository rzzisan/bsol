<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per seller per merchant-gateway provider (SSLCommerz, AamarPay,
 * ZiniPay, ShurjoPay, EPS, bKash Merchant, Nagad Merchant) — Phase B/C of
 * customer-facing online payment. See online_payment_context.md.
 */
class PaymentGatewayCredential extends Model
{
    public const PROVIDERS = ['sslcommerz', 'aamarpay', 'zinipay', 'shurjopay', 'eps', 'bkash_merchant', 'nagad_merchant'];

    protected $fillable = [
        'user_id', 'provider', 'enabled', 'is_live', 'credentials',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'is_live' => 'boolean',
            // Laravel's built-in encrypted:array cast — JSON-encodes the
            // provider-specific credential shape, then encrypts the whole
            // blob. No fixed column per credential field, unlike
            // PaymentGatewaySetting/CourierSetting (those work because
            // every provider they cover shares a small, stable field set;
            // these seven don't).
            'credentials' => 'encrypted:array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Same masking convention as CourierSetting::masked()/
     *  PaymentGatewaySetting::masked(), generalized to an arbitrary key set
     *  since each provider's credentials array has different keys. */
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
