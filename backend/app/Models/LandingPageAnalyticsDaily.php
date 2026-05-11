<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPageAnalyticsDaily extends Model
{
    protected $table = 'landing_page_analytics_daily';

    protected $fillable = [
        'landing_page_id',
        'view_date',
        'total_views',
        'unique_visitors',
        'cta_clicks',
        'checkout_starts',
        'orders_completed',
        'revenue',
    ];

    protected $casts = [
        'view_date' => 'date',
        'revenue' => 'decimal:2',
    ];

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id');
    }
}
