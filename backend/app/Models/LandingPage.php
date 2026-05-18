<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LandingPage extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'template_id',
        'title',
        'slug',
        'status',
        'theme_settings',
        'content',
        'seo_meta',
        'custom_css',
        'published_at',
    ];

    protected $casts = [
        'theme_settings' => 'array',
        'content' => 'array',
        'seo_meta' => 'array',
        'published_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(LandingTemplate::class, 'template_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(LandingPageProduct::class)->orderBy('sort_order');
    }
}
