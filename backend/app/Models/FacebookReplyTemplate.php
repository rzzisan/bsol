<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FacebookReplyTemplate extends Model
{
    protected $fillable = ['user_id', 'title', 'message'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
