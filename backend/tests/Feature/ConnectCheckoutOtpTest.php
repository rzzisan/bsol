<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PhoneOtpVerification;
use App\Models\PlatformApiKey;
use App\Models\SmsCredit;
use App\Models\SmsGateway;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Phase 9 — checkout OTP generalized to WooCommerce. Covers the new
 * ConnectCheckoutOtpController (verify/resend, delegating to
 * CheckoutOtpService's shared state machine) and the otp_verification_enabled
 * toggle's effect on ConnectOrderController::sync().
 */
class ConnectCheckoutOtpTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: User, 1: string, 2: PlatformApiKey} */
    private function connectedMerchant(array $keyOverrides = []): array
    {
        $user = User::factory()->create();
        $rawKey = PlatformApiKey::generateRawKey();

        $apiKey = PlatformApiKey::create(array_merge([
            'user_id'    => $user->id,
            'platform'   => 'woocommerce',
            'domain'     => 'myshop.com',
            'key_hash'   => PlatformApiKey::hashKey($rawKey),
            'key_prefix' => substr($rawKey, 0, 12),
            'status'     => 'connected',
        ], $keyOverrides));

        return [$user, $rawKey, $apiKey];
    }

    private function connectHeaders(string $rawKey, string $domain = 'myshop.com'): array
    {
        return ['X-API-KEY' => $rawKey, 'X-Client-Domain' => $domain];
    }

    private function orderWithOtp(User $user, array $otpOverrides = []): array
    {
        // findOrder() in ConnectCheckoutOtpController scopes by the
        // requesting site's platform_api_key_id (Phase 16) — every caller
        // here only ever creates one key per merchant via connectedMerchant(),
        // so resolving it is unambiguous.
        $apiKey = PlatformApiKey::where('user_id', $user->id)->first();

        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01755443322',
            'source' => 'woocommerce',
            'source_ref' => 'wc-order-1',
            'platform_api_key_id' => $apiKey?->id,
            'total' => 500,
            'status' => 'pending',
            'otp_required' => true,
        ]);

        $otp = PhoneOtpVerification::create(array_merge([
            'token' => $order->public_token,
            'order_id' => $order->id,
            'mobile' => '8801755443322',
            'otp_code' => '1234',
            'purpose' => 'checkout_verification',
            'attempts' => 0,
            'resend_count' => 0,
            'expires_at' => now()->addMinutes(5),
        ], $otpOverrides));

        return [$order, $otp];
    }

    // ── verify() ─────────────────────────────────────────────────────────

    public function test_verify_succeeds_and_confirms_the_order(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        [$order, $otp] = $this->orderWithOtp($user);

        $response = $this->postJson('/api/connect/v1/orders/verify-otp', [
            'wc_order_id' => 'wc-order-1',
            'otp_code' => '1234',
        ], $this->connectHeaders($rawKey));

        $response->assertOk()->assertJsonPath('data.otp_verified', true)->assertJsonPath('data.status', 'confirmed');

        $this->assertNotNull($order->fresh()->otp_verified_at);
        $this->assertNotNull($otp->fresh()->verified_at);
    }

    public function test_verify_wrong_code_returns_remaining_attempts(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        [, $otp] = $this->orderWithOtp($user);

        $response = $this->postJson('/api/connect/v1/orders/verify-otp', [
            'wc_order_id' => 'wc-order-1',
            'otp_code' => '9999',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(422)->assertJsonPath('remaining_attempts', 4);
        $this->assertSame(1, $otp->fresh()->attempts);
    }

    public function test_verify_expired_session_returns_a_clear_message(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->orderWithOtp($user, ['expires_at' => now()->subMinute()]);

        $response = $this->postJson('/api/connect/v1/orders/verify-otp', [
            'wc_order_id' => 'wc-order-1',
            'otp_code' => '1234',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(422)->assertJsonPath('message', 'OTP-এর মেয়াদ শেষ হয়ে গেছে। আবার পাঠান।');
    }

    public function test_verify_max_attempts_reached(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->orderWithOtp($user, ['attempts' => 5]);

        $response = $this->postJson('/api/connect/v1/orders/verify-otp', [
            'wc_order_id' => 'wc-order-1',
            'otp_code' => '1234',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(422)->assertJsonPath('message', 'সর্বোচ্চ চেষ্টার সীমা শেষ। আবার পাঠান।');
    }

    public function test_verify_returns_order_not_found_for_unknown_wc_order_id(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $response = $this->postJson('/api/connect/v1/orders/verify-otp', [
            'wc_order_id' => 'no-such-order',
            'otp_code' => '1234',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(404)->assertJsonPath('error_code', 'order_not_found');
    }

    // ── resend() ─────────────────────────────────────────────────────────

    public function test_resend_respects_the_cooldown(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->orderWithOtp($user, ['next_resend_at' => now()->addMinutes(2)]);

        Http::fake();

        $response = $this->postJson('/api/connect/v1/orders/resend-otp', [
            'wc_order_id' => 'wc-order-1',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(429)->assertJsonStructure(['retry_after_seconds']);
        Http::assertNothingSent();
    }

    // ── sync() OTP trigger ───────────────────────────────────────────────

    private function usableSmsGateway(User $user): void
    {
        $gateway = SmsGateway::create([
            'name' => 'Test Gateway',
            'provider' => 'khudebarta',
            'endpoint_url' => 'https://sms.example.com/send',
            'api_key' => 'key',
            'secret_key' => 'secret',
            'sender_id' => 'BSOL',
            'is_active' => true,
            'is_enabled' => true,
        ]);
        $user->update(['sms_gateway_id' => $gateway->id]);
        SmsCredit::create(['user_id' => $user->id, 'balance' => 1000]);
    }

    public function test_sync_sends_otp_when_the_connection_has_it_enabled(): void
    {
        [$user, $rawKey] = $this->connectedMerchant(['otp_verification_enabled' => true]);
        $this->usableSmsGateway($user);

        Http::fake(['sms.example.com/*' => Http::response('OK', 200)]);

        $response = $this->postJson('/api/connect/v1/orders/sync', [
            'wc_order_id' => 'wc-order-otp',
            'customer_phone' => '01755443322',
            'line_items' => [['name' => 'T-Shirt', 'quantity' => 1, 'total' => 500]],
        ], $this->connectHeaders($rawKey));

        $response->assertCreated()->assertJsonPath('data.otp_required', true);

        $order = Order::where('user_id', $user->id)->where('source_ref', 'wc-order-otp')->firstOrFail();
        $this->assertTrue((bool) $order->otp_required);
        $this->assertDatabaseHas('phone_otp_verifications', [
            'order_id' => $order->id,
            'purpose' => 'checkout_verification',
        ]);
    }

    public function test_sync_does_not_send_otp_when_the_connection_has_it_disabled(): void
    {
        [$user, $rawKey] = $this->connectedMerchant(); // otp_verification_enabled defaults false
        $this->usableSmsGateway($user);

        Http::fake();

        $response = $this->postJson('/api/connect/v1/orders/sync', [
            'wc_order_id' => 'wc-order-no-otp',
            'customer_phone' => '01755443322',
            'line_items' => [['name' => 'T-Shirt', 'quantity' => 1, 'total' => 500]],
        ], $this->connectHeaders($rawKey));

        $response->assertCreated()->assertJsonPath('data.otp_required', false);

        Http::assertNothingSent();
        $this->assertDatabaseCount('phone_otp_verifications', 0);
    }
}
