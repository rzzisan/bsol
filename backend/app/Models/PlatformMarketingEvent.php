<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One accepted BSOL acquisition-funnel event — CompleteRegistration or
 * Subscribe (platform_marketing_tracking_context.md). Small counterpart to
 * TrackingEvent: no per-destination fan-out, no quota, since there is
 * exactly one advertiser here (the platform itself).
 *
 * user_data_hashed holds sha256 digests only — see TrackingUserDataBuilder,
 * which is the only supported way to populate it. Never write raw PII here.
 */
class PlatformMarketingEvent extends Model
{
    public const STATUS_QUEUED = 'queued';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'user_id', 'event_name', 'event_id', 'action_source', 'custom_data', 'user_data_hashed',
        'status', 'response_code', 'error_message', 'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'custom_data' => 'array',
            'user_data_hashed' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
