<?php

namespace Tests\Feature;

use App\Models\PlatformApiKey;
use App\Models\SubscriptionPackage;
use App\Models\TrackingDestination;
use App\Models\TrackingEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * T4 — the WordPress plugin's tracking surface: batched ingest
 * (/connect/v1/tracking/events) and the cacheable pixel config
 * (/connect/v1/tracking/config), tracking_capi_context.md §7.
 */
class ConnectTrackingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // ingest() dispatches DispatchTrackingEventsJob (T2) synchronously
        // under the sync test queue — not this file's concern.
        Queue::fake();
    }

    /** @return array{0: User, 1: string, 2: PlatformApiKey} */
    private function connectedMerchant(?int $limit = 100): array
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0,
            'duration_days' => 30, 'max_tracking_events_per_day' => $limit,
        ]);
        $user = User::factory()->create(['subscription_package_id' => $package->id]);
        $rawKey = PlatformApiKey::generateRawKey();

        $apiKey = PlatformApiKey::create([
            'user_id' => $user->id, 'platform' => 'woocommerce', 'domain' => 'myshop.com',
            'key_hash' => PlatformApiKey::hashKey($rawKey), 'key_prefix' => substr($rawKey, 0, 12),
            'status' => 'connected',
        ]);

        return [$user, $rawKey, $apiKey];
    }

    private function connectHeaders(string $rawKey, string $domain = 'myshop.com'): array
    {
        return ['X-API-KEY' => $rawKey, 'X-Client-Domain' => $domain];
    }

    private function destination(User $user, array $overrides = []): TrackingDestination
    {
        return TrackingDestination::create(array_merge([
            'user_id' => $user->id, 'pixel_id' => 'px_wc', 'access_token' => 'secret', 'enabled' => true,
        ], $overrides));
    }

    private function event(array $overrides = []): array
    {
        return array_merge(['event_name' => 'PageView', 'event_id' => 'pv-1'], $overrides);
    }

    public function test_a_batch_is_ingested_and_tagged_with_the_connected_site(): void
    {
        [$user, $rawKey, $apiKey] = $this->connectedMerchant();
        $this->destination($user);

        $this->postJson('/api/connect/v1/tracking/events', [
            'events' => [$this->event(['event_id' => 'a']), $this->event(['event_name' => 'ViewContent', 'event_id' => 'b'])],
        ], $this->connectHeaders($rawKey))
            ->assertOk()
            ->assertJsonPath('data.0.status', 'accepted')
            ->assertJsonPath('data.1.status', 'accepted');

        $this->assertSame(2, TrackingEvent::count());
        $this->assertTrue(TrackingEvent::where('platform_api_key_id', $apiKey->id)->count() === 2);
    }

    public function test_each_event_in_a_batch_reports_its_own_status(): void
    {
        [$user, $rawKey] = $this->connectedMerchant(1);
        $this->destination($user);

        $response = $this->postJson('/api/connect/v1/tracking/events', [
            'events' => [
                $this->event(['event_name' => 'OrderConfirmed', 'event_id' => 'ok']),
                $this->event(['event_name' => 'OrderConfirmed', 'event_id' => 'ok']), // duplicate
            ],
        ], $this->connectHeaders($rawKey));

        $response->assertOk()
            ->assertJsonPath('data.0.status', 'accepted')
            ->assertJsonPath('data.1.status', 'duplicate');
    }

    public function test_with_no_destination_configured_nothing_is_charged(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $this->postJson('/api/connect/v1/tracking/events', [
            'events' => [$this->event()],
        ], $this->connectHeaders($rawKey))
            ->assertOk()
            ->assertJsonPath('data.0.status', 'no_destination');

        $this->assertSame(0, TrackingEvent::count());
    }

    /** Two different WooCommerce sites for one seller must not cross-contaminate. */
    public function test_a_second_connected_site_tags_its_own_events_separately(): void
    {
        [$user, $rawKey, $firstKey] = $this->connectedMerchant();
        $this->destination($user);

        $secondRawKey = PlatformApiKey::generateRawKey();
        $secondKey = PlatformApiKey::create([
            'user_id' => $user->id, 'platform' => 'woocommerce', 'domain' => 'second-shop.com',
            'key_hash' => PlatformApiKey::hashKey($secondRawKey), 'key_prefix' => substr($secondRawKey, 0, 12),
            'status' => 'connected',
        ]);

        $this->postJson('/api/connect/v1/tracking/events', ['events' => [$this->event(['event_id' => 'a'])]], $this->connectHeaders($rawKey));
        $this->postJson('/api/connect/v1/tracking/events', ['events' => [$this->event(['event_id' => 'b'])]], $this->connectHeaders($secondRawKey, 'second-shop.com'));

        $this->assertSame($firstKey->id, TrackingEvent::where('event_id', 'a')->sole()->platform_api_key_id);
        $this->assertSame($secondKey->id, TrackingEvent::where('event_id', 'b')->sole()->platform_api_key_id);
    }

    public function test_missing_or_invalid_api_key_is_rejected(): void
    {
        $this->postJson('/api/connect/v1/tracking/events', ['events' => [$this->event()]])
            ->assertUnauthorized();
    }

    public function test_config_exposes_the_pixel_id_for_this_site(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->destination($user, ['pixel_id' => 'px_visible']);

        $this->getJson('/api/connect/v1/tracking/config', $this->connectHeaders($rawKey))
            ->assertOk()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.pixel_id', 'px_visible');
    }

    public function test_config_reports_disabled_with_no_destination(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $this->getJson('/api/connect/v1/tracking/config', $this->connectHeaders($rawKey))
            ->assertOk()
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.pixel_id', null);
    }

    /** A destination pinned to a *different* site must not light up here. */
    public function test_config_only_uses_a_destination_scoped_to_this_site_or_shop_wide(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $otherKey = PlatformApiKey::create([
            'user_id' => $user->id, 'platform' => 'woocommerce', 'domain' => 'other-shop.com',
            'key_hash' => PlatformApiKey::hashKey(PlatformApiKey::generateRawKey()), 'key_prefix' => 'other12345',
            'status' => 'connected',
        ]);
        $this->destination($user, ['scope_type' => 'platform_api_key', 'scope_id' => $otherKey->id]);

        $this->getJson('/api/connect/v1/tracking/config', $this->connectHeaders($rawKey))
            ->assertOk()
            ->assertJsonPath('data.enabled', false);
    }

    public function test_config_never_leaks_the_access_token(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->destination($user, ['access_token' => 'super-secret-token']);

        $body = $this->getJson('/api/connect/v1/tracking/config', $this->connectHeaders($rawKey))->getContent();
        $this->assertStringNotContainsString('super-secret-token', $body);
    }
}
