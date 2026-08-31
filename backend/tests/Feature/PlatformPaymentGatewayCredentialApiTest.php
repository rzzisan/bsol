<?php

namespace Tests\Feature;

use App\Models\PlatformPaymentGatewayCredential;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin CRUD for platform-wide merchant-gateway credentials — see
 * online_payment_context.md §12. Mirrors PaymentGatewayCredentialApiTest's
 * shape (the seller-facing equivalent), minus the per-user scoping.
 */
class PlatformPaymentGatewayCredentialApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_non_admin_cannot_access_platform_gateway_settings(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/admin/platform-payment-gateways')->assertStatus(403);
    }

    public function test_index_returns_supported_providers_and_empty_credentials(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $response = $this->getJson('/api/admin/platform-payment-gateways');

        $response->assertOk();
        foreach (['sslcommerz', 'aamarpay', 'zinipay', 'shurjopay', 'eps', 'bkash_merchant', 'nagad_merchant'] as $provider) {
            $this->assertContains($provider, $response->json('data.supported_providers'));
        }
        $this->assertSame([], $response->json('data.credentials'));
    }

    public function test_save_and_roundtrip_with_masking(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->putJson('/api/admin/platform-payment-gateways/sslcommerz', [
            'enabled' => true,
            'is_live' => false,
            'credentials' => ['store_id' => 'platformstore', 'store_password' => 'platformsecret'],
        ])->assertOk();

        $row = PlatformPaymentGatewayCredential::where('provider', 'sslcommerz')->firstOrFail();
        $this->assertTrue($row->enabled);
        $this->assertSame('platformsecret', $row->credentials['store_password']);
        $this->assertNotSame('platformsecret', $row->getRawOriginal('credentials'));

        $response = $this->getJson('/api/admin/platform-payment-gateways');
        $masked = collect($response->json('data.credentials'))->firstWhere('provider', 'sslcommerz');
        $this->assertStringContainsString('*', $masked['credentials']['store_password']);
    }

    public function test_re_saving_without_touching_a_masked_field_keeps_the_existing_value(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->putJson('/api/admin/platform-payment-gateways/eps', [
            'enabled' => true,
            'credentials' => ['merchant_id' => 'M1', 'store_id' => 'S1', 'username' => 'u', 'password' => 'p', 'hash_key' => 'h'],
        ])->assertOk();

        // Re-save with a masked placeholder for password — must not overwrite it.
        $this->putJson('/api/admin/platform-payment-gateways/eps', [
            'enabled' => true,
            'credentials' => ['merchant_id' => 'M1', 'store_id' => 'S1', 'username' => 'u', 'password' => 'p***', 'hash_key' => 'h'],
        ])->assertOk();

        $row = PlatformPaymentGatewayCredential::where('provider', 'eps')->firstOrFail();
        $this->assertSame('p', $row->credentials['password']);
    }

    public function test_unknown_provider_is_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->putJson('/api/admin/platform-payment-gateways/unknown-provider', ['enabled' => true])
            ->assertStatus(404);
    }
}
