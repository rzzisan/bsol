<?php

namespace Tests\Feature;

use App\Models\AddonPackage;
use App\Models\AddonPurchase;
use App\Models\ShopProfile;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Services\AddonApplyService;
use App\Services\StorefrontAddonService;
use App\Services\SubscriptionActivationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Storefront add-on — subscription_billing_context.md §9.2-D, §9.6 step 4.
 * Binary unlock, co-terminous with the main subscription cycle.
 */
class StorefrontAddonTest extends TestCase
{
    use RefreshDatabase;

    private function storefrontPackage(array $overrides = []): AddonPackage
    {
        return AddonPackage::create(array_merge([
            'type' => 'storefront', 'name' => 'Unlock Storefront', 'price' => 100, 'is_active' => true,
        ], $overrides));
    }

    private function planExcludingStorefront(): SubscriptionPackage
    {
        return SubscriptionPackage::create([
            'name' => 'Small', 'slug' => 'small-' . uniqid(), 'price' => 100, 'duration_days' => 30,
            'feature_flags' => ['storefront' => false], 'is_active' => true,
        ]);
    }

    // ── Service ──────────────────────────────────────────────────────────

    public function test_no_addon_purchased_is_not_active(): void
    {
        $owner = User::factory()->create();
        $this->assertFalse(app(StorefrontAddonService::class)->hasActiveAddon($owner));
    }

    public function test_activate_anchors_to_subscription_ends_at_when_present(): void
    {
        $endsAt = now()->addDays(20);
        $owner = User::factory()->create(['subscription_ends_at' => $endsAt]);

        app(StorefrontAddonService::class)->activate($owner);

        // Second-precision compare — the timestamp column round-trip drops
        // sub-second precision that the in-memory $endsAt still carries.
        $this->assertSame($endsAt->format('Y-m-d H:i:s'), $owner->fresh()->storefront_addon_until->format('Y-m-d H:i:s'));
        $this->assertTrue(app(StorefrontAddonService::class)->hasActiveAddon($owner->fresh()));
    }

    public function test_activate_falls_back_to_30_days_with_no_active_subscription(): void
    {
        $owner = User::factory()->create(['subscription_ends_at' => null]);

        app(StorefrontAddonService::class)->activate($owner);

        $until = $owner->fresh()->storefront_addon_until;
        $this->assertNotNull($until);
        $this->assertTrue($until->between(now()->addDays(29), now()->addDays(31)));
    }

    public function test_extend_to_match_is_a_noop_when_never_purchased(): void
    {
        $owner = User::factory()->create();
        app(StorefrontAddonService::class)->extendToMatchIfActive($owner, now()->addDays(60));
        $this->assertNull($owner->fresh()->storefront_addon_until);
    }

    public function test_extend_to_match_is_a_noop_once_lapsed(): void
    {
        $owner = User::factory()->create(['storefront_addon_until' => now()->subDay()]);
        app(StorefrontAddonService::class)->extendToMatchIfActive($owner, now()->addDays(60));
        // Still the lapsed date — a renewal never silently revives it.
        $this->assertTrue($owner->fresh()->storefront_addon_until->isPast());
    }

    public function test_extend_to_match_extends_an_active_addon(): void
    {
        $owner = User::factory()->create(['storefront_addon_until' => now()->addDays(5)]);
        $newEnd = now()->addDays(60);

        app(StorefrontAddonService::class)->extendToMatchIfActive($owner, $newEnd);

        $this->assertSame($newEnd->format('Y-m-d H:i:s'), $owner->fresh()->storefront_addon_until->format('Y-m-d H:i:s'));
    }

    // ── Co-terminous with subscription renewal ──────────────────────────

    public function test_subscription_renewal_keeps_an_active_addon_in_sync(): void
    {
        $package = SubscriptionPackage::create([
            'name' => 'Growth', 'slug' => 'growth-' . uniqid(), 'price' => 500, 'duration_days' => 30, 'is_active' => true,
        ]);
        $owner = User::factory()->create([
            'subscription_package_id' => $package->id,
            'subscription_ends_at' => now()->addDays(3),
            'storefront_addon_until' => now()->addDays(3),
        ]);

        $payment = SubscriptionPayment::create([
            'user_id' => $owner->id, 'package_id' => $package->id, 'amount' => 500,
            'payment_method' => 'bkash_manual', 'status' => 'approved',
        ]);

        app(SubscriptionActivationService::class)->activate($payment);

        // Renewal extends subscription_ends_at by 30 days from the old
        // ends_at (still future) — the addon must land on the same date.
        $owner = $owner->fresh();
        $this->assertTrue($owner->storefront_addon_until->equalTo($owner->subscription_ends_at));
    }

    // ── AddonApplyService ────────────────────────────────────────────────

    public function test_apply_service_activates_the_storefront_addon(): void
    {
        $package = $this->storefrontPackage();
        $owner = User::factory()->create(['subscription_ends_at' => now()->addDays(10)]);
        $purchase = AddonPurchase::create([
            'user_id' => $owner->id, 'addon_package_id' => $package->id,
            'amount' => 100, 'trx_id' => 'SFADDON1', 'status' => 'approved',
        ]);

        app(AddonApplyService::class)->apply($purchase);

        $this->assertTrue(app(StorefrontAddonService::class)->hasActiveAddon($owner->fresh()));
        $this->assertNotNull($purchase->fresh()->applied_at);
    }

    // ── Feature-gate override ───────────────────────────────────────────

    public function test_package_feature_middleware_allows_when_addon_active_despite_plan_excluding_it(): void
    {
        $plan = $this->planExcludingStorefront();
        $owner = User::factory()->create([
            'subscription_package_id' => $plan->id,
            'storefront_addon_until' => now()->addDays(10),
        ]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/storefront-settings')->assertOk();
    }

    public function test_package_feature_middleware_still_blocks_when_addon_lapsed(): void
    {
        $plan = $this->planExcludingStorefront();
        $owner = User::factory()->create([
            'subscription_package_id' => $plan->id,
            'storefront_addon_until' => now()->subDay(),
        ]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/storefront-settings')->assertStatus(402);
    }

    public function test_public_storefront_home_is_open_when_addon_active_despite_plan(): void
    {
        $apex = config('app.subdomain_apex');
        $plan = $this->planExcludingStorefront();
        $owner = User::factory()->create([
            'subscription_package_id' => $plan->id,
            'storefront_addon_until' => now()->addDays(10),
        ]);
        ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Addon Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => 'storefront-addon-open', 'subdomain_status' => 'active',
        ]);

        $this->getJson("https://storefront-addon-open.{$apex}/api/public/storefront/home")->assertOk();
    }

    // ── Admin package creation ──────────────────────────────────────────

    public function test_admin_can_create_a_storefront_package_without_quantity_or_duration(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson('/api/admin/addon-packages', [
            'type' => 'storefront', 'name' => 'Unlock Storefront', 'price' => 100,
        ])->assertCreated()->assertJsonPath('package.type', 'storefront');
    }
}
