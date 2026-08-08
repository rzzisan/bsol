<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-seller Facebook Conversions API (CAPI) config — pixel_id + the
 * seller's own CAPI access token (from Meta Events Manager). See §6 item 4
 * in facebook_integration_context.md.
 */
class FacebookPixelSetting extends Model
{
    protected $fillable = [
        'user_id', 'pixel_id', 'access_token', 'test_event_code',
        'enabled', 'last_sent_at', 'last_error',
    ];

    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'enabled' => 'boolean',
            'last_sent_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Safe-for-frontend representation — the real access token never
     * round-trips, only whether one is set (same pattern as
     * PlatformFacebookSetting::masked()).
     */
    public function masked(): array
    {
        return [
            'pixel_id' => $this->pixel_id,
            'access_token_set' => (bool) $this->access_token,
            'test_event_code' => $this->test_event_code,
            'enabled' => $this->enabled,
            'last_sent_at' => $this->last_sent_at,
            'last_error' => $this->last_error,
        ];
    }
}
