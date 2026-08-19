<?php

namespace Tests\Feature;

use App\Models\PaymentGatewayCredential;
use App\Models\StaffPermission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase B/C merchant-gateway credential settings — see
 * online_payment_context.md. Mirrors PaymentGatewaySettingApiTest's shape.
 */
class PaymentGatewayCredentialApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_supported_providers_and_empty_credentials(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $response = $this->getJson('/api/payment-gateway-credentials');

        $response->assertOk();
        $this->assertContains('sslcommerz', $response->json('data.supported_providers'));
        $this->assertContains('aamarpay', $response->json('data.supported_providers'));
        $this->assertContains('zinipay', $response->json('data.supported_providers'));
        $this->assertContains('shurjopay', $response->json('data.supported_providers'));
        $this->assertSame([], $response->json('data.credentials'));
    }

    public function test_save_and_roundtrip_with_masking(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $this->putJson('/api/payment-gateway-credentials/sslcommerz', [
            'enabled' => true,
            'is_live' => false,
            'credentials' => ['store_id' => 'mystore123', 'store_password' => 'mysecret456'],
        ])->assertOk();

        $row = PaymentGatewayCredential::where('user_id', $owner->id)->where('provider', 'sslcommerz')->firstOrFail();
        $this->assertTrue($row->enabled);
        $this->assertSame('mysecret456', $row->credentials['store_password']);
        // Encrypted at rest — the raw column is not the plaintext.
        $this->assertNotSame('mysecret456', $row->getRawOriginal('credentials'));

        $response = $this->getJson('/api/payment-gateway-credentials');
        $masked = collect($response->json('data.credentials'))->firstWhere('provider', 'sslcommerz');
        $this->assertStringContainsString('*', $masked['credentials']['store_password']);

        // Test AamarPay and ZiniPay saving
        $this->putJson('/api/payment-gateway-credentials/aamarpay', [
            'enabled' => true,
            'is_live' => false,
            'credentials' => ['store_id' => 'aamartest', 'signature_key' => 'sigsecret123'],
        ])->assertOk();
        $aamarRow = PaymentGatewayCredential::where('user_id', $owner->id)->where('provider', 'aamarpay')->firstOrFail();
        $this->assertSame('sigsecret123', $aamarRow->credentials['signature_key']);

        $this->putJson('/api/payment-gateway-credentials/zinipay', [
            'enabled' => true,
            'is_live' => true,
            'credentials' => ['api_key' => 'zini_live_secret_456'],
        ])->assertOk();
        $ziniRow = PaymentGatewayCredential::where('user_id', $owner->id)->where('provider', 'zinipay')->firstOrFail();
        $this->assertSame('zini_live_secret_456', $ziniRow->credentials['api_key']);

        // Test ShurjoPay saving
        $this->putJson('/api/payment-gateway-credentials/shurjopay', [
            'enabled' => true,
            'is_live' => false,
            'credentials' => ['username' => 'sp_user', 'password' => 'sp_secret_pass', 'prefix' => 'NOK'],
        ])->assertOk();
        $shurjoRow = PaymentGatewayCredential::where('user_id', $owner->id)->where('provider', 'shurjopay')->firstOrFail();
        $this->assertSame('sp_secret_pass', $shurjoRow->credentials['password']);
        $this->assertSame('NOK', $shurjoRow->credentials['prefix']);
    }

    public function test_saving_a_masked_placeholder_does_not_overwrite_the_real_secret(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $this->putJson('/api/payment-gateway-credentials/sslcommerz', [
            'credentials' => ['store_id' => 'store1', 'store_password' => 'realsecret1'],
        ])->assertOk();

        $this->putJson('/api/payment-gateway-credentials/sslcommerz', [
            'credentials' => ['store_password' => 'real****'],
        ])->assertOk();

        $row = PaymentGatewayCredential::where('user_id', $owner->id)->where('provider', 'sslcommerz')->firstOrFail();
        $this->assertSame('realsecret1', $row->credentials['store_password']);
        $this->assertSame('store1', $row->credentials['store_id']);
    }

    public function test_unknown_provider_404s(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $this->putJson('/api/payment-gateway-credentials/not-a-real-gateway', ['enabled' => true])
            ->assertStatus(404);
    }

    public function test_staff_without_payments_permission_is_denied(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);

        Sanctum::actingAs($staff);
        $this->getJson('/api/payment-gateway-credentials')->assertStatus(403);
    }

    public function test_staff_with_payments_permission_is_allowed(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'payments', 'enabled' => true]);

        Sanctum::actingAs($staff);
        $this->getJson('/api/payment-gateway-credentials')->assertOk();
    }
}
