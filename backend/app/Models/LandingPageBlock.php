<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LandingPageBlock extends Model
{
    protected $fillable = [
        'landing_page_id',
        'block_key',
        'block_type',
        'parent_block_id',
        'sort_order',
        'locked',
        'visibility_rules_json',
        'settings_json',
        'content_json',
    ];

    protected $casts = [
        'locked' => 'boolean',
        'visibility_rules_json' => 'array',
        'settings_json' => 'array',
        'content_json' => 'array',
    ];

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id');
    }

    public function parentBlock(): BelongsTo
    {
        return $this->belongsTo(LandingPageBlock::class, 'parent_block_id');
    }

    public function childBlocks(): HasMany
    {
        return $this->hasMany(LandingPageBlock::class, 'parent_block_id')->orderBy('sort_order');
    }
}
