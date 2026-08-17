<?php

namespace Tests\Feature;

use App\Models\PaymentGatewaySetting;
use App\Models\StaffPermission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Seller-facing online-payment channel configuration — see
 * online_payment_context.md. Mirrors CourierController's settings
 * endpoints' own test coverage shape.
 */
class PaymentGatewaySettingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_get_settings_when_none_exist_returns_null_data(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $response = $this->getJson('/api/payment-gateway-settings');

        $response->assertOk();
        $this->assertNull($response->json('data'));
    }

    public function test_save_and_get_settings_roundtrip_with_masking(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $this->putJson('/api/payment-gateway-settings', [
            'bkash_personal_enabled' => true,
            'bkash_personal_number' => '01799990000',
            'sslcommerz_enabled' => true,
            'sslcommerz_store_id' => 'store12345',
            'sslcommerz_store_password' => 'secretpass123',
        ])->assertOk();

        $setting = PaymentGatewaySetting::where('user_id', $owner->id)->firstOrFail();
        // Stored value is not the plaintext we sent — encrypted cast round-trips.
        $this->assertNotSame('secretpass123', $setting->getRawOriginal('sslcommerz_store_password'));
        $this->assertSame('secretpass123', $setting->sslcommerz_store_password);

        $response = $this->getJson('/api/payment-gateway-settings');
        $response->assertOk();
        $this->assertTrue($response->json('data.bkash_personal_enabled'));
        $this->assertSame('01799990000', $response->json('data.bkash_personal_number'));
        // Secret comes back masked, never in full.
        $this->assertStringContainsString('*', $response->json('data.sslcommerz_store_password'));
        $this->assertStringStartsWith('secr', $response->json('data.sslcommerz_store_password'));
    }

    public function test_saving_a_masked_placeholder_value_does_not_overwrite_the_real_secret(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $this->putJson('/api/payment-gateway-settings', [
            'sslcommerz_store_password' => 'realsecret1',
        ])->assertOk();

        // Re-save with the masked placeholder the GET response would show —
        // must not clobber the real stored value (same convention as
        // CourierController::saveSettings()'s masked-value skip).
        $this->putJson('/api/payment-gateway-settings', [
            'sslcommerz_store_password' => 'real****',
        ])->assertOk();

        $setting = PaymentGatewaySetting::where('user_id', $owner->id)->firstOrFail();
        $this->assertSame('realsecret1', $setting->sslcommerz_store_password);
    }

    public function test_staff_without_payments_permission_is_denied(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);

        Sanctum::actingAs($staff);
        $response = $this->getJson('/api/payment-gateway-settings');

        $response->assertStatus(403);
        $this->assertSame('staff_permission_denied', $response->json('error_code'));
    }

    public function test_staff_with_payments_permission_is_allowed(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'payments', 'enabled' => true]);

        Sanctum::actingAs($staff);
        $response = $this->getJson('/api/payment-gateway-settings');

        $response->assertOk();
    }
}
