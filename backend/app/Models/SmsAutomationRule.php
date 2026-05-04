<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SmsAutomationRule extends Model
{
    use HasFactory;

    public const TRIGGER_EVENTS = [
        'order_confirmed',
        'order_shipped',
        'order_delivered',
        'order_cancelled',
        'payment_due',
        'failed_delivery_retry',
    ];

    protected $fillable = [
        'user_id',
        'name',
        'trigger_event',
        'template_text',
        'delay_minutes',
        'is_active',
    ];

    protected $casts = [
        'delay_minutes' => 'integer',
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(SmsAutomationLog::class, 'rule_id');
    }
}
