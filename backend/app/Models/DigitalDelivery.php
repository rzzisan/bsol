<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DigitalDelivery extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_REVOKED = 'revoked';

    public const TYPE_HOSTED_FILE = 'hosted_file';
    public const TYPE_EXTERNAL_URL = 'external_url';

    protected $fillable = [
        'order_id',
        'order_item_id',
        'product_id',
        'user_id',
        'customer_phone',
        'customer_email',
        'delivery_type',
        'requires_otp',
        'external_url',
        'download_token',
        'otp_code',
        'otp_channel',
        'otp_sent_at',
        'otp_verified_at',
        'otp_attempts',
        'otp_resend_count',
        'otp_next_resend_at',
        'otp_blocked_until',
        'download_count',
        'max_downloads',
        'expires_at',
        'delivered_via',
        'last_downloaded_at',
        'last_download_ip',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'requires_otp' => 'boolean',
            'otp_sent_at' => 'datetime',
            'otp_verified_at' => 'datetime',
            'otp_next_resend_at' => 'datetime',
            'otp_blocked_until' => 'datetime',
            'expires_at' => 'datetime',
            'delivered_via' => 'array',
            'last_downloaded_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return now()->gt($this->expires_at);
    }

    /** Seller-configurable (Product.digital_require_otp), snapshotted onto
     *  this row at creation time — see the 2026_08_21 migration. */
    public function isOtpRequired(): bool
    {
        return $this->delivery_type === self::TYPE_HOSTED_FILE && (bool) $this->requires_otp;
    }

    public function isOtpVerified(): bool
    {
        return $this->otp_verified_at !== null;
    }

    public function canDownload(): bool
    {
        if ($this->status === self::STATUS_REVOKED) {
            return false;
        }
        if ($this->isExpired()) {
            return false;
        }
        if ($this->download_count >= $this->max_downloads) {
            return false;
        }
        if ($this->isOtpRequired() && !$this->isOtpVerified()) {
            return false;
        }

        return true;
    }
}
