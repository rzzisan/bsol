<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Single-row settings table (same pattern as PlatformFacebookSetting) — the
 * admin-facing kill switch + daily cost cap for AiSupportAgentService.
 */
class PlatformAiSupportSetting extends Model
{
    protected $fillable = [
        'is_enabled', 'model', 'effort', 'max_ai_replies_per_day',
        'daily_reply_count', 'daily_reply_count_reset_at', 'system_prompt_extra', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'daily_reply_count_reset_at' => 'date',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public static function current(): self
    {
        $settings = static::query()->firstOrCreate([]);

        // firstOrCreate()'s in-memory model only has the attributes we passed
        // (none) — Postgres doesn't round-trip column defaults back into it,
        // so a fresh row would read is_enabled as null instead of false.
        if ($settings->wasRecentlyCreated) {
            $settings->refresh();
        }

        return $settings;
    }

    /**
     * Resets the daily counter if the stored reset date isn't today, then
     * reports whether a reply is still allowed. Does NOT increment — call
     * recordReply() after an AI reply is actually sent.
     */
    public function canSendAnotherReplyToday(): bool
    {
        $today = now()->toDateString();

        if ($this->daily_reply_count_reset_at === null || $this->daily_reply_count_reset_at->toDateString() !== $today) {
            $this->forceFill(['daily_reply_count' => 0, 'daily_reply_count_reset_at' => $today])->save();
        }

        if ($this->max_ai_replies_per_day === null) {
            return true;
        }

        return $this->daily_reply_count < $this->max_ai_replies_per_day;
    }

    public function recordReply(): void
    {
        $this->increment('daily_reply_count');
    }
}
