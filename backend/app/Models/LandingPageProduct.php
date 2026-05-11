<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPageProduct extends Model
{
    protected $fillable = [
        'landing_page_id',
        'product_id',
        'custom_title',
        'custom_price',
        'default_qty',
        'display_order',
        'is_featured',
    ];

    protected $casts = [
        'custom_price' => 'decimal:2',
        'is_featured' => 'boolean',
    ];

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
