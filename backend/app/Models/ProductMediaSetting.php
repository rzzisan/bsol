<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductMediaSetting extends Model
{
    protected $fillable = [
        'user_id',
        'max_gallery_images',
        'max_file_size_mb',
        'allowed_mime_types',
        'min_width',
        'min_height',
        'max_width',
        'max_height',
        'thumbnail_required',
        'is_active',
    ];

    protected $casts = [
        'allowed_mime_types' => 'array',
        'thumbnail_required' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
