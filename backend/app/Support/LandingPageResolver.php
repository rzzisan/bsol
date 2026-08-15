<?php

namespace App\Support;

use App\Models\LandingPage;
use App\Models\ShopProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Resolves a public landing-page slug against the host it was requested on
 * (custom_domain_context.md §11.9).
 *
 * Slugs are unique per shop, not globally, so the same slug can belong to
 * different sellers — the host is what disambiguates them:
 *
 *   seller1.<apex>/offer  -> seller1's page with slug 'offer'
 *   seller2.<apex>/offer  -> seller2's, a different page entirely
 *   bsol.<apex>/...       -> no landing pages live here
 *
 * Every public landing endpoint goes through here so no two of them can
 * disagree about what a slug means. The frontend needs no special handling:
 * its public calls are same-origin relative URLs, so the browser's host
 * reaches the API intact.
 */
class LandingPageResolver
{
    /**
     * Base query for the page identified by $slug on this request's host.
     *
     * Callers add their own status/eager-load constraints, exactly as they
     * did when this was an inline where('slug', ...).
     *
     * @return Builder<LandingPage>
     */
    public static function query(string $slug, Request $request): Builder
    {
        $label = self::subdomainLabel($request->getHost());
        $shopUserIds = $label === null ? null : self::shopUserIdsForLabel($label);

        // Landing pages exist only on their seller's own host. The platform
        // domain has none at all, and a subdomain nobody owns must not
        // resolve one either.
        if ($shopUserIds === null) {
            return LandingPage::query()->whereRaw('1 = 0');
        }

        return LandingPage::query()
            ->whereIn('user_id', $shopUserIds)
            ->where('slug', $slug)
            // Slug uniqueness within a shop is enforced when saving
            // (resolveSlug + validation are shop-scoped); ordering here
            // keeps resolution deterministic even if a race ever slipped
            // two rows past that.
            ->orderBy('id');
    }

    /**
     * The shop's user ids (owner + staff) for a subdomain label, or null if
     * no active shop owns it.
     *
     * @return array<int, int>|null
     */
    public static function shopUserIdsForLabel(string $label): ?array
    {
        $profile = ShopProfile::where('subdomain', $label)
            ->where('subdomain_status', 'active')
            ->first();

        if (! $profile) {
            return null;
        }

        $owner = User::find($profile->user_id);

        return $owner ? $owner->shopUserIds() : null;
    }

    /** The single label under the platform apex, or null. */
    public static function subdomainLabel(string $host): ?string
    {
        $apex = strtolower((string) config('app.subdomain_apex', 'zyrotechbd.com'));
        $bare = strtolower(explode(':', $host)[0]);

        if ($bare === "bsol.{$apex}" || ! str_ends_with($bare, ".{$apex}")) {
            return null;
        }

        $label = substr($bare, 0, -(strlen($apex) + 1));

        return str_contains($label, '.') ? null : $label;
    }
}
