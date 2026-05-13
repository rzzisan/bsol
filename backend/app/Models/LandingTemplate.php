<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class LandingTemplate extends Model
{
    use HasFactory;
    protected $fillable = [
        'code',
        'name_bn',
        'name_en',
        'description_bn',
        'description_en',
        'thumbnail_url',
        'category',
        'layout_profile',
        'editor_mode',
        'default_schema_json',
        'is_active',
        'sort_order',
        'created_by',
    ];

    protected $casts = [
        'default_schema_json' => 'array',
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function accessRules(): HasMany
    {
        return $this->hasMany(LandingTemplateAccessRule::class, 'template_id');
    }

    public function pages(): HasMany
    {
        return $this->hasMany(LandingPage::class, 'template_id');
    }
}
