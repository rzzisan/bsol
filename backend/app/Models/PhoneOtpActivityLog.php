<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PhoneOtpActivityLog extends Model
{
    protected $fillable = [
        'mobile',
        'event_type',
        'status',
        'provider',
        'message',
        'error_message',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }
}
