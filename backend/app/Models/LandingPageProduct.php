<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPageProduct extends Model
{
    protected $fillable = [
        'landing_page_id',
        'product_id',
        'title_override',
        'subtitle',
        'badge_text',
        'price_override',
        'default_qty',
        'selected_by_default',
        'sort_order',
    ];

    protected $casts = [
        'price_override' => 'decimal:2',
        'selected_by_default' => 'boolean',
    ];

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
