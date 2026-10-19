<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\LandingPageRevision;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LandingPageRevisionTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function seller(): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0,
            'duration_days' => 30, 'is_active' => true,
        ]);
        $owner = User::factory()->create(['subscription_package_id' => $package->id]);
        ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => 'rev-' . uniqid(), 'subdomain_status' => 'active',
        ]);

        return $owner;
    }

    private function pageWithProduct(User $owner): array
    {
        $page = LandingPage::create([
            'user_id' => $owner->id, 'title' => 'Offer', 'slug' => 'offer', 'status' => 'published',
            'published_at' => now(), 'content' => ['hero' => ['headline' => 'First']],
        ]);
        $product = Product::create([
            'user_id' => $owner->id, 'name' => 'T-Shirt', 'sku' => 'TS-' . uniqid(),
            'selling_price' => 500, 'stock' => 10, 'track_stock' => true, 'status' => 'active',
        ]);
        LandingPageProduct::create([
            'landing_page_id' => $page->id, 'product_id' => $product->id, 'badge_text' => 'Hot', 'sort_order' => 1,
        ]);

        return [$page, $product];
    }

    private function save(LandingPage $page, string $headline, array $products = []): void
    {
        $this->putJson("/api/landing/pages/{$page->id}", [
            'title' => 'Offer',
            'content' => ['hero' => ['headline' => $headline]],
            'products' => $products,
        ])->assertOk();
    }

    public function test_save_stores_the_previous_state(): void
    {
        $owner = $this->seller();
        [$page] = $this->pageWithProduct($owner);
        Sanctum::actingAs($owner);

        $this->save($page, 'Second');

        $revision = LandingPageRevision::where('landing_page_id', $page->id)->sole();
        $this->assertSame('First', $revision->content['hero']['headline']);
        $this->assertSame('Hot', $revision->products[0]['badge_text']);
        $this->assertSame($owner->id, $revision->user_id);
    }

    public function test_saves_close_together_keep_one_snapshot(): void
    {
        $owner = $this->seller();
        [$page] = $this->pageWithProduct($owner);
        Sanctum::actingAs($owner);

        $this->save($page, 'Second');
        $this->save($page, 'Third');
        $this->assertSame(1, LandingPageRevision::count());

        Carbon::setTestNow(now()->addMinutes(3));
        $this->save($page, 'Fourth');
        $this->assertSame(2, LandingPageRevision::count());
        $this->assertSame('Third', LandingPageRevision::latest('id')->first()->content['hero']['headline']);
    }

    public function test_unchanged_page_is_not_stored_twice(): void
    {
        $owner = $this->seller();
        [$page] = $this->pageWithProduct($owner);
        LandingPageRevision::snapshot($page, $owner->id, force: true);

        $this->assertNull(LandingPageRevision::snapshot($page->fresh(), $owner->id, force: true));
        $this->assertSame(1, LandingPageRevision::count());
    }

    public function test_only_the_newest_revisions_are_kept(): void
    {
        $owner = $this->seller();
        [$page] = $this->pageWithProduct($owner);

        for ($i = 0; $i < LandingPageRevision::KEEP + 5; $i++) {
            $page->update(['content' => ['hero' => ['headline' => "v{$i}"]]]);
            LandingPageRevision::snapshot($page, $owner->id, force: true);
        }

        $this->assertSame(LandingPageRevision::KEEP, LandingPageRevision::count());
        $this->assertSame('v5', LandingPageRevision::orderBy('id')->first()->content['hero']['headline']);
    }

    public function test_restore_brings_back_content_and_products_and_keeps_status(): void
    {
        $owner = $this->seller();
        [$page, $product] = $this->pageWithProduct($owner);
        Sanctum::actingAs($owner);

        $this->save($page, 'Second', []);
        $this->assertCount(0, $page->fresh()->products);
        $revision = LandingPageRevision::sole();

        $res = $this->postJson("/api/landing/pages/{$page->id}/revisions/{$revision->id}/restore")->assertOk();

        $page->refresh()->load('products');
        $this->assertSame('First', $page->content['hero']['headline']);
        $this->assertSame('published', $page->status);
        $this->assertCount(1, $page->products);
        $this->assertSame($product->id, $page->products[0]->product_id);
        $this->assertSame('Hot', $page->products[0]->badge_text);
        $this->assertSame('First', $res->json('data.content.hero.headline'));

        // The state before the restore was stored, so the restore can be undone.
        $this->assertSame('Second', LandingPageRevision::latest('id')->first()->content['hero']['headline']);
    }

    public function test_list_shows_newest_first_without_bodies(): void
    {
        $owner = $this->seller();
        [$page] = $this->pageWithProduct($owner);
        Sanctum::actingAs($owner);

        $this->save($page, 'Second');
        Carbon::setTestNow(now()->addMinutes(3));
        $this->save($page, 'Third');

        $res = $this->getJson("/api/landing/pages/{$page->id}/revisions")->assertOk();
        $this->assertCount(2, $res->json('data'));
        $this->assertGreaterThan($res->json('data.1.id'), $res->json('data.0.id'));
        $this->assertArrayNotHasKey('content', $res->json('data.0'));
        $this->assertSame($owner->name, $res->json('data.0.user_name'));
    }

    public function test_another_shop_cannot_list_or_restore(): void
    {
        $owner = $this->seller();
        [$page] = $this->pageWithProduct($owner);
        $revision = LandingPageRevision::snapshot($page, $owner->id, force: true);

        Sanctum::actingAs($this->seller());
        $this->getJson("/api/landing/pages/{$page->id}/revisions")->assertNotFound();
        $this->postJson("/api/landing/pages/{$page->id}/revisions/{$revision->id}/restore")->assertNotFound();
    }

    public function test_revision_of_another_page_cannot_be_restored(): void
    {
        $owner = $this->seller();
        [$page] = $this->pageWithProduct($owner);
        $other = LandingPage::create(['user_id' => $owner->id, 'title' => 'Other', 'slug' => 'other', 'status' => 'draft']);
        $revision = LandingPageRevision::snapshot($other, $owner->id, force: true);
        Sanctum::actingAs($owner);

        $this->postJson("/api/landing/pages/{$page->id}/revisions/{$revision->id}/restore")->assertNotFound();
    }
}
