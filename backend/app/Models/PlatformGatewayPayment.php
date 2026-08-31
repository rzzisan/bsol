<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One seller→platform automated-gateway payment attempt. See
 * online_payment_context.md §12 and the creating migration's docblock.
 */
class PlatformGatewayPayment extends Model
{
    public const PURPOSE_SUBSCRIPTION = 'subscription';
    public const PURPOSE_SMS_CREDIT = 'sms_credit';
    public const PURPOSE_ORDER_CREDIT = 'order_credit';
    public const PURPOSE_STOREFRONT_ADDON = 'storefront_addon';

    public const PURPOSES = [
        self::PURPOSE_SUBSCRIPTION,
        self::PURPOSE_SMS_CREDIT,
        self::PURPOSE_ORDER_CREDIT,
        self::PURPOSE_STOREFRONT_ADDON,
    ];

    public const STATUS_INITIATED = 'initiated';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    public const TERMINAL_STATUSES = [self::STATUS_COMPLETED, self::STATUS_FAILED];

    protected $fillable = [
        'purpose', 'payable_id', 'user_id', 'provider', 'amount', 'status',
        'provider_payment_id', 'provider_trx_id', 'gateway_response', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'gateway_response' => 'array',
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, self::TERMINAL_STATUSES, true);
    }

    /** The purpose-specific payment/purchase row this claim is paying for. */
    public function payable(): SubscriptionPayment|SmsCreditPurchase|AddonPurchase|null
    {
        return match ($this->purpose) {
            self::PURPOSE_SUBSCRIPTION => SubscriptionPayment::find($this->payable_id),
            self::PURPOSE_SMS_CREDIT => SmsCreditPurchase::find($this->payable_id),
            self::PURPOSE_ORDER_CREDIT, self::PURPOSE_STOREFRONT_ADDON => AddonPurchase::find($this->payable_id),
            default => null,
        };
    }
}
