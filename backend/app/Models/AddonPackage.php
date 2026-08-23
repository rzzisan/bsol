<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Super-admin-defined add-on SKU — subscription_billing_context.md §9.2-B.
 * Only `type = 'order_credit'` is currently creatable/wired end-to-end
 * (AdminAddonPackageController, AddonApplyService) — see the migration
 * docblock for why the other type strings already exist in the schema.
 */
#[Fillable(['type', 'name', 'price', 'quantity', 'duration_days', 'is_active'])]
class AddonPackage extends Model
{
    public const TYPES = ['order_credit', 'landing_page', 'storefront', 'tracking_boost'];

    /** Types with a working AddonApplyService branch — the only ones admin can create right now. */
    public const CREATABLE_TYPES = ['order_credit'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function purchases()
    {
        return $this->hasMany(AddonPurchase::class);
    }
}
