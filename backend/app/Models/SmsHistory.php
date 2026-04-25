<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'gateway_id',
    'user_id',
    'gateway_name',
    'provider',
    'phone_number',
    'message',
    'status',
    'http_status_code',
    'response_body',
    'error_message',
    'sent_at',
])]
class SmsHistory extends Model
{
    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
        ];
    }
}
