<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Sticker Template feature — Pattern B (owner-only), one row per shop.
 * See config/sticker_templates.php for the catalog and
 * StickerCourierTemplate for per-courier overrides.
 */
class StickerSetting extends Model
{
    protected $fillable = ['user_id', 'default_template_key'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
