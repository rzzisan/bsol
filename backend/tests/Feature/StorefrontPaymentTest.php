<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderOnlinePayment;
use App\Models\PaymentGatewayCredential;
use App\Models\PaymentGatewaySetting;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * S3b of seller_storefront_context.md — storefront online payment
 * (wallet_manual + gateway_auto), reusing OnlinePaymentService as-is.
 */
class StorefrontPaymentTest extends TestCase
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

    private function shop(string $subdomain = 'shopa'): User
    {
        $owner = User::factory()->create();

        ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => $subdomain, 'subdomain_status' => 'active',
        ]);

        return $owner;
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
            'discount' => 0,
            'discount_type' => 'amount',
            'selling_price' => 500,
            'stock' => 10,
            'track_stock' => true,
            'status' => 'active',
            'show_in_storefront' => true,
        ], $attrs));
    }

    private function enableBkash(User $owner): void
    {
        PaymentGatewaySetting::create([
            'user_id' => $owner->id,
            'bkash_personal_enabled' => true,
            'bkash_personal_number' => '01799990000',
        ]);
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

    private function createOrder(string $subdomain, int $productId, array $overrides = []): Order
    {
        $response = $this->postJson("https://{$subdomain}.{$this->apex()}/api/public/storefront/orders", array_merge([
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'customer_address' => 'Dhanmondi, Dhaka',
            'items' => [['product_id' => $productId, 'quantity' => 1]],
        ], $overrides));

        $response->assertCreated();

        return Order::where('order_number', $response->json('data.order_number'))->firstOrFail();
    }

    public function test_channels_endpoint_lists_enabled_wallet_and_gateway(): void
    {
        $owner = $this->shop();
        $this->enableBkash($owner);
        $this->enableSslcommerz($owner);

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/payment-channels")
            ->assertOk();

        $this->assertTrue($response->json('data.cod_enabled'));
        $this->assertCount(1, $response->json('data.wallet_channels'));
        $this->assertSame('bkash', $response->json('data.wallet_channels.0.provider'));
        $this->assertCount(1, $response->json('data.gateway_channels'));
        $this->assertSame('sslcommerz', $response->json('data.gateway_channels.0.provider'));
    }

    public function test_digital_cart_blocked_on_cod_but_allowed_with_online_payment(): void
    {
        $owner = $this->shop();
        $this->enableBkash($owner);
        $digital = $this->product($owner, [
            'product_type' => 'digital',
            'digital_delivery_type' => 'external_url',
            'digital_external_url' => 'https://example.com/file.zip',
        ]);

        $this->postJson("https://shopa.{$this->apex()}/api/public/storefront/orders", [
            'customer_name' => 'Karim',
            'customer_phone' => '01712345678',
            'customer_address' => 'Dhaka',
            'items' => [['product_id' => $digital->id, 'quantity' => 1]],
        ])->assertStatus(422)->assertJsonValidationErrors(['payment_method']);

        $order = $this->createOrder('shopa', $digital->id, ['payment_method' => 'bkash']);
        $this->assertSame('bkash', $order->payment_method);
    }

    public function test_wallet_claim_submission_creates_awaiting_verification_row(): void
    {
        $owner = $this->shop();
        $this->enableBkash($owner);
        $product = $this->product($owner);
        $order = $this->createOrder('shopa', $product->id, ['payment_method' => 'bkash']);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/storefront/orders/{$order->public_token}/wallet-claim",
            [
                'provider' => 'bkash',
                'sender_number' => '01712345678',
                'customer_trx_id' => 'TRX' . uniqid(),
            ],
        )->assertCreated();

        $this->assertSame('awaiting_verification', $response->json('data.status'));
        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('wallet_manual', $claim->channel_type);
    }

    public function test_wallet_claim_for_another_shops_token_is_not_found(): void
    {
        $ownerA = $this->shop('shopa');
        $this->shop('shopb');
        $this->enableBkash($ownerA);
        $product = $this->product($ownerA);
        $order = $this->createOrder('shopa', $product->id, ['payment_method' => 'bkash']);

        $this->postJson(
            "https://shopb.{$this->apex()}/api/public/storefront/orders/{$order->public_token}/wallet-claim",
            ['provider' => 'bkash', 'sender_number' => '01712345678', 'customer_trx_id' => 'TRX1'],
        )->assertNotFound();
    }

    public function test_initiate_gateway_creates_initiated_row_and_returns_redirect_url(): void
    {
        $owner = $this->shop();
        $this->enableSslcommerz($owner);
        $product = $this->product($owner);
        $order = $this->createOrder('shopa', $product->id, ['payment_method' => 'sslcommerz']);

        Http::fake([
            '*/gwprocess/v4/api.php' => Http::response([
                'status' => 'SUCCESS',
                'sessionkey' => 'SESSION123',
                'GatewayPageURL' => 'https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=PAY&SESSIONKEY=SESSION123',
            ]),
        ]);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/storefront/orders/{$order->public_token}/gateway/initiate",
            ['provider' => 'sslcommerz'],
        )->assertOk();

        $this->assertStringContainsString('sandbox.sslcommerz.com', $response->json('data.redirect_url'));

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('gateway_auto', $claim->channel_type);
        $this->assertSame('sslcommerz', $claim->provider);
    }
}
