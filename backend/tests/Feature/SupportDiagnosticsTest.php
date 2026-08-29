<?php

namespace Tests\Feature;

use App\Models\AbandonedCheckout;
use App\Models\Order;
use App\Models\PlatformApiKey;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\SmsCredit;
use App\Models\SmsGateway;
use App\Models\SmsHistory;
use App\Models\User;
use App\Services\Support\SupportDiagnosticsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Instant problem diagnosis — support_ticketing_ai_context.md. Every check
 * returns plain facts; these tests just confirm the facts are the right
 * ones, not any prose/verdict (the model does that part).
 */
class SupportDiagnosticsTest extends TestCase
{
    use RefreshDatabase;

    private function diagnostics(): SupportDiagnosticsService
    {
        return app(SupportDiagnosticsService::class);
    }

    // -- Orders -----------------------------------------------------------

    public function test_no_new_orders_reports_an_unconfigured_storefront_and_empty_catalog(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $result = $this->diagnostics()->diagnoseNoNewOrders($seller);

        $this->assertFalse($result['storefront_subdomain_configured']);
        $this->assertSame('none', $result['storefront_subdomain_status']);
        $this->assertSame(0, $result['active_products_visible_in_storefront']);
        $this->assertNull($result['last_order_at']);
    }

    public function test_no_new_orders_reports_a_healthy_storefront_and_recent_activity(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        ShopProfile::create([
            'user_id' => $seller->id, 'shop_name' => 'Test Shop', 'phone' => '01700000000', 'address' => 'Dhaka',
            'subdomain' => 'testshop', 'subdomain_status' => 'active',
        ]);
        Product::factory()->count(2)->create(['user_id' => $seller->id, 'status' => 'active', 'show_in_storefront' => true]);
        // Eloquent stamps created_at itself on save(), overriding whatever's
        // passed to create() — force it after the fact to actually backdate.
        Order::create([
            'user_id' => $seller->id, 'order_number' => 'ORD-'.uniqid(), 'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Test Customer', 'customer_phone' => '01700000000',
            'subtotal' => 100, 'shipping_charge' => 0, 'discount' => 0, 'total' => 100,
            'status' => 'pending', 'payment_method' => 'cod', 'payment_status' => 'due',
        ])->forceFill(['created_at' => now()->subDay()])->save();
        AbandonedCheckout::create([
            'user_id' => $seller->id, 'source' => 'woocommerce', 'session_token' => 'diag-test-session',
            'status' => 'active', 'last_activity_at' => now(), 'created_at' => now()->subDays(2),
        ]);

        $result = $this->diagnostics()->diagnoseNoNewOrders($seller);

        $this->assertTrue($result['storefront_subdomain_configured']);
        $this->assertSame('active', $result['storefront_subdomain_status']);
        $this->assertSame(2, $result['active_products_visible_in_storefront']);
        $this->assertSame(1, $result['days_since_last_order']);
        $this->assertSame(1, $result['abandoned_checkouts_last_7_days']);
    }

    // -- SMS ----------------------------------------------------------------

    public function test_sms_diagnosis_flags_no_active_platform_gateway(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $result = $this->diagnostics()->diagnoseSmsNotSending($seller);

        $this->assertFalse($result['platform_sms_gateway_active']);
        $this->assertSame(0, $result['sms_credit_balance']);
        $this->assertCount(0, $result['recent_failed_sends']);
    }

    public function test_sms_diagnosis_surfaces_credit_balance_and_recent_failures(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        SmsGateway::create(['name' => 'Test Gateway', 'provider' => 'custom', 'is_active' => true, 'is_enabled' => true]);
        SmsCredit::create(['user_id' => $seller->id, 'balance' => 42]);
        SmsHistory::create([
            'user_id' => $seller->id, 'phone_number' => '01700000000', 'message' => 'x',
            'status' => 'failed', 'error_message' => 'Invalid sender ID', 'gateway_name' => 'Test',
        ]);

        $result = $this->diagnostics()->diagnoseSmsNotSending($seller);

        $this->assertTrue($result['platform_sms_gateway_active']);
        $this->assertSame(42, $result['sms_credit_balance']);
        $this->assertCount(1, $result['recent_failed_sends']);
        $this->assertSame('Invalid sender ID', $result['recent_failed_sends'][0]['error_message']);
    }

    // -- WordPress ------------------------------------------------------------

    public function test_wordpress_diagnosis_reports_no_key_generated(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $result = $this->diagnostics()->diagnoseWordpressNotConnecting($seller);

        $this->assertFalse($result['api_key_generated']);
    }

    public function test_wordpress_diagnosis_reports_a_pending_never_connected_key(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        PlatformApiKey::create([
            'user_id' => $seller->id, 'platform' => 'woocommerce', 'domain' => 'example.com',
            'key_hash' => hash('sha256', 'x'), 'key_prefix' => 'bsol_', 'status' => 'pending',
        ]);

        $result = $this->diagnostics()->diagnoseWordpressNotConnecting($seller);

        $this->assertTrue($result['api_key_generated']);
        $this->assertSame('pending', $result['status']);
        $this->assertNull($result['last_used_at']);
    }
}
