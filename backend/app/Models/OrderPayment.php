<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * One seller-collected manual payment event against an order (cash/bank/
 * bKash/etc — not the courier's own COD remittance). An order can have many
 * of these (advance now, rest later). See manual_payment_collection_context.md.
 */
class OrderPayment extends Model
{
    public const PURPOSES = ['advance', 'courier_charge', 'full_payment', 'other'];

    public const METHODS = ['cash', 'bank', 'bkash', 'nagad', 'rocket', 'upay', 'other'];

    /** Mobile-banking methods where a transfer screenshot is the only proof of payment. */
    public const SCREENSHOT_REQUIRED_METHODS = ['bkash', 'nagad', 'rocket', 'upay'];

    /** Who/what created this ledger row — see online_payment_context.md. */
    public const SOURCES = ['manual', 'online_wallet', 'online_gateway'];

    protected $fillable = [
        'order_id', 'user_id', 'source', 'collected_by', 'created_by',
        'purpose', 'method', 'amount', 'discount',
        'screenshot_path', 'note', 'collected_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'discount' => 'decimal:2',
        'collected_at' => 'datetime',
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

    /** Who physically received the money — may be any owner/staff in the shop pool. */
    public function collector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collected_by');
    }

    /** Who logged this entry into the system — may differ from the collector. */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
