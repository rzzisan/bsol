<?php

namespace Tests\Feature;

use App\Jobs\AutoRechargeSmsCreditJob;
use App\Models\PlatformBillingSetting;
use App\Models\SavedPaymentMethod;
use App\Models\SmsCredit;
use App\Models\SubscriptionPackage;
use App\Models\User;
use App\Services\NotificationDispatchService;
use App\Services\Payment\BkashPaymentGatewayClient;
use App\Services\SmsCreditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * SMS-credit auto-recharge — connect/settings/callback (controller), the
 * deduct()-triggered dispatch (SmsCreditService), and the charge/circuit-
 * breaker job (AutoRechargeSmsCreditJob). See auto_top_up_context.md.
 */
class SmsCreditAutoRechargeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // The create_platform_billing_settings_table migration itself
        // inserts the singleton row (id=1) — PlatformBillingSetting::getSetting()
        // always returns the lowest-id row, so update it in place rather
        // than create() a second row (which would just sit there unused).
        PlatformBillingSetting::getSetting()->update([
            'bkash_app_key' => 'key', 'bkash_app_secret' => 'secret',
            'bkash_username' => 'user', 'bkash_password' => 'pass',
            'bkash_sandbox' => true,
        ]);
    }

    private function owner(): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0, 'duration_days' => 30,
        ]);

        return User::factory()->create(['subscription_package_id' => $package->id]);
    }

    private function fakeTokenGrant(): array
    {
        return ['*/tokenized/checkout/token/grant' => Http::response(['id_token' => 'tok', 'expires_in' => 3300])];
    }

    // ── createAgreement / callback (controller) ───────────────────────────

    public function test_create_agreement_returns_redirect_url_and_creates_pending_row(): void
    {
        $user = $this->owner();
        Sanctum::actingAs($user);

        Http::fake($this->fakeTokenGrant() + [
            '*/tokenized/checkout/create' => Http::response(['paymentID' => 'PAY123', 'bkashURL' => 'https://bkash.example/pay']),
        ]);

        $response = $this->postJson('/api/sms/credit/auto-recharge/agreement/create');

        $response->assertOk()->assertJson(['success' => true, 'data' => ['bkash_url' => 'https://bkash.example/pay']]);

        $method = SavedPaymentMethod::where('user_id', $user->id)->where('provider', 'bkash')->first();
        $this->assertNotNull($method);
        $this->assertSame('pending', $method->status);
        $this->assertSame('PAY123', $method->pending_payment_id);
    }

    public function test_callback_success_activates_agreement(): void
    {
        $user = $this->owner();
        SavedPaymentMethod::create([
            'user_id' => $user->id, 'provider' => 'bkash',
            'pending_payment_id' => 'PAY123', 'status' => 'pending',
        ]);

        Http::fake($this->fakeTokenGrant() + [
            '*/tokenized/checkout/execute' => Http::response(['agreementID' => 'AGR1', 'agreementStatus' => 'Completed']),
        ]);

        $response = $this->get('/api/sms/credit/auto-recharge/agreement/callback?paymentID=PAY123&status=success');

        $response->assertRedirect();
        $this->assertStringContainsString('bkash_agreement=success', $response->headers->get('Location'));

        $method = SavedPaymentMethod::where('user_id', $user->id)->first();
        $this->assertSame('active', $method->status);
        $this->assertNull($method->pending_payment_id);
        $this->assertSame('AGR1', $method->agreement_id); // decrypted on read via the encrypted cast
    }

    public function test_callback_non_success_status_marks_failed(): void
    {
        $user = $this->owner();
        SavedPaymentMethod::create([
            'user_id' => $user->id, 'provider' => 'bkash',
            'pending_payment_id' => 'PAY123', 'status' => 'pending',
        ]);

        $response = $this->get('/api/sms/credit/auto-recharge/agreement/callback?paymentID=PAY123&status=cancel');

        $this->assertStringContainsString('bkash_agreement=cancelled', $response->headers->get('Location'));
        $this->assertSame('failed', SavedPaymentMethod::where('user_id', $user->id)->first()->status);
    }

    public function test_callback_with_unknown_payment_id_redirects_to_error_without_touching_any_row(): void
    {
        $response = $this->get('/api/sms/credit/auto-recharge/agreement/callback?paymentID=UNKNOWN&status=success');

        $this->assertStringContainsString('bkash_agreement=error', $response->headers->get('Location'));
        $this->assertSame(0, SavedPaymentMethod::count());
    }

    // ── settings ───────────────────────────────────────────────────────────

    public function test_enabling_auto_recharge_without_a_connected_method_is_rejected(): void
    {
        $user = $this->owner();
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/sms/credit/auto-recharge/settings', [
            'enabled' => true, 'threshold' => 10, 'credits' => 100,
        ]);

        $response->assertStatus(422);
        $this->assertFalse(SmsCredit::walletFor($user->id)->fresh()->auto_recharge_enabled);
    }

    public function test_enabling_auto_recharge_with_a_connected_method_succeeds(): void
    {
        $user = $this->owner();
        Sanctum::actingAs($user);
        SavedPaymentMethod::create([
            'user_id' => $user->id, 'provider' => 'bkash', 'agreement_id' => 'AGR1', 'status' => 'active',
        ]);

        $response = $this->putJson('/api/sms/credit/auto-recharge/settings', [
            'enabled' => true, 'threshold' => 10, 'credits' => 100,
        ]);

        $response->assertOk()->assertJson(['success' => true]);
        $wallet = SmsCredit::walletFor($user->id)->fresh();
        $this->assertTrue($wallet->auto_recharge_enabled);
        $this->assertSame(10, $wallet->auto_recharge_threshold);
        $this->assertSame(100, $wallet->auto_recharge_credits);
    }

    public function test_staff_cannot_reach_auto_recharge_settings(): void
    {
        $owner = $this->owner();
        $staff = User::factory()->create(['owner_id' => $owner->id]);
        Sanctum::actingAs($staff);

        $this->getJson('/api/sms/credit/auto-recharge/settings')->assertStatus(403);
    }

    // ── SmsCreditService::deduct() trigger ──────────────────────────────────

    private function enabledWalletWithActiveMethod(int $balance, int $threshold, int $credits): SmsCredit
    {
        $user = $this->owner();
        SavedPaymentMethod::create([
            'user_id' => $user->id, 'provider' => 'bkash', 'agreement_id' => 'AGR1', 'status' => 'active',
        ]);

        return SmsCredit::create([
            'user_id' => $user->id, 'balance' => $balance,
            'auto_recharge_enabled' => true, 'auto_recharge_threshold' => $threshold,
            'auto_recharge_credits' => $credits,
        ]);
    }

    public function test_deduct_dispatches_job_once_balance_drops_to_or_under_threshold(): void
    {
        Queue::fake();
        $wallet = $this->enabledWalletWithActiveMethod(balance: 15, threshold: 10, credits: 100);

        $ok = app(SmsCreditService::class)->deduct($wallet->user_id, 10);

        $this->assertTrue($ok);
        Queue::assertPushed(AutoRechargeSmsCreditJob::class, 1);
    }

    public function test_deduct_does_not_dispatch_job_while_balance_stays_above_threshold(): void
    {
        Queue::fake();
        $wallet = $this->enabledWalletWithActiveMethod(balance: 50, threshold: 10, credits: 100);

        app(SmsCreditService::class)->deduct($wallet->user_id, 5);

        Queue::assertNotPushed(AutoRechargeSmsCreditJob::class);
    }

    public function test_deduct_does_not_dispatch_job_when_auto_recharge_disabled(): void
    {
        Queue::fake();
        $wallet = $this->enabledWalletWithActiveMethod(balance: 15, threshold: 10, credits: 100);
        $wallet->update(['auto_recharge_enabled' => false]);

        app(SmsCreditService::class)->deduct($wallet->user_id, 10);

        Queue::assertNotPushed(AutoRechargeSmsCreditJob::class);
    }

    public function test_deduct_respects_cooldown_and_does_not_double_dispatch(): void
    {
        Queue::fake();
        $wallet = $this->enabledWalletWithActiveMethod(balance: 15, threshold: 10, credits: 100);
        $wallet->update(['auto_recharge_last_attempted_at' => now()->subMinutes(2)]);

        app(SmsCreditService::class)->deduct($wallet->user_id, 1);

        Queue::assertNotPushed(AutoRechargeSmsCreditJob::class);
    }

    // ── AutoRechargeSmsCreditJob ─────────────────────────────────────────

    public function test_job_success_recharges_wallet_and_resets_failure_count(): void
    {
        $wallet = $this->enabledWalletWithActiveMethod(balance: 5, threshold: 10, credits: 100);
        $wallet->update(['auto_recharge_failure_count' => 2]);

        Http::fake($this->fakeTokenGrant() + [
            '*/tokenized/checkout/create' => Http::response(['paymentID' => 'PAY2']),
            '*/tokenized/checkout/execute' => Http::response(['trxID' => 'TRX1', 'transactionStatus' => 'Completed']),
        ]);

        $this->runJob($wallet->user_id);

        $fresh = $wallet->fresh();
        $this->assertSame(105, $fresh->balance);
        $this->assertSame(0, $fresh->auto_recharge_failure_count);
        $this->assertNotNull($fresh->auto_recharge_last_attempted_at);
    }

    public function test_job_failure_increments_failure_count_without_touching_balance(): void
    {
        $wallet = $this->enabledWalletWithActiveMethod(balance: 5, threshold: 10, credits: 100);

        Http::fake($this->fakeTokenGrant() + [
            '*/tokenized/checkout/create' => Http::response([], 500),
        ]);

        $this->runJob($wallet->user_id);

        $fresh = $wallet->fresh();
        $this->assertSame(5, $fresh->balance);
        $this->assertSame(1, $fresh->auto_recharge_failure_count);
        $this->assertTrue($fresh->auto_recharge_enabled);
    }

    public function test_job_disables_auto_recharge_after_three_consecutive_failures(): void
    {
        $wallet = $this->enabledWalletWithActiveMethod(balance: 5, threshold: 10, credits: 100);

        Http::fake($this->fakeTokenGrant() + [
            '*/tokenized/checkout/create' => Http::response([], 500),
        ]);

        $this->runJob($wallet->user_id);
        $this->runJob($wallet->user_id);
        $this->runJob($wallet->user_id);

        $fresh = $wallet->fresh();
        $this->assertSame(3, $fresh->auto_recharge_failure_count);
        $this->assertFalse($fresh->auto_recharge_enabled);
    }

    public function test_job_is_a_no_op_when_balance_already_recovered_before_it_runs(): void
    {
        $wallet = $this->enabledWalletWithActiveMethod(balance: 5, threshold: 10, credits: 100);
        $wallet->update(['balance' => 500]); // manually topped up between dispatch and run

        Http::fake($this->fakeTokenGrant() + [
            '*/tokenized/checkout/create' => Http::response(['paymentID' => 'PAY2']),
        ]);

        $this->runJob($wallet->user_id);

        Http::assertNothingSent();
        $this->assertSame(500, $wallet->fresh()->balance);
    }

    private function runJob(int $userId): void
    {
        (new AutoRechargeSmsCreditJob($userId))->handle(
            app(BkashPaymentGatewayClient::class),
            app(SmsCreditService::class),
            app(NotificationDispatchService::class),
        );
    }
}
