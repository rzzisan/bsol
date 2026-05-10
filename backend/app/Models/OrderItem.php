<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id', 'product_id', 'product_variant_id', 'product_name', 'sku',
        'quantity', 'regular_price', 'discount', 'discount_type', 'unit_price', 'total', 'variant_info',
    ];

    protected $casts = [
        'regular_price' => 'decimal:2',
        'discount'     => 'decimal:2',
        'discount_type'=> 'string',
        'unit_price'   => 'decimal:2',
        'total'        => 'decimal:2',
        'variant_info' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
