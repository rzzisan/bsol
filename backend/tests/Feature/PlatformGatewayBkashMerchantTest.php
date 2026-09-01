<?php

namespace Tests\Feature;

use App\Models\PlatformBillingSetting;
use App\Models\PlatformGatewayPayment;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * §13.2 consolidation — bKash Merchant now lives entirely inside the
 * unified platform-gateway-payments system instead of being a second,
 * separately-configured integration (BkashPaymentController/
 * BkashPgwPaymentController and friends, now removed). Credentials still
 * live in PlatformBillingSetting (shared with SMS-credit auto-recharge's
 * Agreement API — see PlatformGatewayPaymentService's class docblock), but
 * both the Tokenized (redirect) and PGW (widget) variants are reachable
 * only through platform-gateway-payments/* now. See online_payment_context.md §13.2.
 */
class PlatformGatewayBkashMerchantTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    private function seller(): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Starter', 'slug' => 'starter-' . uniqid(), 'price' => 500, 'duration_days' => 30,
        ]);

        return User::factory()->create(['subscription_package_id' => $package->id]);
    }

    private function configureBkash(string $apiType): void
    {
        PlatformBillingSetting::getSetting()->update([
            'bkash_app_key' => 'appkey123',
            'bkash_app_secret' => 'appsecret123',
            'bkash_username' => 'user123',
            'bkash_password' => 'pass123',
            'bkash_sandbox' => true,
            'bkash_api_type' => $apiType,
        ]);
    }

    // ── Channels reflect PlatformBillingSetting, not platform_payment_gateway_credentials ──

    public function test_bkash_merchant_channel_appears_once_billing_settings_are_configured(): void
    {
        Sanctum::actingAs($this->seller());

        $this->getJson('/api/platform-gateway-payments/channels')->assertOk()->assertJson(['data' => []]);

        $this->configureBkash('tokenized');

        $response = $this->getJson('/api/platform-gateway-payments/channels');
        $channel = collect($response->json('data'))->firstWhere('provider', 'bkash_merchant');
        $this->assertNotNull($channel);
        $this->assertSame('tokenized', $channel['api_type']);
    }

    public function test_bkash_merchant_channel_reports_pgw_api_type_and_script_url(): void
    {
        Sanctum::actingAs($this->seller());
        $this->configureBkash('pgw');

        $response = $this->getJson('/api/platform-gateway-payments/channels');
        $channel = collect($response->json('data'))->firstWhere('provider', 'bkash_merchant');
        $this->assertSame('pgw', $channel['api_type']);
        $this->assertStringContainsString('bka.sh', $channel['script_url']);
    }

    public function test_platform_payment_gateway_credentials_no_longer_accepts_bkash_merchant(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $response = $this->getJson('/api/admin/platform-payment-gateways');
        $this->assertNotContains('bkash_merchant', $response->json('data.supported_providers'));

        $this->putJson('/api/admin/platform-payment-gateways/bkash_merchant', ['enabled' => true])
            ->assertStatus(404);
    }

    // ── Tokenized (redirect) — goes through the exact same generic initiate()/completeCallback() path ──

    public function test_tokenized_bkash_merchant_initiate_and_successful_callback_activates_subscription(): void
    {
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->configureBkash('tokenized');

        $package = SubscriptionPackage::create([
            'name' => 'Growth', 'slug' => 'growth-' . uniqid(), 'price' => 1000, 'duration_days' => 30,
        ]);

        Http::fake([
            '*/tokenized/checkout/token/grant' => Http::response(['id_token' => 'TOKEN1', 'expires_in' => 3300]),
            '*/tokenized/checkout/create' => Http::response(['paymentID' => 'PID123', 'bkashURL' => 'https://tokenized.sandbox.bka.sh/pay/PID123']),
        ]);

        $init = $this->postJson('/api/platform-gateway-payments/subscription/initiate', [
            'provider' => 'bkash_merchant', 'package_id' => $package->id,
        ])->assertOk();
        $this->assertStringContainsString('bka.sh', $init->json('data.redirect_url'));

        $claim = PlatformGatewayPayment::where('provider', 'bkash_merchant')->where('user_id', $seller->id)->firstOrFail();
        $this->assertSame('PID123', $claim->provider_payment_id);

        Http::fake([
            '*/tokenized/checkout/token/grant' => Http::response(['id_token' => 'TOKEN1', 'expires_in' => 3300]),
            '*/tokenized/checkout/execute' => Http::response(['trxID' => 'TRX999', 'transactionStatus' => 'Completed', 'amount' => '1000']),
        ]);

        $callback = $this->get("/api/platform-gateway-payments/subscription/bkash_merchant/callback/{$claim->id}?paymentID=PID123&status=success");
        $this->assertStringContainsString('payment_result=success', $callback->headers->get('Location'));

        $this->assertSame('completed', $claim->fresh()->status);
        $payment = SubscriptionPayment::whereKey($claim->payable_id)->firstOrFail();
        $this->assertSame('approved', $payment->status);
        $seller->refresh();
        $this->assertSame($package->id, $seller->subscription_package_id);
    }

    public function test_tokenized_bkash_merchant_is_unavailable_when_configured_for_pgw_instead(): void
    {
        // Generic redirect-based initiate() must reject bkash_merchant when
        // it's actually configured as PGW — that variant has no redirect_url
        // at all and must go through the dedicated widget endpoints.
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->configureBkash('pgw');

        $package = SubscriptionPackage::create([
            'name' => 'Growth2', 'slug' => 'growth2-' . uniqid(), 'price' => 800, 'duration_days' => 30,
        ]);

        $this->postJson('/api/platform-gateway-payments/subscription/initiate', [
            'provider' => 'bkash_merchant', 'package_id' => $package->id,
        ])->assertStatus(422);
    }

    // ── PGW (widget) — the two dedicated create/execute endpoints, generalized across purposes ──

    public function test_bkash_pgw_create_and_execute_activates_subscription(): void
    {
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->configureBkash('pgw');

        $package = SubscriptionPackage::create([
            'name' => 'PgwPlan', 'slug' => 'pgwplan-' . uniqid(), 'price' => 1200, 'duration_days' => 30,
        ]);

        Http::fake([
            '*/checkout/token/grant' => Http::response(['id_token' => 'PGWTOKEN', 'expires_in' => 3300]),
            '*/checkout/payment/create' => Http::response(['paymentID' => 'PGWPID1']),
        ]);

        $create = $this->postJson('/api/platform-gateway-payments/subscription/bkash-pgw/create', [
            'package_id' => $package->id,
        ])->assertOk();
        $this->assertSame('PGWPID1', $create->json('paymentID'));

        $claim = PlatformGatewayPayment::where('provider', 'bkash_merchant')->where('user_id', $seller->id)->firstOrFail();
        $this->assertSame('initiated', $claim->status);
        $this->assertEquals(1200.0, (float) $claim->amount);

        Http::fake([
            '*/checkout/token/grant' => Http::response(['id_token' => 'PGWTOKEN', 'expires_in' => 3300]),
            '*/checkout/payment/execute/*' => Http::response(['trxID' => 'PGWTRX1', 'transactionStatus' => 'Completed', 'amount' => '1200']),
        ]);

        $execute = $this->postJson('/api/platform-gateway-payments/subscription/bkash-pgw/execute/PGWPID1')->assertOk();
        $this->assertSame('Completed', $execute->json('transactionStatus'));
        $this->assertSame('PGWTRX1', $execute->json('trxID'));

        $this->assertSame('completed', $claim->fresh()->status);
        $payment = SubscriptionPayment::whereKey($claim->payable_id)->firstOrFail();
        $this->assertSame('approved', $payment->status);
        $seller->refresh();
        $this->assertSame($package->id, $seller->subscription_package_id);
    }

    public function test_bkash_pgw_execute_is_idempotent(): void
    {
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->configureBkash('pgw');

        $package = SubscriptionPackage::create([
            'name' => 'PgwPlan2', 'slug' => 'pgwplan2-' . uniqid(), 'price' => 700, 'duration_days' => 30,
        ]);

        Http::fake([
            '*/checkout/token/grant' => Http::response(['id_token' => 'PGWTOKEN', 'expires_in' => 3300]),
            '*/checkout/payment/create' => Http::response(['paymentID' => 'PGWPID2']),
        ]);
        $this->postJson('/api/platform-gateway-payments/subscription/bkash-pgw/create', ['package_id' => $package->id])->assertOk();

        Http::fake([
            '*/checkout/token/grant' => Http::response(['id_token' => 'PGWTOKEN', 'expires_in' => 3300]),
            '*/checkout/payment/execute/*' => Http::response(['trxID' => 'PGWTRX2', 'transactionStatus' => 'Completed', 'amount' => '700']),
        ]);
        $this->postJson('/api/platform-gateway-payments/subscription/bkash-pgw/execute/PGWPID2')->assertOk();

        // Second execute call (widget retry / double-click) must not
        // re-execute against bKash or double-activate the subscription.
        Http::fake(); // any further HTTP call here would be unexpected
        $second = $this->postJson('/api/platform-gateway-payments/subscription/bkash-pgw/execute/PGWPID2')->assertOk();
        $this->assertSame('Completed', $second->json('transactionStatus'));
        $this->assertSame('PGWTRX2', $second->json('trxID'));
    }

    public function test_bkash_pgw_execute_cannot_be_used_to_touch_another_sellers_claim(): void
    {
        $seller = $this->seller();
        Sanctum::actingAs($seller);
        $this->configureBkash('pgw');

        $package = SubscriptionPackage::create([
            'name' => 'PgwPlan3', 'slug' => 'pgwplan3-' . uniqid(), 'price' => 600, 'duration_days' => 30,
        ]);

        Http::fake([
            '*/checkout/token/grant' => Http::response(['id_token' => 'PGWTOKEN', 'expires_in' => 3300]),
            '*/checkout/payment/create' => Http::response(['paymentID' => 'PGWPID3']),
        ]);
        $this->postJson('/api/platform-gateway-payments/subscription/bkash-pgw/create', ['package_id' => $package->id])->assertOk();

        $otherSeller = $this->seller();
        Sanctum::actingAs($otherSeller);

        $this->postJson('/api/platform-gateway-payments/subscription/bkash-pgw/execute/PGWPID3')->assertStatus(404);
    }
}
