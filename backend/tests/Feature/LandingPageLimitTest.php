<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\ShopProfile;
use App\Models\StaffPermission;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Package-based landing page cap — subscription_billing_context.md §9.6
 * step 5 (simplified per user's direction, 2026-08-23: flat total-count
 * limit, no add-on). `null = unlimited`, same convention as max_orders.
 */
class LandingPageLimitTest extends TestCase
{
    use RefreshDatabase;

    private function sellerWithLimit(?int $maxLandingPages): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0,
            'duration_days' => 30, 'max_landing_pages' => $maxLandingPages, 'is_active' => true,
        ]);
        $owner = User::factory()->create(['subscription_package_id' => $package->id]);

        ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => 'limit-test-' . uniqid(), 'subdomain_status' => 'active',
        ]);

        return $owner;
    }

    private function page(User $owner, array $overrides = []): LandingPage
    {
        return LandingPage::create(array_merge([
            'user_id' => $owner->id,
            'title' => 'Page ' . uniqid(),
            'slug' => 'page-' . uniqid(),
            'status' => 'draft',
            'content' => [],
        ], $overrides));
    }

    public function test_creation_is_unlimited_when_max_is_null(): void
    {
        $owner = $this->sellerWithLimit(null);
        for ($i = 0; $i < 3; $i++) {
            $this->page($owner);
        }
        Sanctum::actingAs($owner);

        $this->postJson('/api/landing/pages', ['title' => 'One more'])->assertCreated();
    }

    public function test_blocks_creation_once_the_total_count_reaches_the_limit(): void
    {
        $owner = $this->sellerWithLimit(2);
        $this->page($owner);
        $this->page($owner, ['status' => 'published', 'published_at' => now()]);
        Sanctum::actingAs($owner);

        $this->postJson('/api/landing/pages', ['title' => 'Third page'])
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'landing_page_limit_reached');
    }

    public function test_draft_and_published_are_counted_together(): void
    {
        $owner = $this->sellerWithLimit(1);
        $this->page($owner, ['status' => 'draft']); // one draft already fills a limit of 1
        Sanctum::actingAs($owner);

        $this->postJson('/api/landing/pages', ['title' => 'Blocked'])->assertStatus(402);
    }

    public function test_deleting_a_page_frees_up_a_slot(): void
    {
        $owner = $this->sellerWithLimit(1);
        $page = $this->page($owner);
        Sanctum::actingAs($owner);

        $this->postJson('/api/landing/pages', ['title' => 'Blocked'])->assertStatus(402);

        $page->delete(); // soft delete
        $this->postJson('/api/landing/pages', ['title' => 'Now allowed'])->assertCreated();
    }

    public function test_limit_is_shop_wide_across_staff(): void
    {
        $owner = $this->sellerWithLimit(1);
        $this->page($owner);
        $staff = User::factory()->create(['owner_id' => $owner->id, 'role' => 'user', 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'landing_pages', 'enabled' => true]);
        Sanctum::actingAs($staff);

        $this->postJson('/api/landing/pages', ['title' => 'Blocked'])->assertStatus(402);
    }

    public function test_existing_sellers_over_the_new_limit_are_never_retroactively_touched(): void
    {
        // A seller who already has 4 pages, whose package now caps at 2 —
        // none of the existing 4 are deleted/unpublished; only new
        // creation is blocked going forward.
        $owner = $this->sellerWithLimit(2);
        for ($i = 0; $i < 4; $i++) {
            $this->page($owner, ['status' => 'published', 'published_at' => now()]);
        }

        $this->assertSame(4, LandingPage::where('user_id', $owner->id)->count());
        $this->assertSame(4, LandingPage::where('user_id', $owner->id)->where('status', 'published')->count());

        Sanctum::actingAs($owner);
        $this->postJson('/api/landing/pages', ['title' => 'Blocked'])->assertStatus(402);
    }

    public function test_admin_can_set_the_limit_on_a_package(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $res = $this->postJson('/api/admin/packages', [
            'name' => 'Small', 'price' => 100, 'duration_days' => 30, 'max_landing_pages' => 5,
        ])->assertCreated();

        $this->assertSame(5, $res->json('package.max_landing_pages'));
    }
}
