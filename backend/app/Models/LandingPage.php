<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class LandingPage extends Model
{
    use HasFactory;
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
        'renderer_version',
        'validation_snapshot_json',
        'published_at',
    ];

    protected $casts = [
        'theme_tokens_json' => 'array',
        'content_json' => 'array',
        'validation_snapshot_json' => 'array',
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

    public function blocks(): HasMany
    {
        return $this->hasMany(LandingPageBlock::class, 'landing_page_id')->orderBy('sort_order');
    }

    public function steps(): HasMany
    {
        return $this->hasMany(LandingPageStep::class, 'landing_page_id')->orderBy('step_order');
    }

    public function orderBumps(): HasMany
    {
        return $this->hasMany(LandingPageOrderBump::class, 'landing_page_id')->where('is_active', true)->orderBy('sort_order');
    }

    public function upsells(): HasMany
    {
        return $this->hasMany(LandingPageUpsell::class, 'landing_page_id')->where('is_active', true)->orderBy('sort_order');
    }

    public function conversionTracking(): HasMany
    {
        return $this->hasMany(LandingPageConversionTracking::class, 'landing_page_id')->orderByDesc('tracked_at');
    }
}
