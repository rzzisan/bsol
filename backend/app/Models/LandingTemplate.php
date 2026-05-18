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
        'code',
        'name_bn',
        'name_en',
        'description',
        'preview_image',
        'default_content',
        'schema',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'default_content' => 'array',
        'schema' => 'array',
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function pages(): HasMany
    {
        return $this->hasMany(LandingPage::class, 'template_id');
    }
}
