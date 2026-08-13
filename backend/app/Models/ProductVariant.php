<?php

namespace App\Models;

use App\Jobs\PushWooCommerceStockJob;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductVariant extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'product_id', 'sku', 'source', 'source_ref', 'regular_price', 'discount', 'discount_type',
        'selling_price', 'cost_price', 'stock_qty', 'low_stock_threshold',
        'weight', 'image_url', 'is_active', 'position',
    ];

    protected $casts = [
        'regular_price'      => 'decimal:2',
        'discount'           => 'decimal:2',
        'selling_price'      => 'decimal:2',
        'cost_price'         => 'decimal:2',
        'is_active'          => 'boolean',
        'stock_qty'          => 'integer',
        'low_stock_threshold'=> 'integer',
        'position'           => 'integer',
    ];

    protected static function booted(): void
    {
        // Auto-compute selling_price before every save.
        static::saving(function (self $variant) {
            $regular  = (float) ($variant->regular_price ?? 0);
            $discount = (float) ($variant->discount ?? 0);

            if ($variant->discount_type === 'percent') {
                $variant->selling_price = max(0, $regular * (1 - $discount / 100));
            } else {
                $variant->selling_price = max(0, $regular - $discount);
            }
        });

        // Push a stock change on a WooCommerce-linked variant back out to
        // WordPress — see Product::booted() for the full rationale (same
        // pattern, per-variant instead of per-product).
        static::saved(function (self $variant) {
            if (
                $variant->wasChanged('stock_qty')
                && $variant->source === 'woocommerce'
                && $variant->source_ref
            ) {
                PushWooCommerceStockJob::dispatch('variant', $variant->id);
            }
        });
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function optionValues(): BelongsToMany
    {
        return $this->belongsToMany(
            ProductOptionValue::class,
            'product_variant_option_values'
        )->with('option:id,name,display_name,type');
    }

    /** Is this variant low on stock? */
    public function isLowStock(): bool
    {
        return $this->stock_qty > 0 && $this->stock_qty <= $this->low_stock_threshold;
    }
}
