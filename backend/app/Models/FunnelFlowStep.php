<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FunnelFlowStep extends Model
{
    use HasFactory;
    protected $fillable = [
        'funnel_flow_id',
        'step_type',
        'step_order',
        'landing_page_id',
        'slug',
        'is_enabled',
        'settings_json',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'settings_json' => 'array',
    ];

    public function funnelFlow(): BelongsTo
    {
        return $this->belongsTo(FunnelFlow::class, 'funnel_flow_id');
    }

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id');
    }
}
