<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PlatformApiKey;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConnectApiTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: User, 1: string} */
    private function connectedMerchant(array $userAttrs = []): array
    {
        $user = User::factory()->create($userAttrs);
        $rawKey = PlatformApiKey::generateRawKey();

        PlatformApiKey::create([
            'user_id'    => $user->id,
            'platform'   => 'woocommerce',
            'domain'     => 'myshop.com',
            'key_hash'   => PlatformApiKey::hashKey($rawKey),
            'key_prefix' => substr($rawKey, 0, 12),
            'status'     => 'connected',
        ]);

        return [$user, $rawKey];
    }

    private function connectHeaders(string $rawKey, string $domain = 'myshop.com'): array
    {
        return ['X-API-KEY' => $rawKey, 'X-Client-Domain' => $domain];
    }

    private function samplePayload(string $wcOrderId = 'wc-1001'): array
    {
        return [
            'wc_order_id' => $wcOrderId,
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01755443322',
            'customer_address' => 'Dhanmondi, Dhaka',
            'payment_method' => 'cod',
            'is_paid' => false,
            'shipping_charge' => 60,
            'discount' => 0,
            'line_items' => [
                ['name' => 'T-Shirt (M)', 'quantity' => 2, 'total' => 900, 'sku' => 'TS-M'],
            ],
        ];
    }

    // ── Auth failures ────────────────────────────────────────────────────────

    public function test_missing_api_key_is_rejected(): void
    {
        $this->postJson('/api/connect/v1/connect', [], ['X-Client-Domain' => 'myshop.com'])
            ->assertStatus(401)
            ->assertJsonPath('error_code', 'missing_api_key');
    }

    public function test_invalid_api_key_is_rejected(): void
    {
        $this->postJson('/api/connect/v1/connect', [], $this->connectHeaders('bsol_not-a-real-key'))
            ->assertStatus(401)
            ->assertJsonPath('error_code', 'invalid_api_key');
    }

    public function test_revoked_key_is_rejected(): void
    {
        [, $rawKey] = $this->connectedMerchant();
        PlatformApiKey::query()->update(['status' => 'revoked']);

        $this->postJson('/api/connect/v1/connect', [], $this->connectHeaders($rawKey))
            ->assertStatus(401)
            ->assertJsonPath('error_code', 'key_revoked');
    }

    public function test_domain_mismatch_is_rejected(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $this->postJson('/api/connect/v1/connect', [], $this->connectHeaders($rawKey, 'someone-elses-shop.com'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'domain_mismatch');
    }

    // ── Connect handshake ────────────────────────────────────────────────────

    public function test_connect_succeeds_with_valid_key_and_domain(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $this->postJson('/api/connect/v1/connect', [], $this->connectHeaders($rawKey))
            ->assertOk()
            ->assertJsonPath('data.domain', 'myshop.com')
            ->assertJsonPath('data.platform', 'woocommerce')
            ->assertJsonPath('data.subscription_active', true);
    }

    public function test_disconnect_revokes_the_key(): void
    {
        [, $rawKey] = $this->connectedMerchant();
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/disconnect', [], $headers)
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('platform_api_keys', ['status' => 'revoked']);

        // The same (now-revoked) key can no longer authenticate.
        $this->postJson('/api/connect/v1/connect', [], $headers)
            ->assertStatus(401)
            ->assertJsonPath('error_code', 'key_revoked');
    }

    // ── Order sync ───────────────────────────────────────────────────────────

    public function test_orders_sync_creates_new_order(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();

        $response = $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload(), $this->connectHeaders($rawKey));

        $response->assertCreated()
            ->assertJsonPath('data.source', 'woocommerce')
            ->assertJsonPath('data.source_ref', 'wc-1001')
            ->assertJsonPath('data.customer_phone', '01755443322');

        $this->assertDatabaseHas('orders', [
            'user_id' => $user->id,
            'source' => 'woocommerce',
            'source_ref' => 'wc-1001',
        ]);
    }

    public function test_orders_sync_upserts_same_order_on_repeat_call(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload(), $headers)->assertCreated();
        $this->assertSame(1, Order::where('user_id', $user->id)->count());

        $updated = $this->samplePayload();
        $updated['customer_address'] = 'Gulshan, Dhaka';

        $this->postJson('/api/connect/v1/orders/sync', $updated, $headers)
            ->assertOk()
            ->assertJsonPath('data.customer_address', 'Gulshan, Dhaka');

        // Still exactly one order — the second call updated, not duplicated.
        $this->assertSame(1, Order::where('user_id', $user->id)->count());
    }

    public function test_orders_sync_status_transitions_order_and_logs(): void
    {
        [, $rawKey] = $this->connectedMerchant();
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload(), $headers)->assertCreated();

        $this->postJson('/api/connect/v1/orders/sync-status', [
            'wc_order_id' => 'wc-1001',
            'status' => 'confirmed',
            'note' => 'Payment confirmed in WooCommerce.',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed');

        $order = Order::where('source_ref', 'wc-1001')->firstOrFail();
        $this->assertSame('confirmed', $order->status);

        $this->assertDatabaseHas('order_status_logs', [
            'order_id' => $order->id,
            'old_status' => 'pending',
            'new_status' => 'confirmed',
        ]);
    }

    public function test_orders_sync_status_returns_404_for_unknown_wc_order_id(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $this->postJson('/api/connect/v1/orders/sync-status', [
            'wc_order_id' => 'does-not-exist',
            'status' => 'confirmed',
        ], $this->connectHeaders($rawKey))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'order_not_found');
    }

    public function test_monthly_order_limit_is_enforced_through_the_connector(): void
    {
        $package = SubscriptionPackage::create([
            'name' => 'Starter', 'slug' => 'starter', 'price' => 500,
            'duration_days' => 30, 'max_orders' => 1, 'is_active' => true,
        ]);
        [, $rawKey] = $this->connectedMerchant(['subscription_package_id' => $package->id]);
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload('wc-1'), $headers)->assertCreated();

        $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload('wc-2'), $headers)
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'order_limit_reached');
    }

    // ── Fraud check ──────────────────────────────────────────────────────────

    public function test_fraud_check_phone_matches_dashboard_response_shape(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $response = $this->postJson('/api/connect/v1/fraud/check-phone', [
            'phone_number' => '01755443322',
        ], $this->connectHeaders($rawKey));

        $response->assertOk()->assertJsonStructure([
            'success',
            'data' => ['phone', 'fraud_score', 'risk_level', 'is_blacklisted', 'stats', 'shared', 'orders'],
        ]);
    }

    // ── Subscription gating ─────────────────────────────────────────────────

    public function test_connect_still_succeeds_but_sync_and_fraud_check_are_blocked_when_subscription_expired(): void
    {
        [, $rawKey] = $this->connectedMerchant(['subscription_status' => 'expired']);
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/connect', [], $headers)
            ->assertOk()
            ->assertJsonPath('data.subscription_active', false);

        $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload(), $headers)
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'subscription_expired');

        $this->postJson('/api/connect/v1/fraud/check-phone', ['phone_number' => '01755443322'], $headers)
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'subscription_expired');
    }
}
