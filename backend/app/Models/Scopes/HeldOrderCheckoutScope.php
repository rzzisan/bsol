<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Companion to HeldOrderScope for AbandonedCheckout: a checkout that
 * converted into a *held* order (shop subscription expired, see
 * HeldOrderService) must vanish from the seller's abandoned-checkout
 * views too, or it would show up as a "converted" row pointing at an order
 * they can't see. Same rule as HeldOrderScope — only for authenticated
 * requests; the public resume/convert flows are unaffected. The rows
 * reappear when the order is released (held_at cleared) on renewal.
 */
class HeldOrderCheckoutScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (! auth()->hasUser()) {
            return;
        }

        $table = $model->getTable();

        $builder->whereNotExists(function ($q) use ($table) {
            $q->selectRaw('1')
                ->from('orders')
                ->whereColumn('orders.id', "{$table}.order_id")
                ->whereNotNull('orders.held_at');
        });
    }
}
