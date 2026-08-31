<?php

namespace Tests\Feature;

use App\Models\AddonPackage;
use App\Models\AddonPurchase;
use App\Models\PlatformGatewayPayment;
use App\Models\PlatformPaymentGatewayCredential;
use App\Models\SmsCreditSetting;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Seller→platform automated gateway payments across all 4 billing surfaces
 * (subscription, sms_credit, order_credit, storefront_addon) — the
 * "fast-follow" every one of those controllers' docblocks flagged as
 * deliberately deferred. See online_payment_context.md §12.
 */
class PlatformGatewayPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    private function enableSslcommerz(): void
    {
        PlatformPaymentGatewayCredential::create([
            'provider' => 'sslcommerz',
            'enabled' => true,
            'is_live' => false,
            'credentials' => ['store_id' => 'platformstore', 'store_password' => 'platformsecret'],
        ]);
    }

    private function seller(): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Starter', 'slug' => 'starter-' . uniqid(), 'price' => 500, 'duration_days' => 30,
        ]);

        return User::factory()->create(['subscription_package_id' => $package->id]);
    }

    public function test_channels_endpoint_reflects_enabled_and_configured_credentials(): void
    {
        Sanctum::actingAs($this->seller());

        $this->getJson('/api/platform-gateway-payments/channels')->assertOk()->assertJson(['data' => []]);

        $this->enableSslcommerz();

        $response = $this->getJson('/api/platform-gateway-payments/channels');
        $this->assertSame(['sslcommerz'], collect($response->json('data'))->pluck('provider')->all());
    }

    public function test_a_credential_row_with_missing_fields_does_not_appear_as_available(): void
    {
        PlatformPaymentGatewayCredential::create([
            'provider' => 'sslcommerz', 'enabled' => true,
            'credentials' => ['store_id' => '', 'store_password' => ''],
        ]);
        Sanctum::actingAs($this->seller());

        $this->assertSame([], $this->getJson('/api/platform-gateway-payments/channels')->json('data'));
    }

    public function test_initiate_rejects_a_disabled_provider(): void
    {
        Sanctum::actingAs($this->seller());

        $this->postJson('/api/platform-gateway-payments/subscription/initiate', ['provider' => 'sslcommerz'])
            ->assertStatus(422);
    }

    private function fakeCreatePayment(): void
    {
        Http::fake(['*/gwprocess/v4/api.php' => Http::response([
            'status' => 'SUCCESS', 'sessionkey' => 'S1',
            'GatewayPageURL' => 'https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=PAY&SESSIONKEY=S1',
        ])]);
    }

    private function fakeVerify(string $tranId, string $amount): void
    {
        Http::fake(['*/validator/api/validationserverAPI.php*' => Http::response([
            'status' => 'VALID', 'tran_id' => $tranId, 'amount' => $amount, 'bank_tran_id' => 'BANK1',
        ])]);
    }

    public function test_subscription_gateway_payment_activates_the_subscription(): void
    {
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->enableSslcommerz();

        $package = SubscriptionPackage::create([
            'name' => 'Growth', 'slug' => 'growth-' . uniqid(), 'price' => 1200, 'duration_days' => 30,
        ]);

        $this->fakeCreatePayment();
        $init = $this->postJson('/api/platform-gateway-payments/subscription/initiate', [
            'provider' => 'sslcommerz', 'package_id' => $package->id,
        ])->assertOk();
        $this->assertStringContainsString('sandbox.sslcommerz.com', $init->json('data.redirect_url'));

        $claim = PlatformGatewayPayment::where('purpose', 'subscription')->where('user_id', $seller->id)->firstOrFail();
        $this->assertSame('initiated', $claim->status);
        $this->assertEquals(1200.0, (float) $claim->amount);

        $tranId = $claim->provider_payment_id;
        $this->fakeVerify($tranId, '1200.00');

        $callback = $this->get("/api/platform-gateway-payments/subscription/sslcommerz/callback/{$claim->id}?val_id=VAL1&status=VALID&tran_id={$tranId}");
        $this->assertStringContainsString('payment_result=success', $callback->headers->get('Location'));

        $claim->refresh();
        $this->assertSame('completed', $claim->status);

        $payment = SubscriptionPayment::whereKey($claim->payable_id)->firstOrFail();
        $this->assertSame('approved', $payment->status);

        $seller->refresh();
        $this->assertSame($package->id, $seller->subscription_package_id);
        $this->assertSame('active', $seller->subscription_status);
    }

    public function test_sms_credit_gateway_payment_recharges_the_wallet(): void
    {
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->enableSslcommerz();

        $rate = (float) SmsCreditSetting::getSetting()->rate_per_credit;
        $expectedAmount = round(1000 * $rate, 2);

        $this->fakeCreatePayment();
        $init = $this->postJson('/api/platform-gateway-payments/sms_credit/initiate', [
            'provider' => 'sslcommerz', 'credits' => 1000,
        ])->assertOk();
        $this->assertNotEmpty($init->json('data.redirect_url'));

        $claim = PlatformGatewayPayment::where('purpose', 'sms_credit')->where('user_id', $seller->id)->firstOrFail();
        $this->assertEquals($expectedAmount, (float) $claim->amount);

        $tranId = $claim->provider_payment_id;
        $this->fakeVerify($tranId, number_format($expectedAmount, 2, '.', ''));

        $this->get("/api/platform-gateway-payments/sms_credit/sslcommerz/callback/{$claim->id}?val_id=VAL1&status=VALID&tran_id={$tranId}")
            ->assertRedirect();

        $this->assertSame('completed', $claim->fresh()->status);
        $this->assertSame(1000, \App\Models\SmsCredit::walletFor($seller->id)->balance);
    }

    public function test_order_credit_addon_gateway_payment_grants_credits(): void
    {
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->enableSslcommerz();

        $addonPackage = AddonPackage::create([
            'type' => 'order_credit', 'name' => 'Pack A', 'price' => 300,
            'quantity' => 50, 'duration_days' => 30, 'is_active' => true,
        ]);

        $this->fakeCreatePayment();
        $init = $this->postJson('/api/platform-gateway-payments/order_credit/initiate', [
            'provider' => 'sslcommerz', 'addon_package_id' => $addonPackage->id,
        ])->assertOk();
        $this->assertNotEmpty($init->json('data.redirect_url'));

        $claim = PlatformGatewayPayment::where('purpose', 'order_credit')->where('user_id', $seller->id)->firstOrFail();
        $tranId = $claim->provider_payment_id;
        $this->fakeVerify($tranId, '300.00');

        $this->get("/api/platform-gateway-payments/order_credit/sslcommerz/callback/{$claim->id}?val_id=VAL1&status=VALID&tran_id={$tranId}")
            ->assertRedirect();

        $purchase = AddonPurchase::whereKey($claim->fresh()->payable_id)->firstOrFail();
        $this->assertSame('approved', $purchase->status);
        $this->assertNotNull($purchase->applied_at);
        $this->assertEquals(50, \App\Models\OrderCreditWallet::walletFor($seller->id)->availableBalance());
    }

    public function test_storefront_addon_gateway_payment_activates_the_addon(): void
    {
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->enableSslcommerz();

        $seller->update(['subscription_ends_at' => now()->addDays(20), 'subscription_status' => 'active']);

        $addonPackage = AddonPackage::create([
            'type' => 'storefront', 'name' => 'Storefront Unlock', 'price' => 400,
            'quantity' => 0, 'duration_days' => 0, 'is_active' => true,
        ]);

        $this->fakeCreatePayment();
        $this->postJson('/api/platform-gateway-payments/storefront_addon/initiate', [
            'provider' => 'sslcommerz', 'addon_package_id' => $addonPackage->id,
        ])->assertOk();

        $claim = PlatformGatewayPayment::where('purpose', 'storefront_addon')->where('user_id', $seller->id)->firstOrFail();
        $tranId = $claim->provider_payment_id;
        $this->fakeVerify($tranId, '400.00');

        $this->get("/api/platform-gateway-payments/storefront_addon/sslcommerz/callback/{$claim->id}?val_id=VAL1&status=VALID&tran_id={$tranId}")
            ->assertRedirect();

        $this->assertTrue((new \App\Services\StorefrontAddonService())->hasActiveAddon($seller->fresh()));
    }

    public function test_verify_always_uses_our_own_stored_provider_payment_id_not_the_callback(): void
    {
        // A spoofed tran_id in the callback query string must not let a
        // different, unrelated transaction's verify response confirm this
        // claim — same discipline proven for the customer-facing gateways.
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->enableSslcommerz();

        $package = SubscriptionPackage::create([
            'name' => 'Growth2', 'slug' => 'growth2-' . uniqid(), 'price' => 900, 'duration_days' => 30,
        ]);

        $this->fakeCreatePayment();
        $this->postJson('/api/platform-gateway-payments/subscription/initiate', [
            'provider' => 'sslcommerz', 'package_id' => $package->id,
        ])->assertOk();

        $claim = PlatformGatewayPayment::where('purpose', 'subscription')->where('user_id', $seller->id)->firstOrFail();
        $realTranId = $claim->provider_payment_id;

        // SSLCommerz's validator responds VALID but for a DIFFERENT tran_id
        // than ours — verifyPayment() must reject this as a mismatch.
        Http::fake(['*/validator/api/validationserverAPI.php*' => Http::response([
            'status' => 'VALID', 'tran_id' => 'SOMEONE-ELSES-TRAN-ID', 'amount' => '900.00', 'bank_tran_id' => 'BANK1',
        ])]);

        $callback = $this->get("/api/platform-gateway-payments/subscription/sslcommerz/callback/{$claim->id}?val_id=VAL1&status=VALID&tran_id=SPOOFED-{$realTranId}");
        $this->assertStringContainsString('payment_result=failed', $callback->headers->get('Location'));

        $this->assertSame('failed', $claim->fresh()->status);
        $this->assertSame('rejected', SubscriptionPayment::whereKey($claim->payable_id)->firstOrFail()->status);
        $seller->refresh();
        $this->assertNotSame($package->id, $seller->subscription_package_id);
    }

    public function test_a_second_callback_for_an_already_completed_claim_is_a_no_op(): void
    {
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->enableSslcommerz();

        $rate = (float) SmsCreditSetting::getSetting()->rate_per_credit;
        $amount = round(500 * $rate, 2);

        $this->fakeCreatePayment();
        $this->postJson('/api/platform-gateway-payments/sms_credit/initiate', [
            'provider' => 'sslcommerz', 'credits' => 500,
        ])->assertOk();

        $claim = PlatformGatewayPayment::where('purpose', 'sms_credit')->where('user_id', $seller->id)->firstOrFail();
        $tranId = $claim->provider_payment_id;
        $this->fakeVerify($tranId, number_format($amount, 2, '.', ''));

        $this->get("/api/platform-gateway-payments/sms_credit/sslcommerz/callback/{$claim->id}?val_id=VAL1&status=VALID&tran_id={$tranId}")
            ->assertRedirect();
        $this->assertSame(500, \App\Models\SmsCredit::walletFor($seller->id)->balance);

        // IPN racing in afterwards for the same already-completed claim.
        $this->postJson('/api/platform-gateway-payments/sslcommerz/ipn', ['val_id' => 'VAL1', 'status' => 'VALID', 'tran_id' => $tranId])
            ->assertOk();

        $this->assertSame(500, \App\Models\SmsCredit::walletFor($seller->id)->fresh()->balance);
    }
}
