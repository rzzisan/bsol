<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Sparse per-courier sticker template override — see StickerSetting and
 * config/sticker_templates.php. Pattern B (owner-only).
 */
class StickerCourierTemplate extends Model
{
    protected $fillable = ['user_id', 'courier_name', 'template_key'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
