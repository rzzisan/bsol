<?php

namespace Tests\Feature;

use App\Models\StaffPermission;
use App\Models\TrackingDestination;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * GET/PUT /facebook/pixel + POST /facebook/pixel/test-event — the only
 * dashboard surface that can create/edit a shop-wide TrackingDestination
 * today (T3's full CRUD UI doesn't exist yet). Rewritten off the retired
 * facebook_pixel_settings table onto tracking_destinations while building
 * T4 — see the controller's own docblock for why that couldn't wait.
 */
class FacebookPixelSettingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_show_with_nothing_configured_returns_the_empty_shape(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/facebook/pixel')
            ->assertOk()
            ->assertJsonPath('data.pixel_id', null)
            ->assertJsonPath('data.access_token_set', false)
            ->assertJsonPath('data.enabled', false);
    }

    public function test_update_creates_a_shop_wide_tracking_destination_not_the_retired_table(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->putJson('/api/facebook/pixel', [
            'pixel_id' => '123456',
            'access_token' => 'EAAG-secret',
            'test_event_code' => 'TEST123',
            'enabled' => true,
        ])->assertOk()->assertJsonPath('data.pixel_id', '123456');

        $destination = TrackingDestination::where('user_id', $user->id)->sole();
        $this->assertSame('meta', $destination->provider);
        $this->assertSame('Default', $destination->label);
        $this->assertNull($destination->scope_type);
        $this->assertTrue($destination->enabled);
        $this->assertSame('EAAG-secret', $destination->access_token);

        $this->assertSame(0, \App\Models\FacebookPixelSetting::count());
    }

    public function test_a_second_update_edits_the_same_row_instead_of_creating_another(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->putJson('/api/facebook/pixel', ['pixel_id' => '111', 'access_token' => 'tok-1', 'enabled' => true]);
        $this->putJson('/api/facebook/pixel', ['pixel_id' => '222', 'enabled' => false]);

        $destination = TrackingDestination::where('user_id', $user->id)->sole();
        $this->assertSame('222', $destination->pixel_id);
        $this->assertFalse($destination->enabled);
        // access_token omitted on the second call — must survive unchanged.
        $this->assertSame('tok-1', $destination->access_token);
    }

    public function test_show_reflects_what_update_saved(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->putJson('/api/facebook/pixel', ['pixel_id' => '999', 'access_token' => 'tok', 'enabled' => true]);

        $this->getJson('/api/facebook/pixel')
            ->assertOk()
            ->assertJsonPath('data.pixel_id', '999')
            ->assertJsonPath('data.access_token_set', true)
            ->assertJsonPath('data.enabled', true);
    }

    /** The freshly-saved destination is immediately usable by the real ingest pipeline. */
    public function test_a_destination_saved_here_is_immediately_sendable(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->putJson('/api/facebook/pixel', ['pixel_id' => '555', 'access_token' => 'tok', 'enabled' => true]);

        $this->assertNotNull(TrackingDestination::sendableFor($user->id)->first());
    }

    public function test_test_event_uses_the_saved_destinations_credentials(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->putJson('/api/facebook/pixel', ['pixel_id' => 'px_test', 'access_token' => 'tok-test', 'enabled' => true]);

        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1], 200)]);

        $this->postJson('/api/facebook/pixel/test-event')->assertOk()->assertJsonPath('success', true);

        Http::assertSent(fn ($request) => str_contains($request->url(), '/px_test/events') && $request['access_token'] === 'tok-test');
    }

    public function test_test_event_without_credentials_is_a_clean_422(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/facebook/pixel/test-event')
            ->assertStatus(422);
    }

    public function test_staff_cannot_reach_owner_only_pixel_settings(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'role' => 'user']);
        foreach (StaffPermission::MODULE_KEYS as $key) {
            StaffPermission::create(['user_id' => $staff->id, 'module_key' => $key, 'enabled' => true]);
        }

        Sanctum::actingAs($staff);

        $this->getJson('/api/facebook/pixel')->assertForbidden();
    }
}
