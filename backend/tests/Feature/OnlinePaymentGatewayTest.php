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

    public function test_page_level_payment_channels_restriction_also_narrows_gateway_channels(): void
    {
        // Shop has SSLCommerz enabled, but this page's payment_channels
        // setting doesn't include it — the per-page restriction (already
        // proven for wallet channels) must apply symmetrically here too.
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableSslcommerz($owner);
        LandingPage::where('id', $page->id)->update([
            'content' => ['settings' => ['payment_channels' => ['cod']]],
        ]);

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/payment-channels");

        $response->assertOk();
        $this->assertSame([], $response->json('data.gateway_channels'));

        // Now include it explicitly — it should appear.
        LandingPage::where('id', $page->id)->update([
            'content' => ['settings' => ['payment_channels' => ['cod', 'sslcommerz']]],
        ]);

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/payment-channels");
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

    private function enableAamarpay(User $owner): void
    {
        PaymentGatewayCredential::create([
            'user_id' => $owner->id,
            'provider' => 'aamarpay',
            'enabled' => true,
            'is_live' => false,
            'credentials' => ['store_id' => 'aamarpaytest', 'signature_key' => 'dbb74894e82415a2f7ff0ec3a97e4183'],
        ]);
    }

    private function enableZinipay(User $owner): void
    {
        PaymentGatewayCredential::create([
            'user_id' => $owner->id,
            'provider' => 'zinipay',
            'enabled' => true,
            'is_live' => false,
            'credentials' => ['api_key' => 'zini_test_api_key_12345'],
        ]);
    }

    public function test_aamarpay_initiate_and_successful_callback_verification(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableAamarpay($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            '*/jsonpost.php' => Http::response([
                'result' => 'true',
                'payment_url' => 'https://sandbox.aamarpay.com/paynow.php?track=TRK123',
            ]),
        ]);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'aamarpay']
        );

        $response->assertOk();
        $this->assertStringContainsString('sandbox.aamarpay.com', $response->json('data.redirect_url'));

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('gateway_auto', $claim->channel_type);
        $this->assertSame('aamarpay', $claim->provider);
        $merchantTranId = $claim->provider_payment_id;

        Http::fake([
            '*/api/v1/trxcheck/request.php*' => Http::response([
                'status_code' => 2,
                'pay_status' => 'Successful',
                'mer_txnid' => $merchantTranId,
                'pg_txnid' => 'AAMAR_PG_12345',
                'amount' => '580.00',
            ]),
        ]);

        $callback = $this->get("/api/online-payment/aamarpay/callback/{$claim->id}?mer_txnid={$merchantTranId}&pg_txnid=AAMAR_PG_12345");
        $callback->assertRedirect();
        $this->assertStringContainsString('payment_result=success', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);
        $this->assertEquals(580.0, $order->paidAmount());
        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id, 'source' => 'online_gateway', 'method' => 'aamarpay',
        ]);
    }

    public function test_aamarpay_callback_tampered_mer_txnid_is_rejected(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableAamarpay($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            '*/jsonpost.php' => Http::response([
                'result' => 'true',
                'payment_url' => 'https://sandbox.aamarpay.com/paynow.php?track=TRK123',
            ]),
        ]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'aamarpay']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();

        // Verification response returns a mismatched mer_txnid
        Http::fake([
            '*/api/v1/trxcheck/request.php*' => Http::response([
                'status_code' => 2,
                'pay_status' => 'Successful',
                'mer_txnid' => 'OTHER_TRAN_ID',
                'pg_txnid' => 'AAMAR_PG_12345',
                'amount' => '580.00',
            ]),
        ]);

        $callback = $this->get("/api/online-payment/aamarpay/callback/{$claim->id}?mer_txnid=OTHER_TRAN_ID");
        $callback->assertRedirect();
        $this->assertStringContainsString('payment_result=failed', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('pending', $order->status);
        $this->assertSame('due', $order->payment_status);
    }

    public function test_zinipay_initiate_and_successful_callback_verification(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableZinipay($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://api.zinipay.com/v1/payment/create' => Http::response([
                'status' => 'success',
                'payment_url' => 'https://api.zinipay.com/checkout/INV_98765',
                'invoice_id' => 'INV_98765',
            ]),
        ]);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'zinipay']
        );

        $response->assertOk();
        $this->assertStringContainsString('zinipay.com', $response->json('data.redirect_url'));

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('gateway_auto', $claim->channel_type);
        $this->assertSame('zinipay', $claim->provider);
        $this->assertSame('INV_98765', $claim->provider_payment_id);

        Http::fake([
            'https://api.zinipay.com/v1/payment/verify' => Http::response([
                'status' => 'COMPLETED',
                'invoice_id' => 'INV_98765',
                'transaction_id' => 'ZINI_TXN_5555',
                'amount' => 580.0,
            ]),
        ]);

        $callback = $this->get("/api/online-payment/zinipay/callback/{$claim->id}?invoice_id=INV_98765");
        $callback->assertRedirect();
        $this->assertStringContainsString('payment_result=success', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);
        $this->assertEquals(580.0, $order->paidAmount());
        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id, 'source' => 'online_gateway', 'method' => 'zinipay',
        ]);
    }

    public function test_zinipay_callback_cannot_be_spoofed_with_a_different_completed_invoice_id(): void
    {
        // Regression for a real gap: verifyPayment() used to trust
        // $callbackData's invoice_id (customer-suppliable query string on
        // the GET redirect) instead of our own stored provider_payment_id.
        // A customer could replay a DIFFERENT invoice_id they'd genuinely
        // completed (e.g. a cheap unrelated order on this same seller) to
        // fraudulently confirm this costlier, still-unpaid order.
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableZinipay($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://api.zinipay.com/v1/payment/create' => Http::response([
                'status' => 'success',
                'payment_url' => 'https://api.zinipay.com/checkout/INV_REAL',
                'invoice_id' => 'INV_REAL',
            ]),
        ]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'zinipay']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('INV_REAL', $claim->provider_payment_id);

        // The verify endpoint reflects each invoice's real, independent
        // status — SOME_OTHER_COMPLETED_INVOICE really is COMPLETED (it's
        // a genuine transaction, just for a different order), INV_REAL is
        // still PENDING. If the client used the query-string invoice_id,
        // this order would wrongly confirm.
        Http::fake([
            'https://api.zinipay.com/v1/payment/verify' => function ($request) {
                $body = $request->data();
                if (($body['invoiceId'] ?? null) === 'SOME_OTHER_COMPLETED_INVOICE') {
                    return Http::response(['status' => 'COMPLETED', 'invoice_id' => 'SOME_OTHER_COMPLETED_INVOICE', 'amount' => 10]);
                }
                return Http::response(['status' => 'PENDING', 'invoice_id' => $body['invoiceId'] ?? null]);
            },
        ]);

        $callback = $this->get("/api/online-payment/zinipay/callback/{$claim->id}?invoice_id=SOME_OTHER_COMPLETED_INVOICE");
        $this->assertStringContainsString('payment_result=failed', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('pending', $order->status);
        $this->assertSame('due', $order->payment_status);
        $this->assertDatabaseMissing('order_payments', ['order_id' => $order->id]);
    }

    public function test_zinipay_callback_status_failure_is_handled(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableZinipay($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://api.zinipay.com/v1/payment/create' => Http::response([
                'status' => 'success',
                'payment_url' => 'https://api.zinipay.com/checkout/INV_98765',
                'invoice_id' => 'INV_98765',
            ]),
        ]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'zinipay']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();

        Http::fake([
            'https://api.zinipay.com/v1/payment/verify' => Http::response([
                'status' => 'FAILED',
                'invoice_id' => 'INV_98765',
            ]),
        ]);

        $callback = $this->get("/api/online-payment/zinipay/callback/{$claim->id}?invoice_id=INV_98765");
        $callback->assertRedirect();
        $this->assertStringContainsString('payment_result=failed', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('pending', $order->status);
        $this->assertSame('due', $order->payment_status);
        $this->assertSame('failed', $claim->fresh()->status);
    }

    private function enableShurjopay(User $owner): void
    {
        PaymentGatewayCredential::create([
            'user_id' => $owner->id,
            'provider' => 'shurjopay',
            'enabled' => true,
            'is_live' => false,
            'credentials' => [
                'username' => 'sp_sandbox_user',
                'password' => 'sp_sandbox_pass',
                'prefix' => 'NOK',
            ],
        ]);
    }

    public function test_shurjopay_initiate_and_successful_callback_verification(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableShurjopay($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://sandbox.shurjopayment.com/api/get_token' => Http::response([
                'token' => 'SP_BEARER_TOKEN_123',
                'store_id' => 'SP_STORE_999',
                'sp_code' => '200',
            ]),
            'https://sandbox.shurjopayment.com/api/secret-pay' => Http::response([
                'checkout_url' => 'https://sandbox.shurjopayment.com/pay/SP_ORD_777',
                'sp_order_id' => 'SP_ORD_777',
            ]),
        ]);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'shurjopay']
        );

        $response->assertOk();
        $this->assertStringContainsString('shurjopayment.com', $response->json('data.redirect_url'));

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('gateway_auto', $claim->channel_type);
        $this->assertSame('shurjopay', $claim->provider);
        $merchantTranId = $claim->gateway_response['merchant_tran_id'] ?? (string) $claim->provider_payment_id;

        Http::fake([
            'https://sandbox.shurjopayment.com/api/get_token' => Http::response([
                'token' => 'SP_BEARER_TOKEN_123',
                'store_id' => 'SP_STORE_999',
            ]),
            'https://sandbox.shurjopayment.com/api/verification' => Http::response([
                [
                    'sp_code' => 1000,
                    'sp_message' => 'Success',
                    'order_id' => 'SP_ORD_777',
                    'customer_order_id' => $merchantTranId,
                    'bank_trx_id' => 'SP_BANK_TXN_888',
                    'amount' => '580.00',
                    'transaction_status' => 'Completed',
                ],
            ]),
        ]);

        $callback = $this->get("/api/online-payment/shurjopay/callback/{$claim->id}?order_id=SP_ORD_777");
        $callback->assertRedirect();
        $this->assertStringContainsString('payment_result=success', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);
        $this->assertEquals(580.0, $order->paidAmount());
        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id, 'source' => 'online_gateway', 'method' => 'shurjopay',
        ]);
    }

    public function test_shurjopay_callback_tampered_order_id_is_rejected(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableShurjopay($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://sandbox.shurjopayment.com/api/get_token' => Http::response([
                'token' => 'SP_BEARER_TOKEN_123',
                'store_id' => 'SP_STORE_999',
            ]),
            'https://sandbox.shurjopayment.com/api/secret-pay' => Http::response([
                'checkout_url' => 'https://sandbox.shurjopayment.com/pay/SP_ORD_777',
                'sp_order_id' => 'SP_ORD_777',
            ]),
        ]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'shurjopay']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();

        Http::fake([
            'https://sandbox.shurjopayment.com/api/get_token' => Http::response([
                'token' => 'SP_BEARER_TOKEN_123',
                'store_id' => 'SP_STORE_999',
            ]),
            'https://sandbox.shurjopayment.com/api/verification' => Http::response([
                [
                    'sp_code' => 1000,
                    'sp_message' => 'Success',
                    'order_id' => 'SP_ORD_777',
                    'customer_order_id' => 'TAMPERED_TRAN_ID',
                    'amount' => '580.00',
                ],
            ]),
        ]);

        $callback = $this->get("/api/online-payment/shurjopay/callback/{$claim->id}?order_id=SP_ORD_777");
        $callback->assertRedirect();
        $this->assertStringContainsString('payment_result=failed', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('pending', $order->status);
        $this->assertSame('due', $order->payment_status);
        $this->assertSame('failed', $claim->fresh()->status);
    }

    public function test_shurjopay_ipn_resolves_claim_by_order_id(): void
    {
        // Regression: gatewayIpn()'s candidate-id list only knew about
        // tran_id/val_id/invoice_id/mer_txnid — ShurjoPay's own order_id/
        // sp_order_id weren't in it, so its server-to-server IPN leg
        // 404'd and only the browser-redirect leg ever worked.
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableShurjopay($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://sandbox.shurjopayment.com/api/get_token' => Http::response([
                'token' => 'SP_BEARER_TOKEN_123', 'store_id' => 'SP_STORE_999',
            ]),
            'https://sandbox.shurjopayment.com/api/secret-pay' => Http::response([
                'checkout_url' => 'https://sandbox.shurjopayment.com/pay/SP_ORD_777', 'sp_order_id' => 'SP_ORD_777',
            ]),
        ]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'shurjopay']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $merchantTranId = $claim->gateway_response['merchant_tran_id'] ?? (string) $claim->provider_payment_id;

        Http::fake([
            'https://sandbox.shurjopayment.com/api/get_token' => Http::response([
                'token' => 'SP_BEARER_TOKEN_123', 'store_id' => 'SP_STORE_999',
            ]),
            'https://sandbox.shurjopayment.com/api/verification' => Http::response([[
                'sp_code' => 1000, 'sp_message' => 'Success', 'order_id' => 'SP_ORD_777',
                'customer_order_id' => $merchantTranId, 'bank_trx_id' => 'SP_BANK_TXN_1',
                'amount' => '580.00', 'transaction_status' => 'Completed',
            ]]),
        ]);

        // Server-to-server IPN — no path id, must resolve purely from payload.
        $this->postJson('/api/online-payment/shurjopay/ipn', ['order_id' => 'SP_ORD_777'])
            ->assertOk()
            ->assertJson(['success' => true]);

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertEquals(580.0, $order->paidAmount());
    }

    private function enableEps(User $owner): void
    {
        PaymentGatewayCredential::create([
            'user_id' => $owner->id,
            'provider' => 'eps',
            'enabled' => true,
            'is_live' => false,
            'credentials' => [
                'merchant_id' => 'EPS_MERCHANT_TEST',
                'store_id' => 'EPS_STORE_TEST',
                'username' => 'eps_sandbox_user',
                'password' => 'eps_sandbox_pass',
                'hash_key' => 'eps_test_hash_key_123',
            ],
        ]);
    }

    public function test_eps_initiate_and_successful_callback_verification(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableEps($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://sandboxpgapi.eps.com.bd/v1/Auth/GetToken' => Http::response(['token' => 'EPS_BEARER_TOKEN']),
            'https://sandboxpgapi.eps.com.bd/v1/EPSEngine/InitializeEPS' => Http::response([
                'RedirectURL' => 'https://sandboxpgapi.eps.com.bd/pay/EPS_SESSION_1',
            ]),
        ]);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'eps']
        );

        $response->assertOk();
        $this->assertStringContainsString('sandboxpgapi.eps.com.bd', $response->json('data.redirect_url'));

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('gateway_auto', $claim->channel_type);
        $this->assertSame('eps', $claim->provider);
        $merchantTranId = $claim->provider_payment_id;

        Http::fake([
            'https://sandboxpgapi.eps.com.bd/v1/Auth/GetToken' => Http::response(['token' => 'EPS_BEARER_TOKEN']),
            // Real EPS response shape (confirmed against a live sandbox
            // card test, 2026-08-19) — flat, PascalCase, not nested/lowercase.
            'https://sandboxpgapi.eps.com.bd/v1/EPSEngine/CheckMerchantTransactionStatus*' => Http::response([
                'MerchantTransactionId' => $merchantTranId,
                'EPSTransactionId' => 'EPS_TXN_1',
                'Status' => 'Success',
                'TotalAmount' => '580.00',
                'StoreAmount' => '567.20',
                'TransactionType' => 'Purchase',
                'FinancialEntity' => 'BKash',
            ]),
        ]);

        $callback = $this->get("/api/online-payment/eps/callback/{$claim->id}?merchantTransactionId={$merchantTranId}");
        $callback->assertRedirect();
        $this->assertStringContainsString('payment_result=success', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);
        $this->assertEquals(580.0, $order->paidAmount());
        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id, 'source' => 'online_gateway', 'method' => 'eps',
        ]);
    }

    public function test_eps_verify_always_uses_our_own_stored_transaction_id(): void
    {
        // Built in from day one (the same lesson the ZiniPay tampering fix
        // taught — see online_payment_context.md): prove a customer can't
        // influence which transaction id gets checked via the callback
        // query string. EPS's status API has no independent id to
        // cross-check after the fact, so this always-verify-our-own-id
        // discipline IS the tampering guard for this client.
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableEps($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://sandboxpgapi.eps.com.bd/v1/Auth/GetToken' => Http::response(['token' => 'EPS_BEARER_TOKEN']),
            'https://sandboxpgapi.eps.com.bd/v1/EPSEngine/InitializeEPS' => Http::response([
                'RedirectURL' => 'https://sandboxpgapi.eps.com.bd/pay/EPS_SESSION_1',
            ]),
        ]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'eps']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $realTranId = $claim->provider_payment_id;

        Http::fake([
            'https://sandboxpgapi.eps.com.bd/v1/Auth/GetToken' => Http::response(['token' => 'EPS_BEARER_TOKEN']),
            'https://sandboxpgapi.eps.com.bd/v1/EPSEngine/CheckMerchantTransactionStatus*' => function ($request) use ($realTranId) {
                // Only the REAL stored transaction (still pending) exists
                // on EPS's side; a spoofed id would only look SUCCESS if
                // the client actually queried it, which it must not.
                if (str_contains((string) $request->url(), urlencode($realTranId))) {
                    return Http::response(['MerchantTransactionId' => $realTranId, 'Status' => 'Pending']);
                }
                return Http::response(['MerchantTransactionId' => 'SPOOFED_OTHER_ID', 'Status' => 'Success', 'TotalAmount' => '580.00']);
            },
        ]);

        // Attacker supplies a bogus transaction id in the callback query string.
        $callback = $this->get("/api/online-payment/eps/callback/{$claim->id}?merchantTransactionId=SPOOFED_OTHER_ID");
        $this->assertStringContainsString('payment_result=failed', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('pending', $order->status);
        $this->assertSame('due', $order->payment_status);
        $this->assertDatabaseMissing('order_payments', ['order_id' => $order->id]);
    }

    public function test_eps_verify_parses_the_real_captured_production_response(): void
    {
        // Regression lock for a real live bug (2026-08-19): the first
        // EPS integration assumed a nested {"data":{"status":...}} shape
        // from the official PHP sample's prose. A real sandbox card test
        // came back with this exact flat, PascalCase payload instead — our
        // verify() never recognized "Status":"Success" and the order stayed
        // unpaid despite the customer's card payment succeeding on EPS's
        // side. This is the literal response captured from production logs
        // for that failed test (trimmed to the fields that matter).
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableEps($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://sandboxpgapi.eps.com.bd/v1/Auth/GetToken' => Http::response(['token' => 'EPS_BEARER_TOKEN']),
            'https://sandboxpgapi.eps.com.bd/v1/EPSEngine/InitializeEPS' => Http::response([
                'RedirectURL' => 'https://sandboxpgapi.eps.com.bd/pay/EPS_SESSION_1',
            ]),
        ]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'eps']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $merchantTranId = $claim->provider_payment_id;

        Http::fake([
            'https://sandboxpgapi.eps.com.bd/v1/Auth/GetToken' => Http::response(['token' => 'EPS_BEARER_TOKEN']),
            'https://sandboxpgapi.eps.com.bd/v1/EPSEngine/CheckMerchantTransactionStatus*' => Http::response([
                'MerchantTransactionId' => $merchantTranId,
                'EPSTransactionId' => '8265839150819E',
                'Status' => 'Success',
                'TotalAmount' => '580.00',
                'StoreAmount' => '567.94',
                'TransactionDate' => '19 Aug 2026 09:39:58 PM',
                'TransactionType' => 'Purchase',
                'FinancialEntity' => 'BKash',
                'ErrorCode' => null,
                'ErrorMessage' => null,
                'CustomerName' => 'Test EPS',
                'PaymentId' => '',
            ]),
        ]);

        $callback = $this->get("/api/online-payment/eps/callback/{$claim->id}?merchantTransactionId={$merchantTranId}");
        $this->assertStringContainsString('payment_result=success', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);
        // Asserts TotalAmount (what the customer paid) is used, not
        // StoreAmount (the seller's net after EPS's fee).
        $this->assertEquals(580.0, $order->paidAmount());
        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id, 'source' => 'online_gateway', 'method' => 'eps',
        ]);
    }

    private function enableBkashMerchant(User $owner): void
    {
        PaymentGatewayCredential::create([
            'user_id' => $owner->id,
            'provider' => 'bkash_merchant',
            'enabled' => true,
            'is_live' => false,
            'credentials' => [
                'app_key' => 'bkash_test_app_key',
                'app_secret' => 'bkash_test_app_secret',
                'username' => 'bkash_sandbox_user',
                'password' => 'bkash_sandbox_pass',
            ],
        ]);
    }

    public function test_bkash_merchant_initiate_and_successful_callback_verification(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableBkashMerchant($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant' => Http::response([
                'id_token' => 'BKASH_ID_TOKEN', 'expires_in' => 3600,
            ]),
            'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/create' => Http::response([
                'paymentID' => 'BKASH_PAY_ID_1', 'bkashURL' => 'https://tokenized.sandbox.bka.sh/pay/BKASH_PAY_ID_1',
            ]),
        ]);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'bkash_merchant']
        );

        $response->assertOk();
        $this->assertStringContainsString('tokenized.sandbox.bka.sh', $response->json('data.redirect_url'));

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('gateway_auto', $claim->channel_type);
        $this->assertSame('bkash_merchant', $claim->provider);
        $this->assertSame('BKASH_PAY_ID_1', $claim->provider_payment_id);

        Http::fake([
            'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant' => Http::response([
                'id_token' => 'BKASH_ID_TOKEN', 'expires_in' => 3600,
            ]),
            'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/execute' => Http::response([
                'paymentID' => 'BKASH_PAY_ID_1', 'trxID' => 'BKASH_TRX_1', 'transactionStatus' => 'Completed', 'amount' => '580.00',
            ]),
        ]);

        $callback = $this->get("/api/online-payment/bkash_merchant/callback/{$claim->id}?paymentID=BKASH_PAY_ID_1&status=success");
        $callback->assertRedirect();
        $this->assertStringContainsString('payment_result=success', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);
        $this->assertEquals(580.0, $order->paidAmount());
        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id, 'source' => 'online_gateway', 'method' => 'bkash_merchant',
        ]);
    }

    public function test_bkash_merchant_callback_where_execute_does_not_complete_is_rejected(): void
    {
        // Even if the redirect claims status=success, bKash's own execute()
        // response is the sole authority (it both finalizes and reports the
        // real outcome in one call) — a non-Completed transactionStatus
        // must fail regardless of the redirect's own hint.
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableBkashMerchant($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant' => Http::response([
                'id_token' => 'BKASH_ID_TOKEN', 'expires_in' => 3600,
            ]),
            'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/create' => Http::response([
                'paymentID' => 'BKASH_PAY_ID_2', 'bkashURL' => 'https://tokenized.sandbox.bka.sh/pay/BKASH_PAY_ID_2',
            ]),
        ]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'bkash_merchant']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();

        Http::fake([
            'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant' => Http::response([
                'id_token' => 'BKASH_ID_TOKEN', 'expires_in' => 3600,
            ]),
            'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/execute' => Http::response([
                'paymentID' => 'BKASH_PAY_ID_2', 'transactionStatus' => 'Failed', 'statusMessage' => 'Cancelled by user',
            ]),
        ]);

        $callback = $this->get("/api/online-payment/bkash_merchant/callback/{$claim->id}?paymentID=BKASH_PAY_ID_2&status=success");
        $this->assertStringContainsString('payment_result=failed', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('pending', $order->status);
        $this->assertSame('due', $order->payment_status);
    }

    /**
     * Two separate keypairs, matching Nagad's real design: our own merchant
     * keypair (we hold the private key; Nagad holds our public key) and a
     * stand-in for Nagad's PG keypair (we hold their public key; this test
     * plays Nagad's part using the matching private key to build fake
     * responses). Returns the merchant public PEM (to encrypt fake
     * responses as Nagad would) after storing the credential row.
     */
    private function enableNagadMerchant(User $owner): string
    {
        $merchantKeyRes = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($merchantKeyRes, $merchantPrivatePem);
        $merchantPublicPem = openssl_pkey_get_details($merchantKeyRes)['key'];

        $pgKeyRes = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($pgKeyRes, $pgPrivatePem);
        $pgPublicPem = openssl_pkey_get_details($pgKeyRes)['key'];

        PaymentGatewayCredential::create([
            'user_id' => $owner->id,
            'provider' => 'nagad_merchant',
            'enabled' => true,
            'is_live' => false,
            'credentials' => [
                'merchant_id' => 'NAGAD_MERCHANT_TEST',
                'account_number' => '01700000000',
                'merchant_private_key' => $this->pemBody($merchantPrivatePem),
                'pg_public_key' => $this->pemBody($pgPublicPem),
            ],
        ]);

        return $merchantPublicPem;
    }

    private function pemBody(string $pem): string
    {
        $lines = array_filter(explode("\n", trim($pem)), fn (string $l) => ! str_starts_with(trim($l), '-----'));

        return implode('', $lines);
    }

    /** Simulates Nagad's own server encrypting a response payload for us —
     *  the exact inverse of what NagadMerchantGatewayClient::decrypt() does. */
    private function nagadEncryptForUs(string $merchantPublicPem, array $data): string
    {
        $key = openssl_pkey_get_public($merchantPublicPem);
        openssl_public_encrypt(json_encode($data), $encrypted, $key);

        return base64_encode($encrypted);
    }

    public function test_nagad_merchant_initiate_and_successful_callback_verification(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $merchantPublicPem = $this->enableNagadMerchant($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            '*check-out/initialize/*' => function ($request) use ($merchantPublicPem) {
                return Http::response([
                    'sensitiveData' => $this->nagadEncryptForUs($merchantPublicPem, [
                        'paymentReferenceId' => 'NAGAD_REF_1',
                        'challenge' => 'server_returned_challenge_123',
                    ]),
                    'signature' => 'not-verified-by-this-client',
                ]);
            },
            '*check-out/complete/*' => Http::response([
                'callBackUrl' => 'http://sandbox.mynagad.com:10080/check-out/pay/NAGAD_REF_1',
            ]),
        ]);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'nagad_merchant']
        );

        $response->assertOk();
        $this->assertStringContainsString('sandbox.mynagad.com', $response->json('data.redirect_url'));

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('gateway_auto', $claim->channel_type);
        $this->assertSame('nagad_merchant', $claim->provider);
        $this->assertSame('NAGAD_REF_1', $claim->provider_payment_id);

        Http::fake([
            '*verify/payment/*' => Http::response([
                'status' => 'Success', 'amount' => '580.00', 'issuerPaymentRefNo' => 'NAGAD_ISSUER_1',
            ]),
        ]);

        $callback = $this->get("/api/online-payment/nagad_merchant/callback/{$claim->id}?payment_ref_id=NAGAD_REF_1&status=Success");
        $callback->assertRedirect();
        $this->assertStringContainsString('payment_result=success', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);
        $this->assertEquals(580.0, $order->paidAmount());
        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id, 'source' => 'online_gateway', 'method' => 'nagad_merchant',
        ]);
    }

    public function test_nagad_merchant_verify_always_uses_our_own_stored_payment_reference(): void
    {
        // Same discipline built into every other client fixed/built this
        // way in this batch: verifyPayment() never reads a customer-
        // suppliable callback param to decide what to check.
        [$owner, $page, $product] = $this->shopWithPage();
        $merchantPublicPem = $this->enableNagadMerchant($owner);
        $order = $this->createOrder($product->id);

        Http::fake([
            '*check-out/initialize/*' => function ($request) use ($merchantPublicPem) {
                return Http::response([
                    'sensitiveData' => $this->nagadEncryptForUs($merchantPublicPem, [
                        'paymentReferenceId' => 'NAGAD_REF_2', 'challenge' => 'chal2',
                    ]),
                    'signature' => 'x',
                ]);
            },
            '*check-out/complete/*' => Http::response([
                'callBackUrl' => 'http://sandbox.mynagad.com:10080/check-out/pay/NAGAD_REF_2',
            ]),
        ]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/gateway/initiate",
            ['token' => $order->public_token, 'provider' => 'nagad_merchant']
        )->assertOk();

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();

        Http::fake([
            '*verify/payment/*' => function ($request) {
                // Only the REAL stored reference (still pending) exists on
                // Nagad's side; a spoofed reference must never be queried.
                if (str_contains((string) $request->url(), 'NAGAD_REF_2')) {
                    return Http::response(['status' => 'Pending']);
                }
                return Http::response(['status' => 'Success', 'amount' => '580.00']);
            },
        ]);

        $callback = $this->get("/api/online-payment/nagad_merchant/callback/{$claim->id}?payment_ref_id=SPOOFED_OTHER_REF&status=Success");
        $this->assertStringContainsString('payment_result=failed', $callback->headers->get('Location'));

        $order->refresh();
        $this->assertSame('pending', $order->status);
        $this->assertSame('due', $order->payment_status);
        $this->assertDatabaseMissing('order_payments', ['order_id' => $order->id]);
    }
}


