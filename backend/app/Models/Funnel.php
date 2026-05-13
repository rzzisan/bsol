<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Funnel extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id',
        'name',
        'slug',
        'status',
        'theme_tokens_json',
        'settings_json',
        'published_at',
    ];

    protected $casts = [
        'theme_tokens_json' => 'array',
        'settings_json' => 'array',
        'published_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function flows(): HasMany
    {
        return $this->hasMany(FunnelFlow::class, 'funnel_id');
    }

    public function activeFlow(): HasMany
    {
        return $this->hasMany(FunnelFlow::class, 'funnel_id')->where('is_active', true);
    }
}
