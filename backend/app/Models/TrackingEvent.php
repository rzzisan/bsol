<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One accepted tracking event (tracking_capi_context.md §4.2).
 *
 * user_data_hashed holds sha256 digests only — see TrackingUserDataBuilder,
 * which is the only supported way to populate it. Never write raw PII here.
 */
class TrackingEvent extends Model
{
    public const STATUS_QUEUED = 'queued';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'user_id', 'tracking_destination_id', 'platform_api_key_id', 'landing_page_id',
        'order_id', 'event_name', 'event_id', 'event_time', 'action_source',
        'event_source_url', 'custom_data', 'user_data_hashed', 'status',
        'attempts', 'response_code', 'error_message', 'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'event_time' => 'datetime',
            'custom_data' => 'array',
            'user_data_hashed' => 'array',
            'attempts' => 'integer',
            'response_code' => 'integer',
            'sent_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function trackingDestination(): BelongsTo
    {
        return $this->belongsTo(TrackingDestination::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class);
    }

    public function platformApiKey(): BelongsTo
    {
        return $this->belongsTo(PlatformApiKey::class);
    }
}
