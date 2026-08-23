<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route middleware: `package_feature:{key}`. Checks whether the acting
 * user's *shop* (owner's subscription package, resolved via shopOwner() so
 * staff are checked against the owner's plan, not their own) includes a
 * given feature — orthogonal to `owner_only` (Pattern B, who-within-the-shop)
 * and `staff_permission:{module}` (Pattern A, team-shared module access).
 * This is a third, independent axis: "does this *shop's plan* include the
 * feature at all", regardless of owner/staff. See
 * subscription_billing_context.md §9.2-E.
 *
 * `feature_flags` is a nullable json column on subscription_packages (key =>
 * bool) — a dedicated enforcement gate, distinct from the display-only
 * `features` bullet list. **Default-allow, not default-deny**: no package
 * assigned, no `feature_flags` set, or the key simply absent all pass —
 * matching this codebase's existing convention for every other
 * package-derived limit (`max_orders`, `max_tracking_events_per_day`,
 * `max_staff` — see OrderController/TrackingQuotaService/StaffController,
 * all `null = unrestricted`). Only an *explicit* `false` denies. This means
 * admin opts a package OUT of a feature, not into it — new/untouched
 * packages stay fully open, same as every pre-existing quota field. See
 * subscription_billing_context.md §9.2-E.
 */
class EnsurePackageFeature
{
    public function handle(Request $request, Closure $next, string $featureKey): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $package = $user->shopOwner()->subscriptionPackage;
        $denied = ($package?->feature_flags[$featureKey] ?? true) === false;

        if ($denied) {
            return response()->json([
                'message' => 'This feature is not included in your current plan.',
                'error_code' => 'feature_not_in_plan',
                'feature' => $featureKey,
            ], 402);
        }

        return $next($request);
    }
}
