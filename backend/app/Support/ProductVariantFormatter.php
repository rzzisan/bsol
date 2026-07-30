<?php

namespace App\Support;

use App\Models\ProductVariant;

class ProductVariantFormatter
{
    /**
     * Canonical variant → array transform shared by the merchant variant
     * endpoints (ProductVariantController) and the public landing-page
     * variant endpoints (LandingPageController).
     */
    public static function format(ProductVariant $variant): array
    {
        return [
            'id'                  => $variant->id,
            'sku'                 => $variant->sku,
            'regular_price'       => $variant->regular_price,
            'discount'            => $variant->discount,
            'discount_type'       => $variant->discount_type,
            'selling_price'       => $variant->selling_price,
            'cost_price'          => $variant->cost_price,
            'stock_qty'           => $variant->stock_qty,
            'low_stock_threshold' => $variant->low_stock_threshold,
            'weight'              => $variant->weight,
            'image_url'           => $variant->image_url,
            'is_active'           => $variant->is_active,
            'position'            => $variant->position,
            'is_low_stock'        => $variant->isLowStock(),
            'options'             => $variant->relationLoaded('optionValues')
                ? $variant->optionValues->map(fn ($ov) => [
                    'option_value_id' => $ov->id,
                    'option_id'       => $ov->option?->id,
                    'option_name'     => $ov->option?->name,
                    'option_type'     => $ov->option?->type,
                    'value'           => $ov->value,
                    'label'           => $ov->label,
                    'color_hex'       => $ov->color_hex,
                    'image_url'       => $ov->image_url,
                ])
                : [],
        ];
    }
}
