<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Shop identity/branding — name, phone, address, logo. One row per shop
 * owner (Pattern B, owner-only — staff can't create/edit this, only see it
 * used elsewhere, e.g. the courier waybill's FROM/sender block).
 */
class ShopProfile extends Model
{
    protected $fillable = [
        'user_id', 'shop_name', 'phone', 'email', 'address', 'logo_path', 'logo_url',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
