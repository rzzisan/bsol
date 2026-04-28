<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationTemplate extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'channel',
        'language',
        'sms_gateway_id',
        'email_configuration_id',
        'subject',
        'body',
        'variables',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'variables' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function smsGateway(): BelongsTo
    {
        return $this->belongsTo(SmsGateway::class);
    }

    public function emailConfiguration(): BelongsTo
    {
        return $this->belongsTo(EmailConfiguration::class);
    }
}
