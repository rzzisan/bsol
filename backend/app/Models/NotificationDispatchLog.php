<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationDispatchLog extends Model
{
    protected $fillable = [
        'user_id',
        'binding_id',
        'template_id',
        'use_case_key',
        'channel',
        'status',
        'recipient',
        'provider',
        'attempts',
        'payload',
        'response',
        'error_message',
        'sent_at',
        'failed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'response' => 'array',
            'sent_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function binding(): BelongsTo
    {
        return $this->belongsTo(NotificationUseCaseBinding::class, 'binding_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(NotificationTemplate::class, 'template_id');
    }
}
