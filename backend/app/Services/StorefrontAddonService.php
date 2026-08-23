<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;

/**
 * Storefront add-on — single source of truth for "does this shop have
 * storefront unlocked via add-on" (used by both EnsurePackageFeature and
 * StorefrontCatalogController::home()'s inline check) and for keeping it
 * co-terminous with the main subscription cycle (subscription_billing_context.md
 * §9.2-D). This is layered *on top of* the plan's own `feature_flags.storefront`
 * — a shop is unlocked if either is true; this service only answers the
 * add-on half of that question.
 */
class StorefrontAddonService
{
    public function hasActiveAddon(User $owner): bool
    {
        return $owner->storefront_addon_until !== null && $owner->storefront_addon_until->isFuture();
    }

    /**
     * Activate/renew the add-on — co-terminous with the shop's current
     * subscription cycle, so it needs no independent duration of its own.
     * Falls back to a flat 30 days if the seller somehow has no active
     * subscription_ends_at to anchor to (shouldn't normally happen, since
     * buying an add-on implies an active plan, but never leave the column
     * unset on a purchase).
     */
    public function activate(User $owner): void
    {
        $until = $owner->subscription_ends_at && $owner->subscription_ends_at->isFuture()
            ? $owner->subscription_ends_at
            : now()->addDays(30);

        // ->update() would silently no-op here — storefront_addon_until is
        // deliberately absent from User::$fillable (never client-writable),
        // and update() respects mass-assignment guarding. forceFill()+save()
        // is the same pattern quota_consumed_at's caller uses via a direct
        // query-builder update — this bug bit AddonPurchase.applied_at
        // earlier in this same phase (see subscription_billing_context.md
        // §10), caught here in testing before it shipped.
        $owner->forceFill(['storefront_addon_until' => $until])->save();
    }

    /**
     * Called from SubscriptionActivationService on every renewal/upgrade —
     * keeps an *already active* add-on in sync with the new cycle end.
     * Deliberately a no-op if the add-on already lapsed (never silently
     * revives a lapsed add-on just because the main plan renewed).
     */
    public function extendToMatchIfActive(User $owner, Carbon $newSubscriptionEndsAt): void
    {
        if ($this->hasActiveAddon($owner)) {
            $owner->forceFill(['storefront_addon_until' => $newSubscriptionEndsAt])->save();
        }
    }
}
