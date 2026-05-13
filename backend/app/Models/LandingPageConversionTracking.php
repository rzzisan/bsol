<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPageConversionTracking extends Model
{
    protected $table = 'landing_page_conversion_tracking';

    protected $fillable = [
        'landing_page_id',
        'event_type',
        'session_id',
        'visitor_id',
        'source',
        'device',
        'country',
        'metadata_json',
        'tracked_at',
    ];

    protected $casts = [
        'metadata_json' => 'array',
        'tracked_at' => 'datetime',
    ];

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id');
    }
}
