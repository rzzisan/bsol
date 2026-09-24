<?php

namespace Tests\Feature;

use App\Models\Transaction;
use App\Models\Customer;
use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\Order;
use App\Models\PaymentGatewaySetting;
use App\Models\Product;
use App\Models\Scopes\HeldOrderScope;
use App\Models\ShopProfile;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Services\HeldOrderService;
use App\Services\SubscriptionActivationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Orders placed while the shop's subscription is expired are stored but
 * hidden from the seller until renewal — subscription_billing_context.md §13.
 */
class HeldOrdersTest extends TestCase
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

    private function shop(bool $expired): array
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 500, 'duration_days' => 30,
        ]);
        $owner = User::factory()->create([
            'subscription_package_id' => $package->id,
            'subscription_status' => $expired ? 'expired' : 'active',
            'subscription_ends_at' => $expired ? now()->subDays(2) : now()->addDays(20),
        ]);

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
            'slug' => 'tp-' . uniqid(), 'selling_price' => 500, 'stock' => 10, 'track_stock' => true,
            'status' => 'active', 'show_in_storefront' => true,
        ]);
        LandingPageProduct::create(['landing_page_id' => $page->id, 'product_id' => $product->id, 'sort_order' => 0]);

        return [$owner, $product];
    }

    private function placeLandingOrder(Product $product, array $extra = [])
    {
        return $this->postJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/order", array_merge([
            'customer_name' => 'Karim',
            'customer_phone' => '01712345678',
            'customer_address' => 'Dhanmondi, Dhaka',
            'items' => [['enabled' => true, 'product_id' => $product->id, 'quantity' => 1]],
        ], $extra));
    }

    private function heldOrder(): Order
    {
        return Order::withoutGlobalScope(HeldOrderScope::class)->firstOrFail();
    }

    public function test_order_from_a_shop_with_a_live_subscription_is_not_held(): void
    {
        [$owner, $product] = $this->shop(expired: false);

        $this->placeLandingOrder($product)->assertCreated();

        $this->assertNull($this->heldOrder()->held_at);
        $this->assertSame(1, Customer::where('user_id', $owner->id)->count());
    }

    public function test_expired_shop_stores_the_order_held_without_side_effects_and_forces_cod(): void
    {
        [$owner, $product] = $this->shop(expired: true);

        $response = $this->placeLandingOrder($product, ['payment_method' => 'sslcommerz'])->assertCreated();
        $this->assertSame('cod', $response->json('data.payment_method'));

        $order = $this->heldOrder();
        $this->assertNotNull($order->held_at);
        $this->assertSame('pending', $order->status);
        $this->assertSame(1, $order->items()->count());

        // None of the new-order bookkeeping ran, stock untouched.
        $this->assertSame(0, Customer::where('user_id', $owner->id)->count());
        $this->assertSame(0, Transaction::where('reference_id', $order->id)->count());
        $this->assertSame(10, $product->fresh()->stock);
        Queue::assertNothingPushed();
    }

    public function test_held_orders_are_hidden_from_the_seller_but_visible_to_the_customer(): void
    {
        [$owner, $product] = $this->shop(expired: true);
        $response = $this->placeLandingOrder($product)->assertCreated();
        $orderId = $response->json('data.order_id');
        $token = $response->json('data.public_token');

        // Customer thank-you page still works (public, unauthenticated).
        $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$orderId}?token={$token}")
            ->assertOk();

        Sanctum::actingAs($owner);
        $this->assertSame(0, Order::count());
        $this->getJson("/api/orders/{$orderId}")->assertNotFound();

        $me = $this->getJson('/api/subscription/me')->assertOk();
        $this->assertSame(1, $me->json('data.held_orders_count'));
        $this->assertNotNull($me->json('data.held_orders_expire_at'));
    }

    public function test_online_payment_is_offered_nowhere_while_expired(): void
    {
        [$owner, $product] = $this->shop(expired: true);
        PaymentGatewaySetting::create(['user_id' => $owner->id, 'bkash_personal_enabled' => true, 'bkash_personal_number' => '01711111111']);

        $data = $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/payment-channels")
            ->assertOk()->json('data');

        $this->assertSame([], $data['wallet_channels']);
        $this->assertSame([], $data['gateway_channels']);
        $this->assertTrue($data['cod_enabled']);
    }

    public function test_digital_orders_are_refused_while_expired(): void
    {
        [$owner, $product] = $this->shop(expired: true);
        $product->forceFill(['product_type' => Product::TYPE_DIGITAL])->save();

        $this->placeLandingOrder($product, ['payment_method' => 'bkash'])->assertStatus(422);
        $this->assertSame(0, Order::withoutGlobalScope(HeldOrderScope::class)->count());
    }

    public function test_storefront_order_is_held_too(): void
    {
        [$owner, $product] = $this->shop(expired: true);

        $this->postJson("https://shopa.{$this->apex()}/api/public/storefront/orders", [
            'customer_name' => 'Rahim',
            'customer_phone' => '01711112222',
            'customer_address' => 'House 1, Road 2, Dhaka',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $order = $this->heldOrder();
        $this->assertNotNull($order->held_at);
        $this->assertSame('storefront', $order->source);
        $this->assertSame(0, Customer::where('user_id', $owner->id)->count());
    }

    public function test_renewal_releases_recent_held_orders_and_replays_bookkeeping(): void
    {
        [$owner, $product] = $this->shop(expired: true);
        $this->placeLandingOrder($product)->assertCreated();

        $package = $owner->subscriptionPackage;
        $payment = SubscriptionPayment::create([
            'user_id' => $owner->id, 'package_id' => $package->id, 'amount' => 500,
            'payment_method' => 'gateway:test', 'status' => 'approved',
        ]);
        app(SubscriptionActivationService::class)->activate($payment);

        $order = $this->heldOrder();
        $this->assertNull($order->held_at);
        $this->assertSame(1, Customer::where('user_id', $owner->id)->count());
        $this->assertSame(1, Transaction::where('reference_id', $order->id)->count());

        Sanctum::actingAs($owner->fresh());
        $this->assertSame(1, Order::count());
        $this->assertSame(0, $this->getJson('/api/subscription/me')->json('data.held_orders_count'));
    }

    public function test_orders_older_than_the_window_are_not_released_and_get_purged(): void
    {
        [$owner, $product] = $this->shop(expired: true);
        $this->placeLandingOrder($product)->assertCreated();
        $order = $this->heldOrder();
        $order->forceFill(['held_at' => now()->subDays(HeldOrderService::WINDOW_DAYS + 1)])->save();

        $owner->update(['subscription_status' => 'active', 'subscription_ends_at' => now()->addDays(10)]);
        $service = app(HeldOrderService::class);

        $this->assertSame(0, $service->heldCount($owner->id));
        $this->assertSame(0, $service->release($owner));
        $this->assertNotNull($this->heldOrder()->held_at);

        $this->assertSame(1, $service->purgeExpired());
        $this->assertSame(0, Order::withoutGlobalScope(HeldOrderScope::class)->count());
    }

    public function test_mysubscription_releases_held_orders_once_the_plan_is_live_again(): void
    {
        [$owner, $product] = $this->shop(expired: true);
        $this->placeLandingOrder($product)->assertCreated();

        // Admin extends the dates directly, bypassing SubscriptionActivationService.
        $owner->update(['subscription_status' => 'active', 'subscription_ends_at' => now()->addDays(30)]);

        Sanctum::actingAs($owner->fresh());
        $this->getJson('/api/subscription/me')->assertOk();

        $this->assertNull($this->heldOrder()->held_at);
    }

    public function test_held_order_number_is_not_reused_by_a_manual_order_the_same_day(): void
    {
        [$owner, $product] = $this->shop(expired: true);
        $this->placeLandingOrder($product)->assertCreated();
        $heldNumber = $this->heldOrder()->order_number;

        Sanctum::actingAs($owner);
        $this->assertNotSame($heldNumber, Order::generateOrderNumber($owner->id));
    }
}
