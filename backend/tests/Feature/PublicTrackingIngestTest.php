<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\ShopProfile;
use App\Models\SubscriptionPackage;
use App\Models\TrackingDestination;
use App\Models\TrackingEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * T6 — POST /api/public/track, the browser-facing ingest endpoint for a
 * seller's own landing page, plus the tracking config publicShow() exposes
 * (tracking_capi_context.md §8.8).
 */
class PublicTrackingIngestTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // ingest() dispatches DispatchTrackingEventsJob (T2) on every
        // accepted event; QUEUE_CONNECTION=sync in tests would run it
        // inline and make a real Meta HTTP call. That's DispatchTrackingEventsJob's
        // own concern (TrackingDispatchTest) — this file is about the
        // ingest endpoint's own request handling.
        Queue::fake();
    }

    private function apex(): string
    {
        return config('app.subdomain_apex');
    }

    private function seller(string $subdomain, ?int $limit = 100): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0,
            'duration_days' => 30, 'max_tracking_events_per_day' => $limit,
        ]);
        $user = User::factory()->create(['subscription_package_id' => $package->id]);

        ShopProfile::create([
            'user_id' => $user->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => $subdomain, 'subdomain_status' => 'active',
        ]);

        return $user;
    }

    private function page(User $owner, string $slug, array $overrides = []): LandingPage
    {
        return LandingPage::create(array_merge([
            'user_id' => $owner->id, 'title' => ucfirst($slug), 'slug' => $slug,
            'status' => 'published', 'published_at' => now(), 'content' => [],
        ], $overrides));
    }

    private function destination(User $user, array $overrides = []): TrackingDestination
    {
        return TrackingDestination::create(array_merge([
            'user_id' => $user->id, 'pixel_id' => 'px_shop', 'access_token' => 'secret', 'enabled' => true,
        ], $overrides));
    }

    // -- POST /api/public/track ----------------------------------------------

    public function test_a_shop_wide_destination_receives_a_page_scoped_event(): void
    {
        $owner = $this->seller('shopa');
        $this->destination($owner);
        $page = $this->page($owner, 'offer');

        $this->postJson("https://shopa.{$this->apex()}/api/public/track", [
            'slug' => 'offer',
            'event_name' => 'PageView',
            'event_id' => 'pv-1',
        ])->assertOk()->assertJsonPath('status', 'accepted');

        $event = TrackingEvent::sole();
        $this->assertSame($owner->id, $event->user_id);
        $this->assertSame($page->id, $event->landing_page_id);
        $this->assertSame('PageView', $event->event_name);
    }

    public function test_an_unknown_host_silently_accepts_and_stores_nothing(): void
    {
        $this->postJson("https://nobody.{$this->apex()}/api/public/track", [
            'event_name' => 'PageView', 'event_id' => 'pv-1',
        ])->assertOk()->assertJsonPath('success', true);

        $this->assertSame(0, TrackingEvent::count());
    }

    public function test_missing_slug_still_reaches_the_shop_wide_destination(): void
    {
        $owner = $this->seller('shopa');
        $this->destination($owner);

        $this->postJson("https://shopa.{$this->apex()}/api/public/track", [
            'event_name' => 'PageView', 'event_id' => 'pv-1',
        ])->assertOk()->assertJsonPath('status', 'accepted');

        $event = TrackingEvent::sole();
        $this->assertNull($event->landing_page_id);
    }

    public function test_a_seller_with_no_destination_configured_costs_nothing(): void
    {
        $owner = $this->seller('shopa');
        $this->page($owner, 'offer');

        $this->postJson("https://shopa.{$this->apex()}/api/public/track", [
            'slug' => 'offer', 'event_name' => 'PageView', 'event_id' => 'pv-1',
        ])->assertOk()->assertJsonPath('status', 'no_destination');

        $this->assertSame(0, TrackingEvent::count());
    }

    /** The browser is trusted for its own IP/UA here — it's a same-origin, direct POST, not a WordPress relay. */
    public function test_client_ip_and_user_agent_are_taken_from_the_real_request_not_the_body(): void
    {
        $owner = $this->seller('shopa');
        $this->destination($owner);

        $this->withHeader('User-Agent', 'RealBrowser/1.0')
            ->postJson("https://shopa.{$this->apex()}/api/public/track", [
                'event_name' => 'PageView',
                'event_id' => 'pv-1',
                'user_data' => [
                    'client_ip_address' => '9.9.9.9',
                    'client_user_agent' => 'SpoofedAgent/1.0',
                ],
            ])->assertOk();

        $stored = TrackingEvent::sole()->user_data_hashed;
        $this->assertNotSame('9.9.9.9', $stored['client_ip_address']);
        $this->assertSame('RealBrowser/1.0', $stored['client_user_agent']);
    }

    public function test_fbc_is_synthesised_from_fbclid_when_the_cookie_is_missing(): void
    {
        $owner = $this->seller('shopa');
        $this->destination($owner);

        $this->postJson("https://shopa.{$this->apex()}/api/public/track", [
            'event_name' => 'PageView',
            'event_id' => 'pv-1',
            'user_data' => ['fbclid' => 'IwAR123'],
        ])->assertOk();

        $stored = TrackingEvent::sole()->user_data_hashed;
        $this->assertStringStartsWith('fb.1.', $stored['fbc']);
        $this->assertStringEndsWith('.IwAR123', $stored['fbc']);
    }

    public function test_an_existing_fbc_cookie_value_is_kept_as_is(): void
    {
        $owner = $this->seller('shopa');
        $this->destination($owner);

        $this->postJson("https://shopa.{$this->apex()}/api/public/track", [
            'event_name' => 'PageView',
            'event_id' => 'pv-1',
            'user_data' => ['fbc' => 'fb.1.1700000000000.real', 'fbclid' => 'IwAR123'],
        ])->assertOk();

        $this->assertSame('fb.1.1700000000000.real', TrackingEvent::sole()->user_data_hashed['fbc']);
    }

    // -- publicShow() tracking config -----------------------------------------

    public function test_publicshow_exposes_the_pixel_id_when_a_destination_exists(): void
    {
        $owner = $this->seller('shopa');
        $this->destination($owner, ['pixel_id' => 'px_visible']);
        $this->page($owner, 'offer');

        $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer")
            ->assertOk()
            ->assertJsonPath('data.tracking.enabled', true)
            ->assertJsonPath('data.tracking.pixel_id', 'px_visible');
    }

    public function test_publicshow_reports_disabled_with_no_destination_configured(): void
    {
        $owner = $this->seller('shopa');
        $this->page($owner, 'offer');

        $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer")
            ->assertOk()
            ->assertJsonPath('data.tracking.enabled', false)
            ->assertJsonPath('data.tracking.pixel_id', null);
    }

    /** A per-page opt-out wins even when the seller has a working destination. */
    public function test_publicshow_honours_the_per_page_tracking_toggle(): void
    {
        $owner = $this->seller('shopa');
        $this->destination($owner);
        $this->page($owner, 'offer', ['content' => ['settings' => ['tracking_enabled' => false]]]);

        $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer")
            ->assertOk()
            ->assertJsonPath('data.tracking.enabled', false)
            ->assertJsonPath('data.tracking.pixel_id', null);
    }

    /** access_token must never appear in a public response. */
    public function test_publicshow_never_leaks_the_access_token(): void
    {
        $owner = $this->seller('shopa');
        $this->destination($owner, ['access_token' => 'super-secret-token']);
        $this->page($owner, 'offer');

        $body = $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer")->getContent();
        $this->assertStringNotContainsString('super-secret-token', $body);
    }

    /** A destination pinned to a different page must not light up here. */
    public function test_publicshow_only_uses_a_destination_scoped_to_this_page_or_shop_wide(): void
    {
        $owner = $this->seller('shopa');
        $other = $this->page($owner, 'other');
        $this->destination($owner, ['scope_type' => 'landing_page', 'scope_id' => $other->id]);
        $this->page($owner, 'offer');

        $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer")
            ->assertOk()
            ->assertJsonPath('data.tracking.enabled', false);
    }
}
