<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPageStatistic extends Model
{
    protected $table = 'landing_page_statistics';

    protected $fillable = [
        'landing_page_id',
        'date',
        'total_visits',
        'unique_visitors',
        'orders_placed',
    ];

    protected $casts = [
        'date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class);
    }
}
