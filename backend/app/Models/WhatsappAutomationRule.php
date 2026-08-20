<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WhatsappAutomationRule extends Model
{
    // Same trigger vocabulary as SmsAutomationRule::TRIGGER_EVENTS — kept
    // as a separate constant (not shared) since the two rule types are
    // independent parallel tables, matching this codebase's per-feature-table
    // convention rather than a shared base.
    public const TRIGGER_EVENTS = [
        'order_confirmed',
        'order_shipped',
        'order_delivered',
        'order_cancelled',
    ];

    protected $fillable = [
        'user_id', 'name', 'trigger_event', 'template_name',
        'language_code', 'variable_mapping', 'delay_minutes', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'variable_mapping' => 'array',
            'delay_minutes' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(WhatsappAutomationLog::class, 'rule_id');
    }
}
