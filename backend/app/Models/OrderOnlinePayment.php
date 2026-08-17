<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * One customer-facing online-payment attempt against an order — a personal-
 * wallet "send & verify" claim, or (Phase B/C) a merchant-gateway session.
 * See online_payment_context.md.
 */
class OrderOnlinePayment extends Model
{
    public const CHANNEL_WALLET_MANUAL = 'wallet_manual';
    public const CHANNEL_GATEWAY_AUTO = 'gateway_auto';

    public const STATUS_INITIATED = 'initiated';
    public const STATUS_AWAITING_VERIFICATION = 'awaiting_verification';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_VERIFIED = 'verified';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_FAILED = 'failed';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_CANCELLED = 'cancelled';

    /** Terminal — no further transition is valid from these. */
    public const TERMINAL_STATUSES = [
        self::STATUS_COMPLETED, self::STATUS_VERIFIED, self::STATUS_REJECTED,
        self::STATUS_FAILED, self::STATUS_EXPIRED, self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'order_id', 'user_id', 'channel_type', 'provider', 'amount', 'status',
        'sender_number', 'customer_trx_id', 'screenshot_path',
        'provider_payment_id', 'provider_trx_id', 'gateway_response',
        'verified_by', 'verified_at', 'note', 'order_payment_id', 'expires_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'gateway_response' => 'array',
        'verified_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    protected $appends = ['screenshot_url'];

    public function getScreenshotUrlAttribute(): ?string
    {
        return $this->screenshot_path ? Storage::disk('public')->url($this->screenshot_path) : null;
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function orderPayment(): BelongsTo
    {
        return $this->belongsTo(OrderPayment::class);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, self::TERMINAL_STATUSES, true);
    }
}
