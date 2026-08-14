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
        'show_phone_on_sticker', 'show_address_on_sticker',
        'subdomain', 'subdomain_status', 'subdomain_set_at',
    ];

    protected $casts = [
        'show_phone_on_sticker'   => 'boolean',
        'show_address_on_sticker' => 'boolean',
        'subdomain_set_at'        => 'datetime',
    ];

    /**
     * The seller's branded host, or null when they haven't claimed a
     * subdomain (or it's been disabled). Built from the label + the
     * platform apex so a future apex change is a config edit, not a
     * data migration — see custom_domain_context.md §5.1.
     */
    public function subdomainHost(): ?string
    {
        if (! $this->subdomain || $this->subdomain_status !== 'active') {
            return null;
        }

        return $this->subdomain . '.' . config('app.subdomain_apex', 'zyrotechbd.com');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
