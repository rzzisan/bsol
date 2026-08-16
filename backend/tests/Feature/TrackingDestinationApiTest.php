<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\PlatformApiKey;
use App\Models\StaffPermission;
use App\Models\TrackingDestination;
use App\Models\User;
use App\Services\Tracking\TrackingIngestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * T3 — dashboard CRUD for tracking_destinations. The point of this phase:
 * a seller with several pixels can pin one to a specific landing page or
 * connected WooCommerce site instead of everything sharing the one
 * shop-wide default (tracking_capi_context.md §6.1).
 */
class TrackingDestinationApiTest extends TestCase
{
    use RefreshDatabase;

    private function landingPage(User $owner, string $slug = 'offer'): LandingPage
    {
        return LandingPage::create([
            'user_id' => $owner->id, 'title' => 'Offer Page', 'slug' => $slug,
            'content' => [], 'status' => 'draft',
        ]);
    }

    private function platformApiKey(User $owner, string $domain = 'myshop.com'): PlatformApiKey
    {
        $raw = PlatformApiKey::generateRawKey();

        return PlatformApiKey::create([
            'user_id' => $owner->id, 'platform' => 'woocommerce', 'domain' => $domain,
            'key_hash' => PlatformApiKey::hashKey($raw), 'key_prefix' => substr($raw, 0, 12),
            'status' => 'connected',
        ]);
    }

    public function test_index_starts_empty(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/tracking/destinations')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_store_creates_a_shop_wide_destination_by_default(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/tracking/destinations', [
            'label' => 'Main Pixel', 'pixel_id' => '111', 'access_token' => 'tok', 'enabled' => true,
        ])->assertCreated()
            ->assertJsonPath('data.label', 'Main Pixel')
            ->assertJsonPath('data.scope_type', null)
            ->assertJsonPath('data.scope_label', null);

        $destination = TrackingDestination::where('user_id', $user->id)->sole();
        $this->assertSame('meta', $destination->provider);
        $this->assertNull($destination->scope_type);
    }

    public function test_store_can_pin_a_destination_to_one_landing_page(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $page = $this->landingPage($user);

        $this->postJson('/api/tracking/destinations', [
            'label' => 'Brand B Pixel', 'pixel_id' => '222', 'access_token' => 'tok-b',
            'scope_type' => 'landing_page', 'scope_id' => $page->id,
        ])->assertCreated()
            ->assertJsonPath('data.scope_type', 'landing_page')
            ->assertJsonPath('data.scope_id', $page->id)
            ->assertJsonPath('data.scope_label', 'Offer Page');
    }

    public function test_store_can_pin_a_destination_to_one_connected_woocommerce_site(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $key = $this->platformApiKey($user, 'brand-c.com');

        $this->postJson('/api/tracking/destinations', [
            'label' => 'Brand C Pixel', 'pixel_id' => '333', 'access_token' => 'tok-c',
            'scope_type' => 'platform_api_key', 'scope_id' => $key->id,
        ])->assertCreated()
            ->assertJsonPath('data.scope_type', 'platform_api_key')
            ->assertJsonPath('data.scope_label', 'brand-c.com');
    }

    /** A seller must never be able to pin a pixel onto another seller's page or site. */
    public function test_store_rejects_a_scope_id_belonging_to_another_seller(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        Sanctum::actingAs($user);
        $othersPage = $this->landingPage($other);

        $this->postJson('/api/tracking/destinations', [
            'label' => 'Sneaky', 'pixel_id' => '444', 'access_token' => 'tok',
            'scope_type' => 'landing_page', 'scope_id' => $othersPage->id,
        ])->assertStatus(422);

        $this->assertSame(0, TrackingDestination::count());
    }

    public function test_a_seller_can_run_several_pixels_at_once(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $pageA = $this->landingPage($user, 'a');
        $pageB = $this->landingPage($user, 'b');

        $this->postJson('/api/tracking/destinations', ['label' => 'Default', 'pixel_id' => '1', 'access_token' => 't1']);
        $this->postJson('/api/tracking/destinations', ['label' => 'A', 'pixel_id' => '2', 'access_token' => 't2', 'scope_type' => 'landing_page', 'scope_id' => $pageA->id]);
        $this->postJson('/api/tracking/destinations', ['label' => 'B', 'pixel_id' => '3', 'access_token' => 't3', 'scope_type' => 'landing_page', 'scope_id' => $pageB->id]);

        $this->getJson('/api/tracking/destinations')->assertOk()->assertJsonCount(3, 'data');
    }

    public function test_update_edits_the_same_row(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $destination = TrackingDestination::create(['user_id' => $user->id, 'label' => 'Old', 'pixel_id' => '1', 'access_token' => 'tok', 'enabled' => false]);

        $this->putJson("/api/tracking/destinations/{$destination->id}", ['label' => 'New', 'pixel_id' => '1', 'enabled' => true])
            ->assertOk()
            ->assertJsonPath('data.label', 'New')
            ->assertJsonPath('data.enabled', true);

        $this->assertSame(1, TrackingDestination::count());
        // access_token omitted on update — must survive unchanged.
        $this->assertSame('tok', $destination->fresh()->access_token);
    }

    public function test_a_seller_cannot_edit_another_sellers_destination(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $destination = TrackingDestination::create(['user_id' => $owner->id, 'label' => 'Mine', 'pixel_id' => '1', 'access_token' => 'tok']);

        Sanctum::actingAs($other);

        $this->putJson("/api/tracking/destinations/{$destination->id}", ['label' => 'Stolen'])->assertNotFound();
        $this->deleteJson("/api/tracking/destinations/{$destination->id}")->assertNotFound();
    }

    public function test_destroy_removes_it(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $destination = TrackingDestination::create(['user_id' => $user->id, 'label' => 'Gone', 'pixel_id' => '1', 'access_token' => 'tok']);

        $this->deleteJson("/api/tracking/destinations/{$destination->id}")->assertOk();

        $this->assertSame(0, TrackingDestination::count());
    }

    public function test_test_event_uses_this_destinations_own_credentials(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $destination = TrackingDestination::create(['user_id' => $user->id, 'label' => 'X', 'pixel_id' => 'px_x', 'access_token' => 'tok-x', 'enabled' => true]);

        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1], 200)]);

        $this->postJson("/api/tracking/destinations/{$destination->id}/test-event")
            ->assertOk()->assertJsonPath('success', true);

        Http::assertSent(fn ($request) => str_contains($request->url(), '/px_x/events') && $request['access_token'] === 'tok-x');
    }

    public function test_test_event_without_credentials_is_a_clean_422(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $destination = TrackingDestination::create(['user_id' => $user->id, 'label' => 'Empty']);

        $this->postJson("/api/tracking/destinations/{$destination->id}/test-event")->assertStatus(422);
    }

    public function test_staff_cannot_reach_destination_crud(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'role' => 'user']);
        foreach (StaffPermission::MODULE_KEYS as $key) {
            StaffPermission::create(['user_id' => $staff->id, 'module_key' => $key, 'enabled' => true]);
        }

        Sanctum::actingAs($staff);

        $this->getJson('/api/tracking/destinations')->assertForbidden();
    }

    /**
     * End-to-end proof for the exact scenario this phase was built for: a
     * seller with two pixels, one pinned per landing page, and an event on
     * each page reaches its own pixel — not the other one, not both.
     */
    public function test_events_on_different_landing_pages_reach_their_own_pinned_destination(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $pageA = $this->landingPage($user, 'a');
        $pageB = $this->landingPage($user, 'b');

        $this->postJson('/api/tracking/destinations', [
            'label' => 'Pixel A', 'pixel_id' => 'px_a', 'access_token' => 'tok-a', 'enabled' => true,
            'scope_type' => 'landing_page', 'scope_id' => $pageA->id,
        ])->assertCreated();
        $this->postJson('/api/tracking/destinations', [
            'label' => 'Pixel B', 'pixel_id' => 'px_b', 'access_token' => 'tok-b', 'enabled' => true,
            'scope_type' => 'landing_page', 'scope_id' => $pageB->id,
        ])->assertCreated();

        $ingest = app(TrackingIngestService::class);

        $resultA = $ingest->ingest($user->id, ['event_name' => 'PageView', 'event_id' => 'a1'], [
            'landing_page_id' => $pageA->id, 'scope_type' => 'landing_page', 'scope_id' => $pageA->id,
        ]);
        $resultB = $ingest->ingest($user->id, ['event_name' => 'PageView', 'event_id' => 'b1'], [
            'landing_page_id' => $pageB->id, 'scope_type' => 'landing_page', 'scope_id' => $pageB->id,
        ]);

        $this->assertSame(TrackingIngestService::ACCEPTED, $resultA['status']);
        $this->assertSame(TrackingIngestService::ACCEPTED, $resultB['status']);

        $pixelForA = TrackingDestination::sendableFor($user->id, 'landing_page', $pageA->id)->pluck('pixel_id')->all();
        $pixelForB = TrackingDestination::sendableFor($user->id, 'landing_page', $pageB->id)->pluck('pixel_id')->all();
        $this->assertSame(['px_a'], $pixelForA);
        $this->assertSame(['px_b'], $pixelForB);
    }
}
