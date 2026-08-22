<?php

namespace App\Models;

use App\Jobs\PushWooCommerceStockJob;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Product extends Model
{
    use SoftDeletes, HasFactory;

    public const TYPE_PHYSICAL = 'physical';
    public const TYPE_DIGITAL = 'digital';

    public const DIGITAL_DELIVERY_HOSTED_FILE = 'hosted_file';
    public const DIGITAL_DELIVERY_EXTERNAL_URL = 'external_url';

    protected $fillable = [
        'user_id', 'category_id', 'name', 'sku', 'slug', 'source', 'source_ref', 'platform_api_key_id', 'description',
        'regular_price', 'discount', 'discount_type', 'selling_price', 'cost_price', 'stock', 'low_stock_alert',
        'track_stock', 'unit', 'status', 'variants', 'thumbnail', 'has_variants',
        'product_type', 'digital_delivery_type', 'digital_file_path', 'digital_file_name',
        'digital_file_mime_type', 'digital_file_size_bytes', 'digital_external_url', 'digital_delivery_channels',
        'digital_require_otp',
        // Storefront (seller_storefront_context.md §5.2, S1/S2) — features is
        // the short bullet box under the price, specifications is the
        // grouped Specification-tab table; distinct on purpose, see §1.
        'show_in_storefront', 'features', 'specifications', 'seo_content',
        'warranty_override', 'delivery_override', 'is_featured',
        // Getting-started checklist demo data (onboarding_checklist_context.md)
        'is_demo',
    ];

    protected $casts = [
        'regular_price' => 'decimal:2',
        'discount'      => 'decimal:2',
        'discount_type' => 'string',
        'selling_price' => 'decimal:2',
        'cost_price'    => 'decimal:2',
        'track_stock'   => 'boolean',
        'has_variants'  => 'boolean',
        'variants'      => 'array',
        'digital_file_size_bytes' => 'integer',
        'digital_require_otp' => 'boolean',
        'digital_delivery_channels' => 'array',
        'show_in_storefront' => 'boolean',
        'features' => 'array',
        'specifications' => 'array',
        'is_featured' => 'boolean',
        'is_demo' => 'boolean',
    ];

    public function isDigital(): bool
    {
        return $this->product_type === self::TYPE_DIGITAL;
    }

    /**
     * Pushes a stock change on a WooCommerce-linked product back out to
     * WordPress (any writer — dashboard edit, order reservation/restore in
     * OrderStatusService, the stock-adjustment endpoint — all funnel
     * through here). ConnectProductController::sync() wraps its own
     * inbound WooCommerce->BSOL writes in Product::withoutEvents() so this
     * doesn't echo straight back to where it came from. Variable-product
     * parents don't carry real stock in WooCommerce (it lives per
     * variation — see ConnectProductController), so they're skipped here;
     * ProductVariant::booted() covers those.
     */
    protected static function booted(): void
    {
        static::saved(function (self $product) {
            if (
                $product->wasChanged('stock')
                && $product->source === 'woocommerce'
                && $product->source_ref
                && ! $product->has_variants
            ) {
                PushWooCommerceStockJob::dispatch('product', $product->id);
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function platformApiKey(): BelongsTo
    {
        return $this->belongsTo(PlatformApiKey::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order');
    }

    public function primaryImage(): HasOne
    {
        return $this->hasOne(ProductImage::class)->where('is_primary', true);
    }

    public function options(): HasMany
    {
        return $this->hasMany(ProductOption::class)->orderBy('position');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('position');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(\App\Models\ProductReview::class);
    }
}
