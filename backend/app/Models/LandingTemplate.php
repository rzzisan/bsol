<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LandingTemplate extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'created_by',
        'source_landing_page_id',
        'code',
        'name_bn',
        'name_en',
        'description',
        'preview_image',
        'default_content',
        'theme_settings',
        'schema',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'default_content' => 'array',
        'theme_settings' => 'array',
        'schema' => 'array',
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function sourceLandingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'source_landing_page_id');
    }

    public function pages(): HasMany
    {
        return $this->hasMany(LandingPage::class, 'template_id');
    }
}
