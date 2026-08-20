<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DigitalProductSetting extends Model
{
    protected $fillable = [
        'user_id',
        'max_file_size_mb',
        'allowed_extensions',
        'download_link_expiry_hours',
        'max_downloads_per_purchase',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'allowed_extensions' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The single "latest active" global policy row, with defaults for a
     * fresh install that's never had one saved — same shape/values used by
     * DigitalProductFileController, DigitalDeliveryService, and
     * Admin\DigitalProductSettingsController::show(), kept in one place so
     * the three can't drift.
     *
     * @return array{max_file_size_mb:int, allowed_extensions:array<int,string>, download_link_expiry_hours:int, max_downloads_per_purchase:int}
     */
    public static function effective(): array
    {
        $settings = static::query()->where('is_active', true)->latest('id')->first();

        return [
            'max_file_size_mb' => (int) ($settings?->max_file_size_mb ?? 200),
            'allowed_extensions' => $settings?->allowed_extensions
                ?: ['pdf', 'zip', 'epub', 'mp3', 'mp4', 'docx', 'xlsx', 'pptx'],
            'download_link_expiry_hours' => (int) ($settings?->download_link_expiry_hours ?? 168),
            'max_downloads_per_purchase' => (int) ($settings?->max_downloads_per_purchase ?? 5),
        ];
    }
}
