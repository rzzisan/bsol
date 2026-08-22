# Onboarding "Getting Started" Checklist

Design + build reference for the dashboard-home "Getting Started" checklist — `production_audit_report_context.md §7` (P1), `feature_roadmap_context.md` status table. Built 2026-08-22.

## Problem

The existing mandatory `/onboarding` page (`frontend/src/app/onboarding/page.tsx`, gated by `AuthController::onboardingState()`) only covers the two *mandatory* technical steps a new seller must finish before `/dashboard` is even reachable: shop profile, then subdomain claim. Once done, they land on `dashboard/page.tsx` — an all-zero stats page with no guidance on what to do next and no sample data to explore risk-free. The production-readiness audit flagged this as the top-priority gap (P1): a seller who reaches an ad via FB but then gets stuck in an empty dashboard is the same wasted-acquisition-cost problem this whole SaaS was built to solve for its own sellers, applied to BSOL's own funnel.

This feature is **not** a new mandatory gate — it's a dismissible nudge on the dashboard home, distinct from `/onboarding`.

## Design decisions

**Derived, not stored, checklist state.** No "step 1 done" flags anywhere. Every step's `done` is computed live at request time from real data (`DashboardGettingStartedController::show()`):
- `profile` — always true (mandatory `/onboarding` guarantees it before dashboard is reachable; shown for a complete, motivating list).
- `product` — a `Product` row exists with `is_demo = false`. Demo products intentionally don't count — the goal is a real product.
- `courier` — a `CourierSetting` row exists with any provider key set (steadfast/pathao/redx/carrybee/paperfly).
- `payment` — `PaymentGatewaySetting` has any personal-wallet channel enabled, or any `PaymentGatewayCredential` row is `enabled = true`.

This means the checklist can never drift out of sync with what the seller actually configured elsewhere — there's nothing to keep in sync.

**Dismissal.** One nullable `shop_profiles.getting_started_dismissed_at` timestamp. The checklist renders whenever it's null; a manual "✕" always sets it. When all 3 actionable steps are done, the widget shows a success state (with the same dismiss control) instead of silently disappearing — no surprise vanishing act.

**Demo data is opt-in, never auto-seeded.** A real production storefront is not a sandbox — silently seeding fake products into a real seller's catalog risks a demo item accidentally being sellable. Instead:
- A button next to the "add first product" step lets the seller explicitly load 3 sample products.
- Every demo product is created `status: 'inactive'` — verified structurally invisible everywhere a real transaction could touch a product: `StorefrontCatalogController`'s public catalog and `OrderController::createBootstrap` (the order-create product picker) both filter `status = 'active'`. A demo product can only ever be seen in the seller's own Dashboard → Products list, badged "ডেমো"/"DEMO" there.
- New `products.is_demo` boolean (default false) — kept deliberately separate from the existing `source` column (`manual`/`woocommerce`, integration provenance) rather than overloading it, since `source === 'woocommerce'` drives real sync/push-back logic elsewhere in `Product::booted()` and mixing concerns there would be a foot-gun.
- Creating demo products is idempotent (`POST` is a no-op if any already exist) — a seller mashing the button doesn't get duplicate batches.
- Removing demo data is a single action that deletes every `is_demo = true` row for the shop; it doesn't touch real products even if their names happen to start similarly.

**Staff exemption.** Every route is gated by the existing `owner_only` middleware (same middleware used for courier/payment/storefront settings) — this is owner-facing setup guidance, not an operational staff task, mirroring the mandatory-onboarding gate's own staff exemption in `AuthController::onboardingState()`. The frontend also hides the widget entirely for staff accounts (`getStoredUser()?.is_staff`) so there's no flash-then-403.

## API

`GET /api/dashboard/getting-started` → `{dismissed, shop_url, steps: [{key, done}], has_demo_products}`
`POST /api/dashboard/getting-started/dismiss`
`POST /api/dashboard/getting-started/demo-products` (idempotent)
`DELETE /api/dashboard/getting-started/demo-products`

All four sit inside the existing `active_subscription` + `owner_only` route group in `routes/api.php` (same block style as courier/staff settings routes).

## Files

**Backend:** migration `2026_08_22_170000_add_getting_started_columns.php` (`products.is_demo`, `shop_profiles.getting_started_dismissed_at`); `App\Models\Product`/`App\Models\ShopProfile` fillable+cast additions; `App\Http\Controllers\Api\DashboardGettingStartedController` (new); routes in `routes/api.php`; tests in `tests/Feature/DashboardGettingStartedTest.php` (8 tests — each step's derivation, staff 403, dismiss persistence, demo-product idempotency + storefront/order-bootstrap invisibility, demo-only deletion).

**Frontend:** `components/dashboard/getting-started-checklist.tsx` (new, "use client", plain-fetch convention matching `dashboard/page.tsx`/`onboarding/page.tsx` — no new client-lib abstraction for one component); wired into `app/dashboard/page.tsx` right after the welcome banner; `app/dashboard/products/page.tsx` gets a small "ডেমো"/"DEMO" badge on demo rows (`Product.is_demo` added to that page's local `Product` type — `ProductController::index()` has no column allowlist, so the field serializes automatically once cast on the model).

## Verification

Isolated pgsql-schema test run (8/8 new tests pass) + full suite (only the 3 known pre-existing baseline failures — `AuthApiTest`, `CourierFraudCheckApiTest`, `ProductMediaApiTest` — nothing new). `tsc --noEmit` clean. `deploy-safe.sh` 8/8. Live curl verification against production with a disposable test account (created + cleaned up via `php artisan tinker`, real seller accounts untouched): fresh shop → all 3 actionable steps false → demo-products create (3 created) → second call idempotent (0 created) → confirmed **absent** from both `https://{subdomain}.{apex}/api/public/storefront/products` and `/api/orders/create/bootstrap` → delete (3 deleted) → dismiss → refetch confirms `dismissed: true`. Frontend visual rendering was not separately browser-verified this pass (the component reuses the exact styling primitives — `catv-panel`, `var(--accent)`, badge patterns — already visually verified elsewhere in the same files); flag if a rendering issue turns up.
