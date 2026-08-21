<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductReview;
use App\Models\ShopProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * S7 of seller_storefront_context.md §5.3/§12 — storefront product
 * reviews (open submission, moderation gate).
 */
class StorefrontReviewTest extends TestCase
{
    use RefreshDatabase;

    private function apex(): string
    {
        return config('app.subdomain_apex');
    }

    private function seller(string $subdomain = 'shopa'): User
    {
        $user = User::factory()->create();

        ShopProfile::create([
            'user_id' => $user->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => $subdomain, 'subdomain_status' => 'active',
        ]);

        return $user;
    }

    private function product(User $owner, array $attrs = []): Product
    {
        return Product::create(array_merge([
            'user_id' => $owner->id,
            'name' => 'Test Product',
            'sku' => 'SKU-' . uniqid(),
            'slug' => 'test-product-' . uniqid(),
            'description' => 'A description.',
            'regular_price' => 500,
            'selling_price' => 500,
            'discount' => 0,
            'discount_type' => 'amount',
            'stock' => 10,
            'track_stock' => true,
            'status' => 'active',
            'show_in_storefront' => true,
        ], $attrs));
    }

    public function test_public_submission_creates_unapproved_review(): void
    {
        $owner = $this->seller();
        $product = $this->product($owner);

        $this->postJson("https://shopa.{$this->apex()}/api/public/storefront/products/{$product->slug}/reviews", [
            'customer_name' => 'Karim',
            'rating' => 5,
            'comment' => 'দারুণ প্রোডাক্ট!',
        ])->assertCreated();

        $review = ProductReview::where('product_id', $product->id)->firstOrFail();
        $this->assertFalse($review->is_approved);
        $this->assertSame($owner->id, $review->user_id);
    }

    public function test_rating_is_required_and_bounded(): void
    {
        $owner = $this->seller();
        $product = $this->product($owner);

        $this->postJson("https://shopa.{$this->apex()}/api/public/storefront/products/{$product->slug}/reviews", [
            'customer_name' => 'Karim',
        ])->assertStatus(422)->assertJsonValidationErrors(['rating']);

        $this->postJson("https://shopa.{$this->apex()}/api/public/storefront/products/{$product->slug}/reviews", [
            'customer_name' => 'Karim',
            'rating' => 6,
        ])->assertStatus(422)->assertJsonValidationErrors(['rating']);
    }

    public function test_unapproved_reviews_do_not_appear_on_the_public_product_page(): void
    {
        $owner = $this->seller();
        $product = $this->product($owner);

        ProductReview::create(['product_id' => $product->id, 'user_id' => $owner->id, 'customer_name' => 'Pending', 'rating' => 5, 'is_approved' => false]);
        ProductReview::create(['product_id' => $product->id, 'user_id' => $owner->id, 'customer_name' => 'Approved', 'rating' => 3, 'is_approved' => true]);

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/products/{$product->slug}")
            ->assertOk();

        $this->assertSame(1, $response->json('data.rating.count'));
        $this->assertEquals(3.0, $response->json('data.rating.average'));
        $this->assertCount(1, $response->json('data.reviews'));
        $this->assertSame('Approved', $response->json('data.reviews.0.customer_name'));
    }

    public function test_submitting_a_review_for_another_shops_product_is_not_found(): void
    {
        $ownerA = $this->seller('shopa');
        $this->seller('shopb');
        $product = $this->product($ownerA);

        $this->postJson("https://shopb.{$this->apex()}/api/public/storefront/products/{$product->slug}/reviews", [
            'customer_name' => 'Karim', 'rating' => 5,
        ])->assertNotFound();
    }

    public function test_owner_can_list_and_moderate_reviews(): void
    {
        $owner = $this->seller();
        $product = $this->product($owner);
        $review = ProductReview::create([
            'product_id' => $product->id, 'user_id' => $owner->id,
            'customer_name' => 'Karim', 'rating' => 4, 'is_approved' => false,
        ]);

        Sanctum::actingAs($owner);

        $this->getJson('/api/reviews')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->putJson("/api/reviews/{$review->id}", ['is_approved' => true])
            ->assertOk()
            ->assertJsonPath('data.is_approved', true);

        $this->getJson('/api/reviews?status=pending')->assertJsonCount(0, 'data');
        $this->getJson('/api/reviews?status=approved')->assertJsonCount(1, 'data');

        $this->deleteJson("/api/reviews/{$review->id}")->assertOk();
        $this->assertDatabaseMissing('product_reviews', ['id' => $review->id]);
    }

    public function test_owner_cannot_moderate_another_shops_review(): void
    {
        $ownerA = $this->seller('shopa');
        $ownerB = $this->seller('shopb');
        $productB = $this->product($ownerB);
        $review = ProductReview::create([
            'product_id' => $productB->id, 'user_id' => $ownerB->id,
            'customer_name' => 'Karim', 'rating' => 4, 'is_approved' => false,
        ]);

        Sanctum::actingAs($ownerA);

        $this->putJson("/api/reviews/{$review->id}", ['is_approved' => true])->assertNotFound();
    }

    public function test_moderation_requires_authentication(): void
    {
        $this->getJson('/api/reviews')->assertUnauthorized();
    }
}
