<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\Order;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * publicSubmitOrder() persisting fbp/fbc onto the created order
 * (tracking_capi_context.md §11.4) — checkout is same-origin on the
 * seller's own subdomain, so Meta's cookies are directly readable here.
 */
class LandingPageCheckoutTrackingTest extends TestCase
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

    private function shopWithPage(): array
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0, 'duration_days' => 30,
        ]);
        $owner = User::factory()->create(['subscription_package_id' => $package->id]);

        ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => 'shopa', 'subdomain_status' => 'active',
        ]);

        $page = LandingPage::create([
            'user_id' => $owner->id, 'title' => 'Offer', 'slug' => 'offer',
            'status' => 'published', 'published_at' => now(), 'content' => [],
        ]);

        $product = Product::create([
            'user_id' => $owner->id, 'name' => 'Test Product', 'sku' => 'TP-' . uniqid(),
            'selling_price' => 500, 'stock' => 100, 'track_stock' => false, 'status' => 'active',
        ]);

        LandingPageProduct::create([
            'landing_page_id' => $page->id, 'product_id' => $product->id, 'sort_order' => 0,
        ]);

        return [$owner, $page, $product];
    }

    private function checkoutPayload(int $productId): array
    {
        return [
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'customer_address' => 'Dhanmondi, Dhaka',
            'items' => [
                ['enabled' => true, 'product_id' => $productId, 'quantity' => 1],
            ],
        ];
    }

    public function test_checkout_persists_fbp_and_fbc_cookies_onto_the_order(): void
    {
        [, $page, $product] = $this->shopWithPage();

        // Real _fbp/_fbc cookies are plain-text, set directly by Meta's own
        // script via document.cookie — never routed through Laravel's
        // encrypted cookie jar, and the api group has no EncryptCookies
        // middleware to decrypt one anyway. withCredentials() is needed too:
        // postJson()'s underlying json() call omits cookies entirely unless
        // it's set, mirroring a real XHR's credentials:'include' behavior.
        $response = $this->withCredentials()
            ->withUnencryptedCookie('_fbp', 'fb.1.1700000000000.111')
            ->withUnencryptedCookie('_fbc', 'fb.1.1700000000000.222')
            ->postJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/order", $this->checkoutPayload($product->id));

        $response->assertCreated();

        $order = Order::findOrFail($response->json('data.order_id'));
        $this->assertSame('fb.1.1700000000000.111', $order->fbp);
        $this->assertSame('fb.1.1700000000000.222', $order->fbc);
    }

    public function test_checkout_without_cookies_leaves_fbp_and_fbc_null(): void
    {
        [, $page, $product] = $this->shopWithPage();

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/order",
            $this->checkoutPayload($product->id)
        );

        $response->assertCreated();

        $order = Order::findOrFail($response->json('data.order_id'));
        $this->assertNull($order->fbp);
        $this->assertNull($order->fbc);
    }
}
