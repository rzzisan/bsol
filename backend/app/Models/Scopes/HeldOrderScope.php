<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Hides "held" orders (placed while the shop's subscription was expired —
 * see HeldOrderService) from anyone signed in to the dashboard: the seller,
 * their staff, an impersonating admin.
 *
 * Deliberately applies only when a user is authenticated on the request.
 * The customer-facing public flows (thank-you page, OTP, online payment
 * callbacks), queue jobs and console commands run unauthenticated and must
 * still see these orders. Code that needs held orders from inside an
 * authenticated request (the subscription banner count, the release on
 * renewal) opts out explicitly with withoutGlobalScope(HeldOrderScope::class).
 */
class HeldOrderScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (auth()->hasUser()) {
            $builder->whereNull($model->qualifyColumn('held_at'));
        }
    }
}
