<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FacebookPageConnection extends Model
{
    protected $fillable = [
        'user_id', 'fb_page_id', 'page_name', 'page_access_token',
        'fb_user_id', 'fb_user_access_token', 'scopes', 'status',
        'webhook_subscribed_at', 'last_error',
    ];

    protected function casts(): array
    {
        return [
            'page_access_token' => 'encrypted',
            'fb_user_access_token' => 'encrypted',
            'scopes' => 'array',
            'webhook_subscribed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function leads(): HasMany
    {
        return $this->hasMany(FacebookLead::class);
    }
}
