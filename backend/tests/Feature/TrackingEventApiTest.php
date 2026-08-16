<?php

namespace Tests\Feature;

use App\Models\StaffPermission;
use App\Models\TrackingEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * GET /tracking/events — the event log behind the T7 dashboard
 * (tracking_capi_context.md §6.2/§6.3).
 */
class TrackingEventApiTest extends TestCase
{
    use RefreshDatabase;

    private function makeEvent(User $owner, array $overrides = []): TrackingEvent
    {
        return TrackingEvent::create(array_merge([
            'user_id' => $owner->id,
            'event_name' => 'Purchase',
            'event_id' => 'evt_' . uniqid(),
            'event_time' => now(),
            'status' => 'sent',
            'user_data_hashed' => ['ph' => ['abc'], 'fbp' => 'fb.1.111.222'],
        ], $overrides));
    }

    public function test_an_owner_sees_their_events(): void
    {
        $owner = User::factory()->create();
        $this->makeEvent($owner);
        $this->makeEvent($owner, ['event_name' => 'PageView', 'status' => 'failed', 'user_data_hashed' => []]);

        Sanctum::actingAs($owner);

        $this->getJson('/api/tracking/events')
            ->assertOk()
            ->assertJsonPath('pagination.total', 2)
            ->assertJsonCount(2, 'data');
    }

    public function test_it_filters_by_status(): void
    {
        $owner = User::factory()->create();
        $this->makeEvent($owner, ['status' => 'sent']);
        $this->makeEvent($owner, ['status' => 'failed']);

        Sanctum::actingAs($owner);

        $this->getJson('/api/tracking/events?status=failed')
            ->assertOk()
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('data.0.status', 'failed');
    }

    public function test_it_reports_fbp_fbc_presence_without_leaking_the_hashed_blob(): void
    {
        $owner = User::factory()->create();
        $this->makeEvent($owner, ['user_data_hashed' => ['fbp' => 'fb.1.1.1', 'ph' => ['x']]]);

        Sanctum::actingAs($owner);

        $res = $this->getJson('/api/tracking/events')->assertOk();
        $res->assertJsonPath('data.0.has_fbp', true);
        $res->assertJsonPath('data.0.has_fbc', false);
        $res->assertJsonMissingPath('data.0.user_data_hashed');
    }

    public function test_match_quality_summary_reflects_the_sample(): void
    {
        $owner = User::factory()->create();
        $this->makeEvent($owner, ['user_data_hashed' => ['fbp' => 'fb.1.1.1', 'ph' => ['x']]]);
        $this->makeEvent($owner, ['user_data_hashed' => []]);

        Sanctum::actingAs($owner);

        $this->getJson('/api/tracking/events')
            ->assertOk()
            ->assertJsonPath('match_quality.sampled', 2)
            ->assertJsonPath('match_quality.fbp_rate', 0.5)
            ->assertJsonPath('match_quality.phone_rate', 0.5)
            ->assertJsonPath('match_quality.fbc_rate', 0);
    }

    /** A shop's log is scoped to its own owner — never another shop's events. */
    public function test_a_seller_never_sees_another_shops_events(): void
    {
        $mine = User::factory()->create();
        $theirs = User::factory()->create();
        $this->makeEvent($theirs);

        Sanctum::actingAs($mine);

        $this->getJson('/api/tracking/events')
            ->assertOk()
            ->assertJsonPath('pagination.total', 0);
    }

    public function test_staff_without_the_tracking_module_are_refused(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'role' => 'user', 'staff_status' => 'active']);

        Sanctum::actingAs($staff);

        $this->getJson('/api/tracking/events')->assertForbidden();
    }

    /** Staff share the shop's log once granted — Pattern A, not owner-only. */
    public function test_staff_with_the_tracking_module_can_read_events(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'role' => 'user', 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'tracking', 'enabled' => true]);
        $this->makeEvent($owner);

        Sanctum::actingAs($staff);

        $this->getJson('/api/tracking/events')
            ->assertOk()
            ->assertJsonPath('pagination.total', 1);
    }

    public function test_it_requires_authentication(): void
    {
        $this->getJson('/api/tracking/events')->assertUnauthorized();
    }
}
