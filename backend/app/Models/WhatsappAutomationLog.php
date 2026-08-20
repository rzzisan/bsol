<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsappAutomationLog extends Model
{
    protected $fillable = [
        'user_id', 'rule_id', 'order_id', 'trigger_event', 'customer_phone',
        'template_name', 'rendered_params', 'status', 'error_message', 'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'rendered_params' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(WhatsappAutomationRule::class, 'rule_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
