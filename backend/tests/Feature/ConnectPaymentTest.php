<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderOnlinePayment;
use App\Models\PaymentGatewayCredential;
use App\Models\PaymentGatewaySetting;
use App\Models\PlatformApiKey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Plugin-facing online payment (/api/connect/v1/payment/*) — delegates to
 * OnlinePaymentService, the exact same engine landing-page checkout uses.
 * See wordpress_connect_context.md.
 */
class ConnectPaymentTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: User, 1: string, 2: PlatformApiKey} */
    private function connectedMerchant(array $userAttrs = []): array
    {
        $user = User::factory()->create($userAttrs);
        $rawKey = PlatformApiKey::generateRawKey();

        $apiKey = PlatformApiKey::create([
            'user_id'    => $user->id,
            'platform'   => 'woocommerce',
            'domain'     => 'myshop.com',
            'key_hash'   => PlatformApiKey::hashKey($rawKey),
            'key_prefix' => substr($rawKey, 0, 12),
            'webhook_secret' => 'test-webhook-secret-123',
            'status'     => 'connected',
        ]);

        return [$user, $rawKey, $apiKey];
    }

    private function connectHeaders(string $rawKey, string $domain = 'myshop.com'): array
    {
        return ['X-API-KEY' => $rawKey, 'X-Client-Domain' => $domain];
    }

    private function syncedOrder(User $user, string $rawKey, string $wcOrderId = 'wc-order-1'): Order
    {
        $this->postJson('/api/connect/v1/orders/sync', [
            'wc_order_id'    => $wcOrderId,
            'customer_name'  => 'Karim Uddin',
            'customer_phone' => '01755443322',
            'customer_address' => 'Dhanmondi, Dhaka',
            'line_items'     => [
                ['name' => 'T-Shirt', 'quantity' => 1, 'total' => 580],
            ],
        ], $this->connectHeaders($rawKey))->assertCreated();

        return Order::where('user_id', $user->id)->where('source_ref', $wcOrderId)->firstOrFail();
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

    private function enableBkashPersonal(User $owner): void
    {
        PaymentGatewaySetting::create([
            'user_id' => $owner->id,
            'bkash_personal_enabled' => true,
            'bkash_personal_number' => '01799887766',
        ]);
    }

    public function test_channels_lists_enabled_wallet_and_gateway_channels(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->enableSslcommerz($user);
        $this->enableBkashPersonal($user);

        $response = $this->getJson('/api/connect/v1/payment/channels', $this->connectHeaders($rawKey));

        $response->assertOk();
        $this->assertSame(['sslcommerz'], collect($response->json('data.gateway_channels'))->pluck('provider')->all());
        $this->assertSame(['bkash'], collect($response->json('data.wallet_channels'))->pluck('provider')->all());
    }

    public function test_initiate_gateway_creates_claim_and_returns_redirect_url(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->enableSslcommerz($user);
        $order = $this->syncedOrder($user, $rawKey);

        Http::fake([
            '*/gwprocess/v4/api.php' => Http::response([
                'status' => 'SUCCESS', 'sessionkey' => 'S',
                'GatewayPageURL' => 'https://sandbox.sslcommerz.com/gw.php?Q=PAY',
            ]),
        ]);

        $response = $this->postJson('/api/connect/v1/payment/gateway/initiate', [
            'wc_order_id' => 'wc-order-1',
            'provider' => 'sslcommerz',
        ], $this->connectHeaders($rawKey));

        $response->assertOk();
        $this->assertStringContainsString('sandbox.sslcommerz.com', $response->json('data.redirect_url'));

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('gateway_auto', $claim->channel_type);
        $this->assertSame('sslcommerz', $claim->provider);
    }

    public function test_initiate_gateway_returns_order_not_found_for_unsynced_order(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->enableSslcommerz($user);

        $response = $this->postJson('/api/connect/v1/payment/gateway/initiate', [
            'wc_order_id' => 'never-synced',
            'provider' => 'sslcommerz',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(404)->assertJsonPath('error_code', 'order_not_found');
    }

    public function test_wallet_claim_creates_awaiting_verification_row(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->enableBkashPersonal($user);
        $order = $this->syncedOrder($user, $rawKey);

        $response = $this->postJson('/api/connect/v1/payment/wallet-claim', [
            'wc_order_id' => 'wc-order-1',
            'provider' => 'bkash',
            'sender_number' => '01711223344',
            'customer_trx_id' => 'TRX123XYZ',
        ], $this->connectHeaders($rawKey));

        $response->assertCreated();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('wallet_manual', $claim->channel_type);
        $this->assertSame('awaiting_verification', $claim->status);
        $this->assertSame('TRX123XYZ', $claim->customer_trx_id);
    }

    public function test_gateway_callback_redirects_through_woocommerce_bridge_and_pushes_payment_status_webhook(): void
    {
        // Covers both gaps this feature closed: (1) the callback redirect
        // must route through the plugin's own URL bridge, not a guessed
        // WooCommerce permalink or (wrongly) a landing-page thank-you URL;
        // (2) WooCommerce must be told "paid" via the outbound webhook,
        // since the gateway callback lands on BSOL directly and WordPress
        // is never otherwise in that request's loop.
        [$user, $rawKey] = $this->connectedMerchant();
        $this->enableSslcommerz($user);
        $order = $this->syncedOrder($user, $rawKey);

        // Http::fake() calls accumulate rather than replace — the earliest
        // registration for a given URL pattern wins over later ones. So the
        // validator URL must NOT be pre-registered here; it's added fresh
        // in the second Http::fake() call below, once the real
        // (randomly-suffixed) merchantTranId is known.
        Http::fake([
            '*/gwprocess/v4/api.php' => Http::response([
                'status' => 'SUCCESS', 'sessionkey' => 'S',
                'GatewayPageURL' => 'https://sandbox.sslcommerz.com/gw.php?Q=PAY',
            ]),
        ]);

        $this->postJson('/api/connect/v1/payment/gateway/initiate', [
            'wc_order_id' => 'wc-order-1',
            'provider' => 'sslcommerz',
        ], $this->connectHeaders($rawKey))->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $merchantTranId = $claim->provider_payment_id;

        Http::fake([
            '*/validator/api/validationserverAPI.php*' => Http::response([
                'status' => 'VALID', 'tran_id' => $merchantTranId, 'amount' => '580.00', 'bank_tran_id' => 'BANK1',
            ]),
            'myshop.com/wp-json/bsol-connect/v1/payment-status' => Http::response(['success' => true]),
        ]);

        $callback = $this->get("/api/online-payment/sslcommerz/callback/{$claim->id}?val_id=VAL1&status=VALID&tran_id={$merchantTranId}");

        $callback->assertRedirect();
        $location = $callback->headers->get('Location');
        $this->assertStringStartsWith('https://myshop.com/wp-json/bsol-connect/v1/payment-return', $location);
        $this->assertStringContainsString('wc_order_id=wc-order-1', $location);
        $this->assertStringContainsString('payment_result=success', $location);

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);

        Http::assertSent(function ($request) use ($order) {
            if ($request->url() !== 'https://myshop.com/wp-json/bsol-connect/v1/payment-status') {
                return false;
            }
            return $request->hasHeader('X-BSOL-Webhook-Secret', 'test-webhook-secret-123')
                && $request['wc_order_id'] === $order->source_ref
                && $request['status'] === 'paid'
                && $request['method'] === 'sslcommerz'
                && (float) $request['amount'] === 580.0;
        });
    }

    public function test_payment_status_webhook_is_not_pushed_for_landing_page_orders(): void
    {
        // Sanity check for the source-gate in
        // OnlinePaymentService::applyConfirmedPayment() — a landing-page
        // order confirming payment must never hit a WordPress site.
        $package = \App\Models\SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0, 'duration_days' => 30,
        ]);
        $owner = User::factory()->create(['subscription_package_id' => $package->id]);
        \App\Models\ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => 'shopb', 'subdomain_status' => 'active',
        ]);
        $page = \App\Models\LandingPage::create([
            'user_id' => $owner->id, 'title' => 'Offer', 'slug' => 'offer',
            'status' => 'published', 'published_at' => now(), 'content' => [],
        ]);
        $product = \App\Models\Product::create([
            'user_id' => $owner->id, 'name' => 'Test Product', 'sku' => 'TP-' . uniqid(),
            'selling_price' => 500, 'stock' => 100, 'track_stock' => false, 'status' => 'active',
        ]);
        \App\Models\LandingPageProduct::create(['landing_page_id' => $page->id, 'product_id' => $product->id, 'sort_order' => 0]);

        $this->enableBkashPersonal($owner);

        $orderResponse = $this->postJson("https://shopb.{$this->apex()}/api/public/landing-pages/offer/order", [
            'customer_name' => 'Karim Uddin', 'customer_phone' => '01712345678', 'customer_address' => 'Dhaka',
            'items' => [['enabled' => true, 'product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();
        $order = Order::findOrFail($orderResponse->json('data.order_id'));

        Http::fake(); // nothing should be called for this order

        $this->postJson(
            "https://shopb.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/wallet-claim",
            [
                'token' => $order->public_token, 'provider' => 'bkash',
                'sender_number' => '01711223344', 'customer_trx_id' => 'LPCLAIM1',
            ]
        )->assertCreated();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        Sanctum::actingAs($owner);
        $this->postJson("/api/online-payments/{$claim->id}/verify", ['approve' => true, 'amount' => 500])
            ->assertOk();

        Http::assertNothingSent();
    }

    private function apex(): string
    {
        return config('app.subdomain_apex');
    }
}
