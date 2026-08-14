<?php

namespace Tests\Feature;

use App\Models\PlatformApiKey;
use App\Models\SmsCredit;
use App\Models\SmsGateway;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ConnectSmsTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: User, 1: string} */
    private function connectedMerchant(array $userAttrs = []): array
    {
        $user = User::factory()->create($userAttrs);
        $rawKey = PlatformApiKey::generateRawKey();

        PlatformApiKey::create([
            'user_id' => $user->id,
            'platform' => 'woocommerce',
            'domain' => 'myshop.com',
            'key_hash' => PlatformApiKey::hashKey($rawKey),
            'key_prefix' => substr($rawKey, 0, 12),
            'status' => 'connected',
        ]);

        return [$user, $rawKey];
    }

    private function connectHeaders(string $rawKey, string $domain = 'myshop.com'): array
    {
        return ['X-API-KEY' => $rawKey, 'X-Client-Domain' => $domain];
    }

    private function assignGatewayAndCredit(User $user, int $balance = 1000): void
    {
        SmsGateway::create([
            'name' => 'Test Gateway', 'provider' => 'khudebarta',
            'endpoint_url' => 'https://sms.example.com/send', 'api_key' => 'key', 'secret_key' => 'secret',
            'sender_id' => 'BSOL', 'is_active' => true, 'is_enabled' => true,
        ]);
        $user->update(['sms_gateway_id' => SmsGateway::first()->id]);
        SmsCredit::create(['user_id' => $user->id, 'balance' => $balance]);
    }

    public function test_send_delegates_to_admin_sms_gateway_controller_and_succeeds(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->assignGatewayAndCredit($user);

        Http::fake(['sms.example.com/*' => Http::response('OK', 200)]);

        $response = $this->postJson('/api/connect/v1/sms/send', [
            'phone_number' => '01711223344',
            'message' => 'Your order has shipped.',
        ], $this->connectHeaders($rawKey));

        $response->assertOk()->assertJsonPath('success_count', 1);

        // AdminSmsGatewayController::send() normalizes to 880-prefixed
        // (no leading zero) before dispatching and logging.
        Http::assertSent(function ($request) {
            return $request->url() === 'https://sms.example.com/send'
                && $request['toUser'] === '8801711223344'
                && $request['messageContent'] === 'Your order has shipped.';
        });

        $this->assertDatabaseHas('sms_histories', [
            'user_id' => $user->id,
            'phone_number' => '8801711223344',
            'status' => 'sent',
        ]);
    }

    public function test_send_requires_phone_and_message(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $this->postJson('/api/connect/v1/sms/send', [], $this->connectHeaders($rawKey))
            ->assertStatus(422);
    }

    public function test_send_fails_cleanly_when_no_gateway_assigned(): void
    {
        [, $rawKey] = $this->connectedMerchant(); // no assignGatewayAndCredit() call

        $response = $this->postJson('/api/connect/v1/sms/send', [
            'phone_number' => '01711223344',
            'message' => 'Test',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(422)->assertJsonPath('message', 'No SMS gateway assigned. Please contact admin.');
    }

    public function test_send_respects_insufficient_credit(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->assignGatewayAndCredit($user, balance: 0);

        Http::fake(['sms.example.com/*' => Http::response('OK', 200)]);

        $response = $this->postJson('/api/connect/v1/sms/send', [
            'phone_number' => '01711223344',
            'message' => 'Test',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(402);
        Http::assertNothingSent();
    }

    public function test_send_is_scoped_to_the_authenticated_merchant_not_null_user(): void
    {
        // Regression guard for the $request->user() vs auth()->user() gotcha
        // documented on ConnectSmsController — a request with no explicit
        // user resolver set would silently resolve $actor to null inside
        // AdminSmsGatewayController::send(), which falls through the
        // "no gateway assigned" branch even for a merchant who HAS one.
        [$user, $rawKey] = $this->connectedMerchant();
        $this->assignGatewayAndCredit($user);

        Http::fake(['sms.example.com/*' => Http::response('OK', 200)]);

        $this->postJson('/api/connect/v1/sms/send', [
            'phone_number' => '01711223344',
            'message' => 'Test',
        ], $this->connectHeaders($rawKey))->assertOk();
    }
}
