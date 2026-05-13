<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPageStep extends Model
{
    protected $fillable = [
        'landing_page_id',
        'step_type',
        'step_order',
        'page_id',
        'settings_json',
    ];

    protected $casts = [
        'settings_json' => 'array',
    ];

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id');
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'page_id');
    }
}
