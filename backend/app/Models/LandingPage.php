<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LandingPage extends Model
{
    protected $fillable = [
        'user_id',
        'template_id',
        'title',
        'slug',
        'status',
        'public_url',
        'meta_title',
        'meta_description',
        'theme_tokens_json',
        'content_json',
        'published_at',
    ];

    protected $casts = [
        'theme_tokens_json' => 'array',
        'content_json' => 'array',
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
        return $this->hasMany(LandingPageProduct::class, 'landing_page_id')->orderBy('display_order');
    }

    public function analyticsDaily(): HasMany
    {
        return $this->hasMany(LandingPageAnalyticsDaily::class, 'landing_page_id')->orderByDesc('view_date');
    }
}
