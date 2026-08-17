<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per seller — which customer-facing online payment channels this
 * shop accepts at checkout, and the credentials/receiving numbers for each.
 * Mirrors CourierSetting's shape. See online_payment_context.md.
 */
class PaymentGatewaySetting extends Model
{
    protected $fillable = [
        'user_id',
        'bkash_personal_enabled', 'bkash_personal_number',
        'nagad_personal_enabled', 'nagad_personal_number',
        'rocket_personal_enabled', 'rocket_personal_number',
        'sslcommerz_enabled', 'sslcommerz_store_id', 'sslcommerz_store_password', 'sslcommerz_is_live',
        'bkash_gateway_enabled', 'bkash_gateway_api_type',
        'bkash_gateway_username', 'bkash_gateway_password',
        'bkash_gateway_app_key', 'bkash_gateway_app_secret', 'bkash_gateway_is_live',
    ];

    protected function casts(): array
    {
        return [
            'bkash_personal_enabled' => 'boolean',
            'nagad_personal_enabled' => 'boolean',
            'rocket_personal_enabled' => 'boolean',
            'sslcommerz_enabled' => 'boolean',
            'sslcommerz_is_live' => 'boolean',
            'bkash_gateway_enabled' => 'boolean',
            'bkash_gateway_is_live' => 'boolean',
            'sslcommerz_store_id' => 'encrypted',
            'sslcommerz_store_password' => 'encrypted',
            'bkash_gateway_username' => 'encrypted',
            'bkash_gateway_password' => 'encrypted',
            'bkash_gateway_app_key' => 'encrypted',
            'bkash_gateway_app_secret' => 'encrypted',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Which channels are actually usable at checkout right now — enabled
     *  flag AND the fields that channel needs are both present. Personal
     *  wallet channels only need a receiving number; gateway channels need
     *  their full credential set (checked by the gateway client itself,
     *  isConfigured() — kept out of this model to avoid duplicating that
     *  logic once Phase B/C land). */
    public function activeWalletChannels(): array
    {
        $channels = [];
        if ($this->bkash_personal_enabled && $this->bkash_personal_number) {
            $channels[] = ['provider' => 'bkash', 'number' => $this->bkash_personal_number];
        }
        if ($this->nagad_personal_enabled && $this->nagad_personal_number) {
            $channels[] = ['provider' => 'nagad', 'number' => $this->nagad_personal_number];
        }
        if ($this->rocket_personal_enabled && $this->rocket_personal_number) {
            $channels[] = ['provider' => 'rocket', 'number' => $this->rocket_personal_number];
        }
        return $channels;
    }

    /** Return settings with sensitive fields masked for display — same
     *  shape/convention as CourierSetting::masked(). */
    public function masked(): array
    {
        $data = $this->toArray();
        foreach (['sslcommerz_store_id', 'sslcommerz_store_password', 'bkash_gateway_username', 'bkash_gateway_password', 'bkash_gateway_app_key', 'bkash_gateway_app_secret'] as $field) {
            if (! empty($data[$field])) {
                $data[$field] = substr($data[$field], 0, 4) . str_repeat('*', max(0, strlen($data[$field]) - 4));
            }
        }
        return $data;
    }
}
