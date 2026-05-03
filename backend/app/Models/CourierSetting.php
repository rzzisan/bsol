<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourierSetting extends Model
{
    protected $fillable = [
        'user_id', 'default_courier',
        'steadfast_api_key', 'steadfast_secret_key',
        'pathao_client_id', 'pathao_client_secret', 'pathao_store_id',
        'pathao_username', 'pathao_password',
        'pathao_access_token', 'pathao_refresh_token', 'pathao_token_expires_at',
        'redx_api_key',
    ];

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Return settings with sensitive keys masked for display */
    public function masked(): array
    {
        $data = $this->toArray();
        foreach (['steadfast_api_key','steadfast_secret_key','pathao_client_secret','pathao_password','pathao_access_token','pathao_refresh_token','redx_api_key'] as $field) {
            if (!empty($data[$field])) {
                $data[$field] = substr($data[$field], 0, 4) . str_repeat('*', max(0, strlen($data[$field]) - 4));
            }
        }
        return $data;
    }
}
