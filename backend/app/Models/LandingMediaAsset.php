<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingMediaAsset extends Model
{
    protected $fillable = [
        'user_id',
        'url',
        'file_path',
        'file_name',
        'mime_type',
        'file_size_bytes',
        'width',
        'height',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
