<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\ShopProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * D5 — landing pages served from the seller's own subdomain, with slugs
 * scoped per shop (custom_domain_context.md §11.9).
 */
class LandingPageSubdomainTest extends TestCase
{
    use RefreshDatabase;

    private function apex(): string
    {
        return config('app.subdomain_apex');
    }

    private function seller(string $subdomain, string $shopName = 'Shop'): User
    {
        $user = User::factory()->create();

        ShopProfile::create([
            'user_id' => $user->id,
            'shop_name' => $shopName,
            'phone' => '01711223344',
            'address' => 'Dhaka',
            'subdomain' => $subdomain,
            'subdomain_status' => 'active',
        ]);

        return $user;
    }

    private function page(User $owner, string $slug, array $attrs = []): LandingPage
    {
        // legacy_slug is deliberately not fillable — the migration backfills
        // it once and application code never writes it — so a test that
        // needs one has to set it explicitly.
        $legacy = $attrs['legacy_slug'] ?? null;
        unset($attrs['legacy_slug']);

        $page = LandingPage::create(array_merge([
            'user_id' => $owner->id,
            'title' => ucfirst($slug),
            'slug' => $slug,
            'status' => 'published',
            'published_at' => now(),
            'content' => [],
        ], $attrs));

        if ($legacy !== null) {
            $page->forceFill(['legacy_slug' => $legacy])->save();
        }

        return $page;
    }

    /**
     * The whole point of scoping slugs: two shops can both advertise /offer
     * because they are on different hosts.
     */
    public function test_two_shops_can_use_the_same_slug_and_resolve_separately(): void
    {
        $a = $this->seller('shopa', 'Shop A');
        $b = $this->seller('shopb', 'Shop B');

        $pageA = $this->page($a, 'offer', ['title' => 'A Offer']);
        $pageB = $this->page($b, 'offer', ['title' => 'B Offer']);

        $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer")
            ->assertOk()
            ->assertJsonPath('data.id', $pageA->id)
            ->assertJsonPath('data.title', 'A Offer');

        $this->getJson("https://shopb.{$this->apex()}/api/public/landing-pages/offer")
            ->assertOk()
            ->assertJsonPath('data.id', $pageB->id)
            ->assertJsonPath('data.title', 'B Offer');
    }

    public function test_public_url_points_at_the_sellers_subdomain(): void
    {
        $owner = $this->seller('zareen');
        $this->page($owner, 'watch');

        $this->getJson("https://zareen.{$this->apex()}/api/public/landing-pages/watch")
            ->assertOk()
            ->assertJsonPath('data.public_url', "https://zareen.{$this->apex()}/watch");
    }

    /**
     * Pages that predate subdomains keep their platform URL working — those
     * links are live in real campaigns.
     */
    public function test_legacy_lp_url_still_resolves_on_the_platform_host(): void
    {
        $owner = $this->seller('zareen');
        $this->page($owner, 'headphone', ['legacy_slug' => 'headphone']);

        $this->getJson("https://bsol.{$this->apex()}/api/public/landing-pages/headphone")
            ->assertOk()
            ->assertJsonPath('data.slug', 'headphone');
    }

    public function test_a_page_without_a_legacy_slug_is_not_reachable_on_the_platform_host(): void
    {
        $owner = $this->seller('zareen');
        $this->page($owner, 'newoffer');

        $this->getJson("https://bsol.{$this->apex()}/api/public/landing-pages/newoffer")
            ->assertStatus(404);
    }

    /**
     * An unclaimed subdomain must not fall back to the legacy lookup, or it
     * would serve another seller's page.
     */
    public function test_unknown_subdomain_does_not_fall_through_to_legacy_pages(): void
    {
        $owner = $this->seller('zareen');
        $this->page($owner, 'headphone', ['legacy_slug' => 'headphone']);

        $this->getJson("https://nobody.{$this->apex()}/api/public/landing-pages/headphone")
            ->assertStatus(404);
    }

    public function test_a_shops_page_is_not_reachable_from_another_shops_subdomain(): void
    {
        $a = $this->seller('shopa');
        $this->seller('shopb');
        $this->page($a, 'secret');

        $this->getJson("https://shopb.{$this->apex()}/api/public/landing-pages/secret")
            ->assertStatus(404);
    }

    public function test_publishing_requires_a_subdomain(): void
    {
        $owner = User::factory()->create();
        ShopProfile::create([
            'user_id' => $owner->id,
            'shop_name' => 'No Subdomain', 'phone' => '01700000000', 'address' => 'Dhaka',
        ]);
        Sanctum::actingAs($owner);

        $this->postJson('/api/landing/pages', ['title' => 'Promo', 'status' => 'published'])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'subdomain_required');

        // A draft is still fine — the seller can build before choosing an address.
        $this->postJson('/api/landing/pages', ['title' => 'Promo', 'status' => 'draft'])
            ->assertCreated();
    }

    public function test_publishing_succeeds_once_a_subdomain_exists(): void
    {
        $owner = $this->seller('zareen');
        Sanctum::actingAs($owner);

        $created = $this->postJson('/api/landing/pages', ['title' => 'Promo', 'status' => 'draft'])
            ->assertCreated()
            ->json('data.id');

        $this->postJson("/api/landing/pages/{$created}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', 'published');
    }

    public function test_publish_endpoint_is_blocked_without_a_subdomain(): void
    {
        $owner = User::factory()->create();
        ShopProfile::create([
            'user_id' => $owner->id,
            'shop_name' => 'No Subdomain', 'phone' => '01700000000', 'address' => 'Dhaka',
        ]);
        Sanctum::actingAs($owner);

        $page = $this->page($owner, 'draftpage', ['status' => 'draft', 'published_at' => null]);

        $this->postJson("/api/landing/pages/{$page->id}/publish")
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'subdomain_required');
    }

    /**
     * Slug auto-suffixing is shop-scoped: a collision inside one shop still
     * gets renamed, but another shop's identical slug must not trigger it.
     */
    public function test_slug_collision_only_suffixes_within_the_same_shop(): void
    {
        $a = $this->seller('shopa');
        $b = $this->seller('shopb');
        $this->page($a, 'offer');

        Sanctum::actingAs($b);
        $this->postJson('/api/landing/pages', ['title' => 'Offer', 'slug' => 'offer', 'status' => 'draft'])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'offer');

        Sanctum::actingAs($a);
        $this->postJson('/api/landing/pages', ['title' => 'Offer', 'slug' => 'offer', 'status' => 'draft'])
            ->assertStatus(422);
    }
}
