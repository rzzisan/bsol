<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FunnelFlow extends Model
{
    use HasFactory;
    protected $fillable = [
        'funnel_id',
        'name',
        'version',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function funnel(): BelongsTo
    {
        return $this->belongsTo(Funnel::class);
    }

    public function steps(): HasMany
    {
        return $this->hasMany(FunnelFlowStep::class, 'funnel_flow_id')->orderBy('step_order');
    }
}
