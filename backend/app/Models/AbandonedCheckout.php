<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AbandonedCheckout extends Model
{
    use SoftDeletes;

    /** Minutes of inactivity on an "active" row before it's considered abandoned rather than in-progress. */
    public const ABANDONED_AFTER_MINUTES = 20;

    protected $fillable = [
        'user_id',
        'landing_page_id',
        'session_token',
        'customer_name',
        'customer_phone',
        'customer_email',
        'customer_address',
        'customer_district',
        'customer_thana',
        'customer_area',
        'notes',
        'custom_fields',
        'items',
        'subtotal',
        'ip_address',
        'status',
        'order_id',
        'last_activity_at',
    ];

    protected $casts = [
        'custom_fields' => 'array',
        'items' => 'array',
        'subtotal' => 'decimal:2',
        'last_activity_at' => 'datetime',
    ];

    protected $appends = ['is_abandoned'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    public function getIsAbandonedAttribute(): bool
    {
        return $this->status === 'active'
            && $this->last_activity_at !== null
            && $this->last_activity_at->lt(now()->subMinutes(self::ABANDONED_AFTER_MINUTES));
    }
}
