<?php

namespace Tests\Feature;

use App\Models\AbandonedCheckout;
use App\Models\PlatformApiKey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 17 — WooCommerce checkout-in-progress capture, delegating to
 * AbandonedCheckoutService::captureWooCommerce() (same abandoned_checkouts
 * table/dashboard UI landing pages already use). See
 * wordpress_connect_context.md §9.
 */
class ConnectAbandonedCheckoutTest extends TestCase
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

    /** @return array{0: string, 1: array} raw key + headers for a second connected site (Phase 16). */
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

    private function samplePayload(string $sessionToken = 'sess-1'): array
    {
        return [
            'session_token' => $sessionToken,
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01755443322',
            'customer_email' => 'karim@example.com',
            'customer_address' => 'Dhanmondi, Dhaka',
            'items' => [
                ['name' => 'T-Shirt (M)', 'sku' => 'TS-M', 'quantity' => 2, 'unit_price' => 450, 'product_link' => 'https://myshop.com/product/t-shirt'],
            ],
        ];
    }

    public function test_capture_creates_a_woocommerce_abandoned_checkout(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();

        $response = $this->postJson('/api/connect/v1/checkout/abandoned', $this->samplePayload(), $this->connectHeaders($rawKey));

        $response->assertOk()->assertJsonPath('success', true);

        $this->assertDatabaseHas('abandoned_checkouts', [
            'user_id' => $user->id,
            'source' => 'woocommerce',
            'session_token' => 'sess-1',
            'customer_phone' => '01755443322',
            'status' => 'active',
        ]);

        $checkout = AbandonedCheckout::where('user_id', $user->id)->first();
        $this->assertSame(900.0, (float) $checkout->subtotal);
        $this->assertCount(1, $checkout->items);
    }

    public function test_repeat_capture_with_the_same_session_upserts_not_duplicates(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/checkout/abandoned', $this->samplePayload(), $headers)->assertOk();

        $updated = $this->samplePayload();
        $updated['customer_address'] = 'Gulshan, Dhaka';
        $this->postJson('/api/connect/v1/checkout/abandoned', $updated, $headers)->assertOk();

        $this->assertSame(1, AbandonedCheckout::where('user_id', $user->id)->count());
        $this->assertDatabaseHas('abandoned_checkouts', ['user_id' => $user->id, 'customer_address' => 'Gulshan, Dhaka']);
    }

    public function test_two_connected_sites_with_the_same_session_token_create_two_distinct_rows(): void
    {
        [$user, $rawKeyA] = $this->connectedMerchant();
        [$rawKeyB, $headersB] = $this->secondSiteForMerchant($user);
        $headersA = $this->connectHeaders($rawKeyA);

        $payload = $this->samplePayload('shared-session-token');
        $this->postJson('/api/connect/v1/checkout/abandoned', $payload, $headersA)->assertOk();
        $this->postJson('/api/connect/v1/checkout/abandoned', $payload, $headersB)->assertOk();

        $this->assertSame(2, AbandonedCheckout::where('user_id', $user->id)->where('source', 'woocommerce')->count());

        $keyA = PlatformApiKey::findByRawKey($rawKeyA);
        $keyB = PlatformApiKey::findByRawKey($rawKeyB);
        $this->assertDatabaseHas('abandoned_checkouts', ['platform_api_key_id' => $keyA->id, 'session_token' => 'shared-session-token']);
        $this->assertDatabaseHas('abandoned_checkouts', ['platform_api_key_id' => $keyB->id, 'session_token' => 'shared-session-token']);
    }

    public function test_a_converted_row_is_not_resurrected_by_a_stale_capture(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/checkout/abandoned', $this->samplePayload(), $headers)->assertOk();
        $checkout = AbandonedCheckout::where('user_id', $user->id)->first();
        $checkout->update(['status' => 'converted']);

        $stale = $this->samplePayload();
        $stale['customer_address'] = 'A stale browser tab still open';
        $this->postJson('/api/connect/v1/checkout/abandoned', $stale, $headers)->assertOk();

        $checkout->refresh();
        $this->assertSame('converted', $checkout->status);
        $this->assertNotSame('A stale browser tab still open', $checkout->customer_address);
    }

    public function test_capture_requires_a_session_token(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $payload = $this->samplePayload();
        unset($payload['session_token']);

        $this->postJson('/api/connect/v1/checkout/abandoned', $payload, $this->connectHeaders($rawKey))
            ->assertStatus(422);
    }
}
