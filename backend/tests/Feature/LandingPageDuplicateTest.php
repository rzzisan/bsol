<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LandingPageDuplicateTest extends TestCase
{
    use RefreshDatabase;

    private function seller(?int $maxLandingPages = null): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0,
            'duration_days' => 30, 'max_landing_pages' => $maxLandingPages, 'is_active' => true,
        ]);
        $owner = User::factory()->create(['subscription_package_id' => $package->id]);

        ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => 'dup-' . uniqid(), 'subdomain_status' => 'active',
        ]);

        return $owner;
    }

    private function publishedPageWithProduct(User $owner): LandingPage
    {
        $page = LandingPage::create([
            'user_id' => $owner->id, 'title' => 'Offer', 'slug' => 'offer',
            'status' => 'published', 'published_at' => now(),
            'admin_locked' => true, 'admin_lock_reason' => 'test',
            'content' => ['hero' => ['headline' => 'Big sale']],
            'theme_settings' => ['primary_color' => '#123456'],
            'custom_css' => '.x{color:red}',
        ]);
        $product = Product::create([
            'user_id' => $owner->id, 'name' => 'T-Shirt', 'sku' => 'TS-' . uniqid(),
            'selling_price' => 500, 'stock' => 10, 'track_stock' => true, 'status' => 'active',
        ]);
        LandingPageProduct::create([
            'landing_page_id' => $page->id, 'product_id' => $product->id,
            'badge_text' => 'Hot', 'price_override' => 450, 'sort_order' => 1,
        ]);

        return $page;
    }

    public function test_duplicate_copies_content_and_products_as_an_unlocked_draft(): void
    {
        $owner = $this->seller();
        $source = $this->publishedPageWithProduct($owner);
        Sanctum::actingAs($owner);

        $res = $this->postJson("/api/landing/pages/{$source->id}/duplicate")->assertCreated();

        $copy = LandingPage::with('products')->findOrFail($res->json('data.id'));
        $this->assertSame('Offer (copy)', $copy->title);
        $this->assertSame('offer-copy', $copy->slug);
        $this->assertSame('draft', $copy->status);
        $this->assertNull($copy->published_at);
        $this->assertFalse((bool) $copy->admin_locked);
        $this->assertSame('Big sale', $copy->content['hero']['headline']);
        $this->assertSame('#123456', $copy->theme_settings['primary_color']);
        $this->assertSame('.x{color:red}', $copy->custom_css);
        $this->assertCount(1, $copy->products);
        $this->assertSame('Hot', $copy->products[0]->badge_text);
        $this->assertCount(1, $source->fresh()->products, 'source keeps its products');
    }

    public function test_second_copy_gets_a_unique_slug(): void
    {
        $owner = $this->seller();
        $source = $this->publishedPageWithProduct($owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/landing/pages/{$source->id}/duplicate")->assertCreated();
        $second = $this->postJson("/api/landing/pages/{$source->id}/duplicate")->assertCreated();

        $this->assertSame('offer-copy-2', $second->json('data.slug'));
    }

    public function test_cannot_duplicate_another_shops_page(): void
    {
        $source = $this->publishedPageWithProduct($this->seller());
        Sanctum::actingAs($this->seller());

        $this->postJson("/api/landing/pages/{$source->id}/duplicate")->assertNotFound();
    }

    public function test_respects_the_landing_page_limit(): void
    {
        $owner = $this->seller(1);
        $source = $this->publishedPageWithProduct($owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/landing/pages/{$source->id}/duplicate")
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'landing_page_limit_reached');
    }
}
