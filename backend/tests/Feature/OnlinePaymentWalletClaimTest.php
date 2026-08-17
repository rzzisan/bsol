<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\Order;
use App\Models\OrderOnlinePayment;
use App\Models\PaymentGatewaySetting;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\SubscriptionPackage;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Customer-facing online payment — Phase A (wallet_manual: bKash/Nagad/
 * Rocket personal-number send & verify). See online_payment_context.md.
 */
class OnlinePaymentWalletClaimTest extends TestCase
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

    private function shopWithPage(string $subdomain = 'shopa'): array
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0, 'duration_days' => 30,
        ]);
        $owner = User::factory()->create(['subscription_package_id' => $package->id]);

        ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => $subdomain, 'subdomain_status' => 'active',
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

    private function enableBkash(User $owner, string $number = '01799990000'): void
    {
        PaymentGatewaySetting::create([
            'user_id' => $owner->id,
            'bkash_personal_enabled' => true,
            'bkash_personal_number' => $number,
        ]);
    }

    private function createOrder(string $subdomain, string $slug, int $productId): Order
    {
        $response = $this->postJson("https://{$subdomain}.{$this->apex()}/api/public/landing-pages/{$slug}/order", [
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'customer_address' => 'Dhanmondi, Dhaka',
            'items' => [['enabled' => true, 'product_id' => $productId, 'quantity' => 1]],
        ]);
        $response->assertCreated();

        return Order::findOrFail($response->json('data.order_id'));
    }

    private function submitClaim(string $subdomain, string $slug, Order $order, array $overrides = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson(
            "https://{$subdomain}.{$this->apex()}/api/public/landing-pages/{$slug}/orders/{$order->id}/online-payment/wallet-claim",
            array_merge([
                'token' => $order->public_token,
                'provider' => 'bkash',
                'sender_number' => '01712345678',
                'customer_trx_id' => 'TRX' . uniqid(),
            ], $overrides)
        );
    }

    public function test_payment_channels_endpoint_returns_only_enabled_channels(): void
    {
        [$owner, $page] = $this->shopWithPage();
        $this->enableBkash($owner);

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/payment-channels");

        $response->assertOk();
        $providers = collect($response->json('data.wallet_channels'))->pluck('provider')->all();
        $this->assertSame(['bkash'], $providers);
    }

    public function test_payment_channels_endpoint_respects_per_page_restriction(): void
    {
        // Shop has bkash AND nagad enabled, but this specific page only
        // offers bkash (and turns COD off) — the page-level setting must
        // narrow the shop-wide set, not just filter it out entirely.
        [$owner, $page] = $this->shopWithPage();
        $this->enableBkash($owner);
        PaymentGatewaySetting::where('user_id', $owner->id)->update([
            'nagad_personal_enabled' => true, 'nagad_personal_number' => '01711112222',
        ]);
        LandingPage::where('id', $page->id)->update([
            'content' => ['settings' => ['payment_channels' => ['bkash']]],
        ]);

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/payment-channels");

        $response->assertOk();
        $this->assertFalse($response->json('data.cod_enabled'));
        $providers = collect($response->json('data.wallet_channels'))->pluck('provider')->all();
        $this->assertSame(['bkash'], $providers);
    }

    public function test_payment_channels_endpoint_defaults_to_everything_when_page_has_no_restriction(): void
    {
        [$owner, $page] = $this->shopWithPage();
        $this->enableBkash($owner);
        // content has no 'payment_channels' key at all — pre-existing page.
        LandingPage::where('id', $page->id)->update(['content' => ['settings' => []]]);

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/payment-channels");

        $response->assertOk();
        $this->assertTrue($response->json('data.cod_enabled'));
        $providers = collect($response->json('data.wallet_channels'))->pluck('provider')->all();
        $this->assertSame(['bkash'], $providers);
    }

    public function test_submit_wallet_claim_creates_awaiting_verification_row(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableBkash($owner);
        $order = $this->createOrder('shopa', 'offer', $product->id);

        $response = $this->submitClaim('shopa', 'offer', $order);

        $response->assertCreated();
        $this->assertSame('awaiting_verification', $response->json('data.status'));

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('wallet_manual', $claim->channel_type);
        $this->assertSame('bkash', $claim->provider);
        // Order total = product 500 + default shipping_charge 80 (no
        // 'shipping.inside_dhaka' override on this fixture's landing page).
        $this->assertEquals(580.0, (float) $claim->amount);
    }

    public function test_claim_rejected_for_a_provider_the_seller_has_not_enabled(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableBkash($owner); // nagad left disabled
        $order = $this->createOrder('shopa', 'offer', $product->id);

        $response = $this->submitClaim('shopa', 'offer', $order, ['provider' => 'nagad']);

        $response->assertStatus(422);
    }

    public function test_same_trx_id_cannot_be_claimed_against_a_second_order_for_the_same_seller(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableBkash($owner);
        $orderA = $this->createOrder('shopa', 'offer', $product->id);
        $orderB = $this->createOrder('shopa', 'offer', $product->id);

        $trx = 'TRX-REPLAY-1';
        $this->submitClaim('shopa', 'offer', $orderA, ['customer_trx_id' => $trx])->assertCreated();
        $response = $this->submitClaim('shopa', 'offer', $orderB, ['customer_trx_id' => $trx]);

        $response->assertStatus(422);
        $this->assertSame(1, OrderOnlinePayment::where('customer_trx_id', $trx)->count());
    }

    public function test_verify_approve_cascades_into_payment_accounting_and_status(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableBkash($owner);
        $order = $this->createOrder('shopa', 'offer', $product->id);
        $this->submitClaim('shopa', 'offer', $order)->assertCreated();
        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();

        Sanctum::actingAs($owner);
        $response = $this->postJson("/api/online-payments/{$claim->id}/verify", ['approve' => true, 'amount' => 580]);

        $response->assertOk();

        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);
        $this->assertEquals(580.0, $order->paidAmount());

        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id,
            'source' => 'online_wallet',
            'method' => 'bkash',
        ]);
        $this->assertDatabaseHas('transactions', [
            'reference_type' => 'order_payment',
            'category' => 'order_online_payment',
        ]);

        $claim->refresh();
        $this->assertSame('verified', $claim->status);
        $this->assertNotNull($claim->order_payment_id);
    }

    public function test_verify_reject_leaves_order_due_and_allows_resubmission(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableBkash($owner);
        $order = $this->createOrder('shopa', 'offer', $product->id);
        $this->submitClaim('shopa', 'offer', $order, ['customer_trx_id' => 'TRX-FIRST'])->assertCreated();
        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();

        Sanctum::actingAs($owner);
        $this->postJson("/api/online-payments/{$claim->id}/verify", ['approve' => false, 'note' => 'blurry screenshot'])
            ->assertOk();

        $order->refresh();
        $this->assertSame('pending', $order->status);
        $this->assertSame('due', $order->payment_status);
        $this->assertDatabaseMissing('order_payments', ['order_id' => $order->id]);

        // Customer can submit a fresh claim (different trx id) after a rejection.
        $this->submitClaim('shopa', 'offer', $order, ['customer_trx_id' => 'TRX-SECOND'])->assertCreated();
    }

    public function test_approve_uses_the_sellers_manually_entered_amount_not_the_customers_claim(): void
    {
        // Customer claims the full order total, but the seller only
        // actually received a partial amount — the seller's own entry at
        // approve time is what gets recorded, never the claim blindly.
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableBkash($owner);
        $order = $this->createOrder('shopa', 'offer', $product->id);
        $this->submitClaim('shopa', 'offer', $order)->assertCreated(); // claims 580
        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();

        Sanctum::actingAs($owner);
        $this->postJson("/api/online-payments/{$claim->id}/verify", ['approve' => true, 'amount' => 300])
            ->assertOk();

        $order->refresh();
        $this->assertEquals(300.0, $order->paidAmount());
        $this->assertSame('partial', $order->payment_status);
        $this->assertDatabaseHas('order_payments', ['order_id' => $order->id, 'amount' => 300]);
    }

    public function test_approve_without_an_amount_is_rejected(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableBkash($owner);
        $order = $this->createOrder('shopa', 'offer', $product->id);
        $this->submitClaim('shopa', 'offer', $order)->assertCreated();
        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();

        Sanctum::actingAs($owner);
        $this->postJson("/api/online-payments/{$claim->id}/verify", ['approve' => true])
            ->assertStatus(422);

        $this->assertDatabaseMissing('order_payments', ['order_id' => $order->id]);
    }

    public function test_otp_is_not_required_when_customer_picked_an_online_payment_channel(): void
    {
        [$owner, $page, $product] = $this->shopWithPage();
        $this->enableBkash($owner);
        LandingPage::where('id', $page->id)->update([
            'content' => ['settings' => ['otp_verification_enabled' => true]],
        ]);

        $response = $this->postJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/order", [
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'customer_address' => 'Dhanmondi, Dhaka',
            'payment_method' => 'bkash',
            'items' => [['enabled' => true, 'product_id' => $product->id, 'quantity' => 1]],
        ]);
        $response->assertCreated();

        $order = Order::findOrFail($response->json('data.order_id'));
        $this->assertFalse((bool) $order->otp_required);
    }

    public function test_pending_verification_list_does_not_leak_another_shops_claims(): void
    {
        [$ownerA, $pageA, $productA] = $this->shopWithPage('shopa');
        $this->enableBkash($ownerA);
        $orderA = $this->createOrder('shopa', 'offer', $productA->id);
        $this->submitClaim('shopa', 'offer', $orderA)->assertCreated();

        $ownerB = User::factory()->create();

        Sanctum::actingAs($ownerB);
        $response = $this->getJson('/api/online-payments/pending-verification');

        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }
}
