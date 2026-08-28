<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SmsAutomationRule extends Model
{
    use HasFactory;

    // 'payment_due' and 'failed_delivery_retry' used to be offered here but
    // handleOrderStatusChanged()/statusToTriggerEvent() (the only thing that
    // ever fires a rule) has no code path that produces either — a
    // due-date concept and a courier-retry signal that don't exist yet.
    // Dropped rather than implemented (0 rows used either in production —
    // pre_launch_polish_context.md §চ); WhatsappAutomationRule::
    // TRIGGER_EVENTS, the newer sibling feature, was already built without
    // them.
    public const TRIGGER_EVENTS = [
        'order_confirmed',
        'order_shipped',
        'order_delivered',
        'order_cancelled',
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
