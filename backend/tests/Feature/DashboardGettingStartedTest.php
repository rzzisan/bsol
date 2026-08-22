<?php

namespace Tests\Feature;

use App\Models\CourierSetting;
use App\Models\PaymentGatewayCredential;
use App\Models\PaymentGatewaySetting;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Onboarding "Getting Started" checklist — production_audit_report_context.md
 * §7 (P1) / onboarding_checklist_context.md. Every step is derived live from
 * real data, never stored — these tests exercise that derivation directly.
 */
class DashboardGettingStartedTest extends TestCase
{
    use RefreshDatabase;

    private function ownerWithProfile(): User
    {
        $owner = User::factory()->create();
        ShopProfile::create([
            'user_id' => $owner->id,
            'shop_name' => 'Shop',
            'phone' => '01711223344',
            'address' => 'Dhaka',
            'subdomain' => 'shop' . $owner->id,
            'subdomain_status' => 'active',
        ]);

        return $owner;
    }

    private function steps(array $data): array
    {
        return collect($data['steps'])->pluck('done', 'key')->all();
    }

    public function test_fresh_shop_has_every_actionable_step_incomplete(): void
    {
        $owner = $this->ownerWithProfile();
        Sanctum::actingAs($owner);

        $res = $this->getJson('/api/dashboard/getting-started')->assertOk();
        $steps = $this->steps($res->json('data'));

        $this->assertTrue($steps['profile']);
        $this->assertFalse($steps['product']);
        $this->assertFalse($steps['courier']);
        $this->assertFalse($steps['payment']);
        $this->assertFalse($res->json('data.dismissed'));
        $this->assertNotNull($res->json('data.shop_url'));
    }

    public function test_a_real_product_flips_the_product_step_but_a_demo_product_does_not(): void
    {
        $owner = $this->ownerWithProfile();
        Sanctum::actingAs($owner);

        Product::factory()->create(['user_id' => $owner->id, 'is_demo' => true]);
        $steps = $this->steps($this->getJson('/api/dashboard/getting-started')->json('data'));
        $this->assertFalse($steps['product']);

        Product::factory()->create(['user_id' => $owner->id, 'is_demo' => false]);
        $steps = $this->steps($this->getJson('/api/dashboard/getting-started')->json('data'));
        $this->assertTrue($steps['product']);
    }

    public function test_courier_step_flips_once_any_provider_key_is_saved(): void
    {
        $owner = $this->ownerWithProfile();
        Sanctum::actingAs($owner);

        CourierSetting::create(['user_id' => $owner->id, 'redx_api_key' => 'a-key']);
        $steps = $this->steps($this->getJson('/api/dashboard/getting-started')->json('data'));
        $this->assertTrue($steps['courier']);
    }

    public function test_payment_step_flips_via_either_personal_wallet_or_a_gateway_credential(): void
    {
        $owner = $this->ownerWithProfile();
        Sanctum::actingAs($owner);

        PaymentGatewaySetting::create(['user_id' => $owner->id, 'bkash_personal_enabled' => true, 'bkash_personal_number' => '01711223344']);
        $steps = $this->steps($this->getJson('/api/dashboard/getting-started')->json('data'));
        $this->assertTrue($steps['payment']);

        $owner2 = $this->ownerWithProfile();
        Sanctum::actingAs($owner2);
        PaymentGatewayCredential::create(['user_id' => $owner2->id, 'provider' => 'sslcommerz', 'enabled' => true, 'credentials' => []]);
        $steps = $this->steps($this->getJson('/api/dashboard/getting-started')->json('data'));
        $this->assertTrue($steps['payment']);
    }

    public function test_dismiss_persists(): void
    {
        $owner = $this->ownerWithProfile();
        Sanctum::actingAs($owner);

        $this->postJson('/api/dashboard/getting-started/dismiss')->assertOk();
        $this->assertTrue($this->getJson('/api/dashboard/getting-started')->json('data.dismissed'));
    }

    public function test_staff_cannot_reach_the_checklist(): void
    {
        $owner = $this->ownerWithProfile();
        $staff = User::factory()->create(['owner_id' => $owner->id]);
        Sanctum::actingAs($staff);

        $this->getJson('/api/dashboard/getting-started')->assertStatus(403);
    }

    public function test_demo_product_create_is_idempotent_and_never_shows_on_the_storefront_or_order_bootstrap(): void
    {
        $owner = $this->ownerWithProfile();
        Sanctum::actingAs($owner);

        $first = $this->postJson('/api/dashboard/getting-started/demo-products')->assertOk();
        $this->assertSame(3, $first->json('data.created'));
        $this->assertSame(3, Product::where('user_id', $owner->id)->where('is_demo', true)->count());

        // Second click while demo data already exists creates nothing new.
        $second = $this->postJson('/api/dashboard/getting-started/demo-products')->assertOk();
        $this->assertSame(0, $second->json('data.created'));
        $this->assertSame(3, Product::where('user_id', $owner->id)->where('is_demo', true)->count());

        // Structurally invisible: status=inactive keeps it out of both
        // real-world surfaces that could expose a product to a customer.
        $apex = config('app.subdomain_apex');
        $this->getJson("https://shop{$owner->id}.{$apex}/api/public/storefront/products")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $bootstrap = $this->getJson('/api/orders/create/bootstrap')->assertOk();
        $names = collect($bootstrap->json('data.products'))->pluck('name');
        $this->assertTrue($names->every(fn ($n) => ! str_starts_with($n, 'ডেমো')));
    }

    public function test_delete_demo_products_removes_only_demo_rows(): void
    {
        $owner = $this->ownerWithProfile();
        Sanctum::actingAs($owner);

        $this->postJson('/api/dashboard/getting-started/demo-products')->assertOk();
        Product::factory()->create(['user_id' => $owner->id, 'is_demo' => false]);

        $this->deleteJson('/api/dashboard/getting-started/demo-products')
            ->assertOk()
            ->assertJsonPath('data.deleted', 3);

        $this->assertSame(0, Product::where('user_id', $owner->id)->where('is_demo', true)->count());
        $this->assertSame(1, Product::where('user_id', $owner->id)->count());
    }
}
