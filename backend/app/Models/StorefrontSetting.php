<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Storefront homepage/theme config — one row per shop owner (Pattern B,
 * owner-only, mirrors ShopProfile). `homepage_mode` decides what a bare `/`
 * on the seller's subdomain renders — see seller_storefront_context.md §4/§5.1.
 */
class StorefrontSetting extends Model
{
    public const HOMEPAGE_STOREFRONT = 'storefront';
    public const HOMEPAGE_LANDING_PAGE = 'landing_page';

    public const THEME_STANDARD = 'standard';
    public const THEME_CARESOLUTION = 'caresolution';

    // Fallback flat rates when a seller hasn't set their own — matches the
    // caresolutionbd.com reference the "caresolution" template is based on.
    public const DEFAULT_SHIPPING_INSIDE_DHAKA = 70.0;
    public const DEFAULT_SHIPPING_OUTSIDE_DHAKA = 120.0;

    // "caresolution" template's category nav bar, when the seller hasn't
    // picked their own colors.
    public const DEFAULT_NAV_BG_COLOR = '#111827';
    public const DEFAULT_NAV_TEXT_COLOR = '#ffffff';

    protected $fillable = [
        'user_id',
        'homepage_mode',
        'homepage_landing_page_id',
        'theme_template',
        'theme_primary_color',
        'nav_bg_color',
        'nav_text_color',
        'banner_images',
        'featured_category_ids',
        'about_text',
        'about_image_url',
        'about_image_path',
        'partner_logos',
        'whatsapp_number',
        'show_call_button',
        'show_whatsapp_button',
        'show_messenger_button',
        'warranty_policy_text',
        'delivery_policy_text',
        'shipping_charge_inside_dhaka',
        'shipping_charge_outside_dhaka',
        'is_active',
    ];

    protected $casts = [
        'banner_images' => 'array',
        'featured_category_ids' => 'array',
        'partner_logos' => 'array',
        'show_call_button' => 'boolean',
        'show_whatsapp_button' => 'boolean',
        'show_messenger_button' => 'boolean',
        'shipping_charge_inside_dhaka' => 'decimal:2',
        'shipping_charge_outside_dhaka' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function shippingChargeFor(string $location): float
    {
        if ($location === 'outside_dhaka') {
            return (float) ($this->shipping_charge_outside_dhaka ?? self::DEFAULT_SHIPPING_OUTSIDE_DHAKA);
        }

        return (float) ($this->shipping_charge_inside_dhaka ?? self::DEFAULT_SHIPPING_INSIDE_DHAKA);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function homepageLandingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'homepage_landing_page_id');
    }

    /**
     * The published landing-page slug to use as the homepage, or null when
     * the shop should render the storefront home instead. Guards against a
     * picked page later being unpublished/deleted — falls back to
     * storefront rather than a broken homepage (proxy.ts §4.1 relies on
     * this via /public/shop-by-subdomain/{label}).
     */
    public function resolveHomepageLandingSlug(): ?string
    {
        if ($this->homepage_mode !== self::HOMEPAGE_LANDING_PAGE) {
            return null;
        }

        $page = $this->homepageLandingPage;

        if (! $page || $page->status !== 'published') {
            return null;
        }

        return $page->slug;
    }
}
