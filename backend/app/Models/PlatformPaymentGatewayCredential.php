<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Admin's own credentials for 6 of the 7 merchant-gateway providers, used
 * for seller→platform billing (subscription, SMS credit, order-credit
 * add-on, storefront add-on). Platform-wide counterpart to
 * PaymentGatewayCredential (per-seller, customer→seller checkout) — same
 * shape, no user_id, exactly one row per provider. See
 * online_payment_context.md §12.
 *
 * bKash Merchant is deliberately NOT one of these providers (§13.2) — its
 * credentials live in PlatformBillingSetting instead, the same row the
 * SMS-credit auto-recharge Agreement feature already depends on
 * (AutoRechargeSmsCreditJob/SmsCreditAutoRechargeController). Splitting the
 * same bKash app_key/secret across two tables would recreate exactly the
 * "kept separate" problem this consolidation was asked to fix, so bKash
 * has one canonical credential source instead — see
 * PlatformGatewayPaymentService's class docblock.
 */
class PlatformPaymentGatewayCredential extends Model
{
    public const PROVIDERS = ['sslcommerz', 'aamarpay', 'zinipay', 'shurjopay', 'eps', 'nagad_merchant'];

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
