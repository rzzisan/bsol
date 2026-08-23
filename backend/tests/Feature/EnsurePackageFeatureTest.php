<?php

namespace Tests\Feature;

use App\Models\ShopProfile;
use App\Models\StaffPermission;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * `package_feature:{key}` middleware — subscription_billing_context.md
 * §9.2-E. Default-allow (matches every other package-derived limit in this
 * codebase, e.g. max_orders/max_tracking_events_per_day: absent = no
 * restriction) — only an explicit `feature_flags[key] === false` blocks.
 * Exercised against the real gated routes (storefront-settings =>
 * `storefront`, facebook/pixel => `facebook`) rather than the middleware
 * class directly, so route wiring is covered too.
 */
class EnsurePackageFeatureTest extends TestCase
{
    use RefreshDatabase;

    private function packageWithFlags(?array $flags): SubscriptionPackage
    {
        return SubscriptionPackage::create([
            'name' => 'Test Package',
            'slug' => 'test-package-' . uniqid(),
            'price' => 100,
            'duration_days' => 30,
            'feature_flags' => $flags,
            'is_active' => true,
        ]);
    }

    public function test_no_package_at_all_is_allowed(): void
    {
        $owner = User::factory()->create(['subscription_package_id' => null]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/storefront-settings')->assertOk();
    }

    public function test_package_with_no_feature_flags_set_is_allowed(): void
    {
        $owner = User::factory()->create([
            'subscription_package_id' => $this->packageWithFlags(null)->id,
        ]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/storefront-settings')->assertOk();
    }

    public function test_explicit_false_blocks_with_upgrade_error_code(): void
    {
        $owner = User::factory()->create([
            'subscription_package_id' => $this->packageWithFlags(['storefront' => false])->id,
        ]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/storefront-settings')
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'feature_not_in_plan')
            ->assertJsonPath('feature', 'storefront');
    }

    public function test_explicit_true_is_allowed(): void
    {
        $owner = User::factory()->create([
            'subscription_package_id' => $this->packageWithFlags(['storefront' => true])->id,
        ]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/storefront-settings')->assertOk();
    }

    public function test_flags_are_per_key_not_all_or_nothing(): void
    {
        // storefront explicitly off, facebook untouched (still allowed).
        $owner = User::factory()->create([
            'subscription_package_id' => $this->packageWithFlags(['storefront' => false])->id,
        ]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/storefront-settings')->assertStatus(402);
        $this->getJson('/api/facebook/pixel')->assertOk();
    }

    public function test_staff_is_checked_against_the_owners_package_not_their_own(): void
    {
        $owner = User::factory()->create([
            'subscription_package_id' => $this->packageWithFlags(['facebook' => false])->id,
        ]);
        $staff = User::factory()->create(['owner_id' => $owner->id, 'role' => 'user', 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'facebook', 'enabled' => true]);

        Sanctum::actingAs($staff);

        // Staff has the module permission (Pattern A) but the shop's plan
        // has the feature switched off (Pattern C) — the plan gate wins.
        $this->getJson('/api/facebook/leads')
            ->assertStatus(402)
            ->assertJsonPath('feature', 'facebook');
    }

    public function test_public_storefront_home_is_locked_when_explicitly_disabled(): void
    {
        $apex = config('app.subdomain_apex');
        $owner = User::factory()->create([
            'subscription_package_id' => $this->packageWithFlags(['storefront' => false])->id,
        ]);
        ShopProfile::create([
            'user_id' => $owner->id,
            'shop_name' => 'Locked Shop',
            'phone' => '01711223344',
            'address' => 'Dhaka',
            'subdomain' => 'feature-gate-locked',
            'subdomain_status' => 'active',
        ]);

        $this->getJson("https://feature-gate-locked.{$apex}/api/public/storefront/home")
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'feature_not_in_plan');
    }

    public function test_public_storefront_home_is_open_when_untouched(): void
    {
        $apex = config('app.subdomain_apex');
        $owner = User::factory()->create();
        ShopProfile::create([
            'user_id' => $owner->id,
            'shop_name' => 'Open Shop',
            'phone' => '01711223344',
            'address' => 'Dhaka',
            'subdomain' => 'feature-gate-open',
            'subdomain_status' => 'active',
        ]);

        $this->getJson("https://feature-gate-open.{$apex}/api/public/storefront/home")
            ->assertOk();
    }
}
