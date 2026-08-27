<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'price', 'duration_days', 'max_orders', 'max_landing_pages', 'max_staff', 'max_tracking_events_per_day', 'features', 'feature_flags', 'is_active'])]
class SubscriptionPackage extends Model
{
    protected function casts(): array
    {
        return [
            'features' => 'array',
            // key => bool enforcement gate, distinct from `features` (the
            // display-only bullet list) — see the migration docblock and
            // subscription_billing_context.md §9.2-E.
            'feature_flags' => 'array',
            'is_active' => 'boolean',
            'price' => 'decimal:2',
        ];
    }

    /** Every user currently assigned this package — sellers and, incidentally, any admin row that happens to carry one. Callers scope to role=user themselves when that distinction matters (AdminController::dashboardSummary). */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'subscription_package_id');
    }
}
