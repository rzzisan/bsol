<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Storefront product review — open submission, moderation gate.
 * seller_storefront_context.md §5.3/§12 (S7).
 */
class ProductReview extends Model
{
    protected $fillable = [
        'product_id', 'user_id', 'order_id',
        'customer_name', 'customer_phone', 'rating', 'comment', 'is_approved',
    ];

    protected $casts = [
        'rating' => 'integer',
        'is_approved' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
