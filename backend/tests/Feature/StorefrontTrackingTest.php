<?php

namespace Tests\Feature;

use App\Jobs\SendFacebookCapiPurchaseEventJob;
use App\Models\Order;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\TrackingDestination;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * S9 of seller_storefront_context.md §8/§12 — storefront tracking
 * (Pixel + CAPI), reusing the existing tracking pipeline: home() exposes
 * the shop-wide TrackingDestination the same shape a landing page's
 * `tracking` field already has, and checkout dispatches the same
 * SendFacebookCapiPurchaseEventJob landing-page checkout uses (it was
 * already source-agnostic under the hood).
 */
class StorefrontTrackingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

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

    private function product(User $owner): Product
    {
        return Product::create([
            'user_id' => $owner->id, 'name' => 'Test Product', 'sku' => 'SKU-' . uniqid(),
            'slug' => 'test-product-' . uniqid(), 'description' => 'A description.',
            'regular_price' => 500, 'selling_price' => 500, 'discount' => 0, 'discount_type' => 'amount',
            'stock' => 10, 'track_stock' => true, 'status' => 'active', 'show_in_storefront' => true,
        ]);
    }

    public function test_home_reports_tracking_disabled_when_no_destination_configured(): void
    {
        $this->seller();

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/home")
            ->assertOk()
            ->assertJsonPath('data.tracking.enabled', false)
            ->assertJsonPath('data.tracking.pixel_id', null);
    }

    public function test_home_reports_tracking_enabled_with_pixel_id_when_a_shop_wide_destination_exists(): void
    {
        $owner = $this->seller();
        TrackingDestination::create([
            'user_id' => $owner->id, 'label' => 'Main', 'pixel_id' => '1234567890', 'access_token' => 'tok', 'enabled' => true,
        ]);

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/home")
            ->assertOk()
            ->assertJsonPath('data.tracking.enabled', true)
            ->assertJsonPath('data.tracking.pixel_id', '1234567890');
    }

    public function test_checkout_dispatches_the_purchase_capi_job_and_persists_fbp_fbc(): void
    {
        $owner = $this->seller();
        $product = $this->product($owner);

        $response = $this->withCredentials()
            ->withUnencryptedCookie('_fbp', 'fb.1.111.222')
            ->withUnencryptedCookie('_fbc', 'fb.1.111.333')
            ->postJson("https://shopa.{$this->apex()}/api/public/storefront/orders", [
                'customer_name' => 'Karim Uddin',
                'customer_phone' => '01712345678',
                'customer_address' => 'Dhanmondi, Dhaka',
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
            ])->assertCreated();

        $order = Order::where('order_number', $response->json('data.order_number'))->firstOrFail();

        $this->assertSame('fb.1.111.222', $order->fbp);
        $this->assertSame('fb.1.111.333', $order->fbc);

        Queue::assertPushed(SendFacebookCapiPurchaseEventJob::class, 1);
    }

    public function test_order_lookup_exposes_id_and_product_id_for_the_purchase_event(): void
    {
        $owner = $this->seller();
        $product = $this->product($owner);

        $submit = $this->postJson("https://shopa.{$this->apex()}/api/public/storefront/orders", [
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'customer_address' => 'Dhanmondi, Dhaka',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $token = $submit->json('data.public_token');

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/orders/{$token}")
            ->assertOk()
            ->assertJsonPath('data.items.0.product_id', $product->id);

        $this->assertIsInt($response->json('data.id'));
    }
}
