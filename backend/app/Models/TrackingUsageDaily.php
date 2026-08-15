<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A seller's tracking usage for one Asia/Dhaka calendar day
 * (tracking_capi_context.md §4.3). Written through
 * TrackingQuotaService::bump(), which increments atomically in SQL — do not
 * read-modify-write these counters from application code.
 */
class TrackingUsageDaily extends Model
{
    protected $table = 'tracking_usage_daily';

    protected $fillable = [
        'user_id', 'date', 'accepted_count', 'dropped_count',
        'overage_count', 'sent_count', 'failed_count',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'accepted_count' => 'integer',
            'dropped_count' => 'integer',
            'overage_count' => 'integer',
            'sent_count' => 'integer',
            'failed_count' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
