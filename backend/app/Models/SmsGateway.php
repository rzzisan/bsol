<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'name',
    'provider',
    'endpoint_url',
    'api_key',
    'secret_key',
    'sender_id',
    'is_active',
    'is_enabled',
])]
class SmsGateway extends Model
{
    protected function casts(): array
    {
        return [
            'api_key' => 'encrypted',
            'secret_key' => 'encrypted',
            'is_active' => 'boolean',
            'is_enabled' => 'boolean',
        ];
    }
}
