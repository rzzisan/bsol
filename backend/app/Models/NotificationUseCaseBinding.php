<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationUseCaseBinding extends Model
{
    protected $fillable = [
        'user_id',
        'use_case_key',
        'sms_template_id',
        'email_template_id',
        'priority_channel',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function smsTemplate(): BelongsTo
    {
        return $this->belongsTo(NotificationTemplate::class, 'sms_template_id');
    }

    public function emailTemplate(): BelongsTo
    {
        return $this->belongsTo(NotificationTemplate::class, 'email_template_id');
    }
}
