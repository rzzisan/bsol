<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\Order;
use App\Models\OrderOnlinePayment;
use App\Models\PaymentGatewayCredential;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Phase B — gateway_auto (SSLCommerz as the reference implementation of the
 * provider abstraction). See online_payment_context.md.
 */
class OnlinePaymentGatewayTest extends TestCase
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

    private function enableSslcommerz(User $owner): void
    {
        PaymentGatewayCredential::create([
            'user_id' => $owner->id,
            'provider' => 'sslcommerz',
            'enabled' => true,
            'is_live' => false,
            'credentials' => ['store_id' => 'testbox', 'store_password' => 'qwerty'],
        ]);
    }

    private function createOrder(int $productId): Order
    {
        $response = $this->postJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/order", [
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'customer_address' => 'Dhanmondi, Dhaka',
            'items' => [['enabled' => true, 'product_id' => $productId, 'quantity' => 1]],
        ]);
        $response->assertCreated();

        return Order::findOrFail($response->json('data.order_id'));
    }

    public function test_payment_channels_endpoint_lists_configured_gateway(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableSslcommerz($owner);

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/payment-channels");

        $response->assertOk();
        $providers = collect($response->json('data.gateway_channels'))->pluck('provider')->all();
        $this->assertSame(['sslcommerz'], $providers);
    }

    public function test_a_credential_row_with_no_store_id_does_not_appear_as_available(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        PaymentGatewayCredential::create([
            'user_id' => $owner->id, 'provider' => 'sslcommerz', 'enabled' => true,
            'credentials' => ['store_id' => '', 'store_password' => ''],
        ]);

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/payment-channels");

        $this->assertSame([], $response->json('data.gateway_channels'));
    }

    public function test_initiate_gateway_creates_initiated_row_and_returns_redirect_url(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableSslcommerz($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            '*/gwprocess/v4/api.php' => Http::response([
                'status' => 'SUCCESS',
                'sessionkey' => 'SESSION123',
                'GatewayPageURL' => 'https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=PAY&SESSIONKEY=SESSION123',
            ]),
        ]);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'sslcommerz']
        );

        $response->assertOk();
        $this->assertStringContainsString('sandbox.sslcommerz.com', $response->json('data.redirect_url'));

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('gateway_auto', $claim->channel_type);
        $this->assertSame('sslcommerz', $claim->provider);
        $this->assertSame('initiated', $claim->status);
        $this->assertNotNull($claim->provider_payment_id);
        $this->assertEquals(580.0, (float) $claim->amount); // 500 product + 80 default shipping
    }

    public function test_callback_with_a_validated_val_id_completes_and_cascades(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableSslcommerz($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            '*/gwprocess/v4/api.php' => Http::response([
                'status' => 'SUCCESS', 'sessionkey' => 'SESSION123',
                'GatewayPageURL' => 'https://sandbox.sslcommerz.com/gw.php?Q=PAY',
            ]),
            '*/validator/api/validationserverAPI.php*' => Http::response([
                'status' => 'VALID', 'tran_id' => null, // set per-request below
                'amount' => '580.00', 'bank_tran_id' => 'BANK123',
            ]),
        ]);

        $initiate = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'sslcommerz']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $merchantTranId = $claim->provider_payment_id;

        // Re-fake with the real tran_id now known, so the client's own
        // tran_id-match check (amount-tampering guard) passes.
        Http::fake([
            '*/validator/api/validationserverAPI.php*' => Http::response([
                'status' => 'VALID', 'tran_id' => $merchantTranId,
                'amount' => '580.00', 'bank_tran_id' => 'BANK123',
            ]),
        ]);

        $callback = $this->get("/api/online-payment/sslcommerz/callback/{$claim->id}?val_id=VAL123&status=VALID&tran_id={$merchantTranId}");
        $callback->assertRedirect();
        $this->assertStringContainsString('payment_result=success', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);
        $this->assertEquals(580.0, $order->paidAmount());

        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id, 'source' => 'online_gateway', 'method' => 'sslcommerz',
        ]);
        $this->assertDatabaseHas('transactions', [
            'reference_type' => 'order_payment', 'category' => 'order_online_payment',
        ]);

        $claim->refresh();
        $this->assertSame('completed', $claim->status);
        $this->assertNotNull($claim->order_payment_id);
    }

    public function test_callback_claiming_success_without_a_val_id_is_not_trusted(): void
    {
        // Simulates a spoofed/incomplete redirect — status=VALID in the URL
        // but no val_id at all, so there is nothing to validate server-side.
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableSslcommerz($owner);
        $order = $this->createOrder($product->id);

        Http::fake(['*/gwprocess/v4/api.php' => Http::response([
            'status' => 'SUCCESS', 'sessionkey' => 'S', 'GatewayPageURL' => 'https://x/gw.php',
        ])]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'sslcommerz']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();

        $callback = $this->get("/api/online-payment/sslcommerz/callback/{$claim->id}?status=VALID");
        $this->assertStringContainsString('payment_result=failed', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('pending', $order->status);
        $this->assertSame('due', $order->payment_status);
        $this->assertDatabaseMissing('order_payments', ['order_id' => $order->id]);

        $claim->refresh();
        $this->assertSame('failed', $claim->status);
    }

    public function test_a_second_callback_for_an_already_completed_claim_is_a_no_op(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableSslcommerz($owner);
        $order = $this->createOrder($product->id);

        Http::fake(['*/gwprocess/v4/api.php' => Http::response([
            'status' => 'SUCCESS', 'sessionkey' => 'S', 'GatewayPageURL' => 'https://x/gw.php',
        ])]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'sslcommerz']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $merchantTranId = $claim->provider_payment_id;

        Http::fake(['*/validator/api/validationserverAPI.php*' => Http::response([
            'status' => 'VALID', 'tran_id' => $merchantTranId, 'amount' => '580.00', 'bank_tran_id' => 'BANK1',
        ])]);

        $this->get("/api/online-payment/sslcommerz/callback/{$claim->id}?val_id=VAL1&status=VALID&tran_id={$merchantTranId}");
        $this->assertEquals(580.0, $order->fresh()->paidAmount());

        // A second callback (e.g. IPN racing the redirect) must not double-book.
        $this->postJson("/api/online-payment/sslcommerz/ipn", ['val_id' => 'VAL1', 'status' => 'VALID', 'tran_id' => $merchantTranId])
            ->assertOk();

        $this->assertEquals(580.0, $order->fresh()->paidAmount());
        $this->assertSame(1, \App\Models\OrderPayment::where('order_id', $order->id)->count());
    }
}
