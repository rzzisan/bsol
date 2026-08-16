<?php

namespace Tests\Feature;

use App\Jobs\SendFacebookCapiPurchaseEventJob;
use App\Models\AbandonedCheckout;
use App\Models\FacebookPixelSetting;
use App\Models\Order;
use App\Models\PlatformApiKey;
use App\Models\SmsCredit;
use App\Models\SmsGateway;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use ReflectionProperty;
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

    /**
     * Adds a second connected WooCommerce site for the same seller (Phase
     * 16 — a seller may have more than one). Returns the raw key + headers
     * for it, distinct from connectedMerchant()'s own 'myshop.com' key.
     *
     * @return array{0: string, 1: array}
     */
    private function secondSiteForMerchant(User $user, string $domain = 'second-shop.com'): array
    {
        $rawKey = PlatformApiKey::generateRawKey();

        PlatformApiKey::create([
            'user_id'    => $user->id,
            'platform'   => 'woocommerce',
            'domain'     => $domain,
            'key_hash'   => PlatformApiKey::hashKey($rawKey),
            'key_prefix' => substr($rawKey, 0, 12),
            'status'     => 'connected',
        ]);

        return [$rawKey, $this->connectHeaders($rawKey, $domain)];
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

    // ── Abandoned checkout conversion (Phase 17) ────────────────────────────

    public function test_orders_sync_converts_a_matching_abandoned_checkout_by_session_token(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $apiKey = PlatformApiKey::findByRawKey($rawKey);

        $checkout = AbandonedCheckout::create([
            'user_id' => $user->id,
            'source' => 'woocommerce',
            'platform_api_key_id' => $apiKey->id,
            'session_token' => 'checkout-sess-1',
            'customer_phone' => '01700000000', // deliberately different from the order's phone
            'status' => 'active',
            'last_activity_at' => now(),
        ]);

        $payload = $this->samplePayload();
        $payload['session_token'] = 'checkout-sess-1';

        $response = $this->postJson('/api/connect/v1/orders/sync', $payload, $this->connectHeaders($rawKey));
        $response->assertCreated();

        $checkout->refresh();
        $this->assertSame('converted', $checkout->status);
        $this->assertSame($response->json('data.id'), $checkout->order_id);
    }

    public function test_orders_sync_converts_a_matching_abandoned_checkout_by_phone_when_no_session_token(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $apiKey = PlatformApiKey::findByRawKey($rawKey);

        $checkout = AbandonedCheckout::create([
            'user_id' => $user->id,
            'source' => 'woocommerce',
            'platform_api_key_id' => $apiKey->id,
            'session_token' => 'some-other-session',
            'customer_phone' => '01755443322', // matches samplePayload()'s customer_phone
            'status' => 'active',
            'last_activity_at' => now(),
        ]);

        $response = $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload(), $this->connectHeaders($rawKey));
        $response->assertCreated();

        $checkout->refresh();
        $this->assertSame('converted', $checkout->status);
    }

    public function test_historical_order_sync_does_not_convert_an_abandoned_checkout(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $apiKey = PlatformApiKey::findByRawKey($rawKey);

        AbandonedCheckout::create([
            'user_id' => $user->id,
            'source' => 'woocommerce',
            'platform_api_key_id' => $apiKey->id,
            'session_token' => 'irrelevant',
            'customer_phone' => '01755443322',
            'status' => 'active',
            'last_activity_at' => now(),
        ]);

        $payload = $this->samplePayload();
        $payload['is_historical_sync'] = true;
        $this->postJson('/api/connect/v1/orders/sync', $payload, $this->connectHeaders($rawKey))->assertCreated();

        $this->assertDatabaseHas('abandoned_checkouts', ['customer_phone' => '01755443322', 'status' => 'active']);
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

    // ── Multi-site (Phase 16) ────────────────────────────────────────────────

    public function test_two_connected_sites_syncing_the_same_wc_order_id_create_two_distinct_orders(): void
    {
        [$user, $rawKeyA] = $this->connectedMerchant();
        [$rawKeyB, $headersB] = $this->secondSiteForMerchant($user);
        $headersA = $this->connectHeaders($rawKeyA);

        // Both sites independently number their own orders starting at "1" —
        // this must not collide, unlike a single shared (user_id, source_ref)
        // key would.
        $payload = $this->samplePayload('1');
        $this->postJson('/api/connect/v1/orders/sync', $payload, $headersA)->assertCreated();
        $this->postJson('/api/connect/v1/orders/sync', $payload, $headersB)->assertCreated();

        $this->assertSame(2, Order::where('user_id', $user->id)->where('source', 'woocommerce')->count());

        $keyA = PlatformApiKey::findByRawKey($rawKeyA);
        $keyB = PlatformApiKey::findByRawKey($rawKeyB);

        $this->assertDatabaseHas('orders', [
            'user_id' => $user->id, 'source_ref' => '1', 'platform_api_key_id' => $keyA->id,
        ]);
        $this->assertDatabaseHas('orders', [
            'user_id' => $user->id, 'source_ref' => '1', 'platform_api_key_id' => $keyB->id,
        ]);

        // Repeat-syncing the same wc_order_id on site A only updates site
        // A's order — site B's stays untouched, still exactly 2 total.
        $updated = $payload;
        $updated['customer_address'] = 'Updated address, site A only';
        $this->postJson('/api/connect/v1/orders/sync', $updated, $headersA)
            ->assertOk()
            ->assertJsonPath('data.customer_address', 'Updated address, site A only');

        $this->assertSame(2, Order::where('user_id', $user->id)->where('source', 'woocommerce')->count());
        $this->assertDatabaseHas('orders', [
            'platform_api_key_id' => $keyB->id, 'source_ref' => '1', 'customer_address' => 'Dhanmondi, Dhaka',
        ]);
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

    public function test_courier_health_returns_not_configured_cards_when_no_courier_credentials_exist(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $response = $this->postJson('/api/connect/v1/fraud/courier-health', [
            'phone_number' => '01755443322',
        ], $this->connectHeaders($rawKey));

        $response->assertOk()->assertJsonStructure([
            'success',
            'data' => ['phone', 'overall' => ['total', 'success', 'cancelled', 'success_rate'], 'couriers'],
        ]);
        $this->assertSame('not_configured', $response->json('data.couriers.0.status'));
        $this->assertSame(0, $response->json('data.overall.total'));
    }

    public function test_courier_health_rejects_invalid_phone_format(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $response = $this->postJson('/api/connect/v1/fraud/courier-health', [
            'phone_number' => 'not-a-phone',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(422)->assertJsonPath('success', false);
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

        $this->postJson('/api/connect/v1/fraud/courier-health', ['phone_number' => '01755443322'], $headers)
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'subscription_expired');
    }

    // ── Facebook CAPI (Phase 10) ─────────────────────────────────────────────

    public function test_sync_dispatches_capi_job_with_forwarded_ip_and_user_agent_on_create(): void
    {
        Queue::fake();
        [$user, $rawKey] = $this->connectedMerchant();

        $payload = $this->samplePayload('wc-capi-1');
        $payload['client_ip'] = '203.0.113.7';
        $payload['user_agent'] = 'Mozilla/5.0 (Test Browser)';
        $payload['event_source_url'] = 'https://myshop.com/checkout/';

        $this->postJson('/api/connect/v1/orders/sync', $payload, $this->connectHeaders($rawKey))->assertCreated();

        $order = Order::where('user_id', $user->id)->where('source_ref', 'wc-capi-1')->firstOrFail();

        Queue::assertPushed(
            SendFacebookCapiPurchaseEventJob::class,
            function ($job) use ($order) {
                return $this->jobProperty($job, 'orderId') === $order->id
                    && $this->jobProperty($job, 'clientIp') === '203.0.113.7'
                    && $this->jobProperty($job, 'userAgent') === 'Mozilla/5.0 (Test Browser)'
                    && $this->jobProperty($job, 'eventSourceUrl') === 'https://myshop.com/checkout/';
            }
        );
    }

    public function test_sync_dispatches_capi_job_with_domain_fallback_url_when_plugin_omits_it(): void
    {
        Queue::fake();
        [, $rawKey] = $this->connectedMerchant();

        $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload('wc-capi-2'), $this->connectHeaders($rawKey))
            ->assertCreated();

        Queue::assertPushed(
            SendFacebookCapiPurchaseEventJob::class,
            function ($job) {
                return $this->jobProperty($job, 'clientIp') === null
                    && $this->jobProperty($job, 'eventSourceUrl') === 'https://myshop.com/';
            }
        );
    }

    /**
     * fbp/fbc are persisted on the order itself (not threaded through the
     * job's constructor) so later order-flow events — which have no
     * checkout request behind them at all — can still carry them
     * (tracking_capi_context.md §11.4).
     */
    public function test_sync_persists_forwarded_fbp_and_fbc_onto_the_order(): void
    {
        Queue::fake();
        [$user, $rawKey] = $this->connectedMerchant();

        $payload = $this->samplePayload('wc-capi-4');
        $payload['fbp'] = 'fb.1.1700000000000.111';
        $payload['fbc'] = 'fb.1.1700000000000.222';

        $this->postJson('/api/connect/v1/orders/sync', $payload, $this->connectHeaders($rawKey))->assertCreated();

        $order = Order::where('user_id', $user->id)->where('source_ref', 'wc-capi-4')->firstOrFail();
        $this->assertSame('fb.1.1700000000000.111', $order->fbp);
        $this->assertSame('fb.1.1700000000000.222', $order->fbc);
    }

    public function test_sync_does_not_redispatch_capi_job_on_update(): void
    {
        Queue::fake();
        [, $rawKey] = $this->connectedMerchant();
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload('wc-capi-3'), $headers)->assertCreated();
        Queue::assertPushed(SendFacebookCapiPurchaseEventJob::class, 1);

        $updated = $this->samplePayload('wc-capi-3');
        $updated['is_paid'] = true;
        $this->postJson('/api/connect/v1/orders/sync', $updated, $headers)->assertOk();

        // Still exactly 1 — the update branch never dispatches again.
        Queue::assertPushed(SendFacebookCapiPurchaseEventJob::class, 1);
    }

    // ── Bulk/historical sync (Phase 11) ─────────────────────────────────────

    public function test_historical_sync_skips_otp_and_capi_even_when_both_are_configured(): void
    {
        Queue::fake();
        [$user, $rawKey] = $this->connectedMerchant();
        PlatformApiKey::where('user_id', $user->id)->update(['otp_verification_enabled' => true]);

        SmsGateway::create([
            'name' => 'Test Gateway', 'provider' => 'khudebarta',
            'endpoint_url' => 'https://sms.example.com/send', 'api_key' => 'key', 'secret_key' => 'secret',
            'sender_id' => 'BSOL', 'is_active' => true, 'is_enabled' => true,
        ]);
        $gatewayId = SmsGateway::first()->id;
        $user->update(['sms_gateway_id' => $gatewayId]);
        SmsCredit::create(['user_id' => $user->id, 'balance' => 1000]);

        FacebookPixelSetting::create([
            'user_id' => $user->id, 'pixel_id' => 'px-1', 'access_token' => 'tok-1', 'enabled' => true,
        ]);

        Http::fake(['sms.example.com/*' => Http::response('OK', 200)]);

        $payload = $this->samplePayload('wc-historical-1');
        $payload['is_historical_sync'] = true;

        $response = $this->postJson('/api/connect/v1/orders/sync', $payload, $this->connectHeaders($rawKey));

        $response->assertCreated()->assertJsonPath('data.otp_required', false);

        $order = Order::where('user_id', $user->id)->where('source_ref', 'wc-historical-1')->firstOrFail();
        $this->assertDatabaseCount('phone_otp_verifications', 0);
        $this->assertFalse((bool) $order->otp_required);
        Queue::assertNotPushed(SendFacebookCapiPurchaseEventJob::class);
    }

    public function test_non_historical_sync_still_fires_otp_and_capi_as_before(): void
    {
        Queue::fake();
        [$user, $rawKey] = $this->connectedMerchant();
        PlatformApiKey::where('user_id', $user->id)->update(['otp_verification_enabled' => true]);

        SmsGateway::create([
            'name' => 'Test Gateway', 'provider' => 'khudebarta',
            'endpoint_url' => 'https://sms.example.com/send', 'api_key' => 'key', 'secret_key' => 'secret',
            'sender_id' => 'BSOL', 'is_active' => true, 'is_enabled' => true,
        ]);
        $gatewayId = SmsGateway::first()->id;
        $user->update(['sms_gateway_id' => $gatewayId]);
        SmsCredit::create(['user_id' => $user->id, 'balance' => 1000]);

        Http::fake(['sms.example.com/*' => Http::response('OK', 200)]);

        // is_historical_sync deliberately omitted.
        $response = $this->postJson(
            '/api/connect/v1/orders/sync',
            $this->samplePayload('wc-historical-2'),
            $this->connectHeaders($rawKey)
        );

        $response->assertCreated()->assertJsonPath('data.otp_required', true);
        Queue::assertPushed(SendFacebookCapiPurchaseEventJob::class);
    }

    /** Jobs' properties are constructor-promoted + private; reflection is the only way to assert on them. */
    private function jobProperty($job, string $name)
    {
        $ref = new ReflectionProperty($job, $name);
        $ref->setAccessible(true);
        return $ref->getValue($job);
    }

    // ── Invoice PDF (Phase 12) ───────────────────────────────────────────────

    public function test_invoice_streams_a_pdf_for_a_synced_order(): void
    {
        [, $rawKey] = $this->connectedMerchant();
        $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload('wc-invoice-1'), $this->connectHeaders($rawKey))
            ->assertCreated();

        $response = $this->get('/api/connect/v1/orders/invoice?wc_order_id=wc-invoice-1', $this->connectHeaders($rawKey));

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', $response->headers->get('Content-Type'));
    }

    public function test_invoice_returns_order_not_found_for_unknown_wc_order_id(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $response = $this->get('/api/connect/v1/orders/invoice?wc_order_id=no-such-order', $this->connectHeaders($rawKey));

        $response->assertStatus(404)->assertJsonPath('error_code', 'order_not_found');
    }

    public function test_invoice_does_not_leak_another_shops_order(): void
    {
        [, $rawKeyA] = $this->connectedMerchant();
        $this->postJson('/api/connect/v1/orders/sync', $this->samplePayload('wc-invoice-2'), $this->connectHeaders($rawKeyA))
            ->assertCreated();

        [, $rawKeyB] = $this->connectedMerchant();
        $response = $this->get('/api/connect/v1/orders/invoice?wc_order_id=wc-invoice-2', $this->connectHeaders($rawKeyB, 'myshop.com'));

        $response->assertStatus(404)->assertJsonPath('error_code', 'order_not_found');
    }
}
