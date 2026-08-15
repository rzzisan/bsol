<?php

namespace Tests\Feature;

use App\Models\StaffPermission;
use App\Models\SubscriptionPackage;
use App\Models\User;
use App\Services\Tracking\TrackingQuotaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * GET /tracking/usage — the quota meter behind the seller's Pixel settings
 * page, plus the owner_only scoping the route declares.
 */
class TrackingUsageApiTest extends TestCase
{
    use RefreshDatabase;

    private function owner(?int $limit = 100): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0,
            'duration_days' => 30, 'max_tracking_events_per_day' => $limit,
        ]);

        return User::factory()->create(['subscription_package_id' => $package->id]);
    }

    public function test_an_owner_sees_their_meter_and_history(): void
    {
        $owner = $this->owner(100);
        $quota = app(TrackingQuotaService::class);

        // Deliberately no ambient event here: at 65% a PageView sits inside
        // the P2 sampling band, so whether it is dropped is a coin flip and
        // asserting on it would make this test one too.
        for ($i = 0; $i < 65; $i++) {
            $quota->admit($owner->id, 'Purchase');
        }

        Sanctum::actingAs($owner);

        $this->getJson('/api/tracking/usage')
            ->assertOk()
            ->assertJsonPath('data.today.limit', 100)
            ->assertJsonPath('data.today.used', 65)
            ->assertJsonPath('data.today.percent', 65)
            ->assertJsonPath('data.state', 'sampling')
            ->assertJsonPath('data.timezone', 'Asia/Dhaka')
            ->assertJsonPath('data.history.0.accepted', 65);
    }

    /** Past 80% an ambient event is shed outright, so the drop count is deterministic. */
    public function test_dropped_events_are_reported(): void
    {
        $owner = $this->owner(100);
        $quota = app(TrackingQuotaService::class);

        for ($i = 0; $i < 85; $i++) {
            $quota->admit($owner->id, 'Purchase');
        }
        $quota->admit($owner->id, 'PageView');

        Sanctum::actingAs($owner);

        $this->getJson('/api/tracking/usage')
            ->assertOk()
            ->assertJsonPath('data.today.used', 85)
            ->assertJsonPath('data.today.dropped', 1)
            ->assertJsonPath('data.state', 'critical');
    }

    public function test_a_package_without_a_limit_reports_unlimited(): void
    {
        Sanctum::actingAs($this->owner(null));

        $this->getJson('/api/tracking/usage')
            ->assertOk()
            ->assertJsonPath('data.today.limit', null)
            ->assertJsonPath('data.today.percent', null)
            ->assertJsonPath('data.state', 'unlimited');
    }

    public function test_a_package_with_a_zero_limit_reports_that_tracking_is_not_included(): void
    {
        Sanctum::actingAs($this->owner(0));

        $this->getJson('/api/tracking/usage')
            ->assertOk()
            ->assertJsonPath('data.state', 'not_in_package');
    }

    /**
     * Past the limit the meter stops at 100% and P0 shows up as overage —
     * a bar reading past full would suggest something was blocked when
     * Purchase and OrderDelivered are still going through.
     */
    public function test_overage_is_reported_separately_from_usage(): void
    {
        $owner = $this->owner(10);
        $quota = app(TrackingQuotaService::class);

        for ($i = 0; $i < 12; $i++) {
            $quota->admit($owner->id, 'OrderDelivered');
        }

        Sanctum::actingAs($owner);

        $this->getJson('/api/tracking/usage')
            ->assertOk()
            ->assertJsonPath('data.today.percent', 100)
            ->assertJsonPath('data.today.overage', 2)
            ->assertJsonPath('data.state', 'exhausted');
    }

    /** A shop's usage is the owner's usage — staff have no quota of their own (Pattern B). */
    public function test_a_seller_never_sees_another_shops_usage(): void
    {
        $mine = $this->owner(100);
        $theirs = $this->owner(100);

        app(TrackingQuotaService::class)->admit($theirs->id, 'Purchase');

        Sanctum::actingAs($mine);

        $this->getJson('/api/tracking/usage')
            ->assertOk()
            ->assertJsonPath('data.today.used', 0);
    }

    /**
     * The route is owner_only, so a staff account is refused even with every
     * module granted — there is no staff-facing tracking surface yet, and
     * §6.2 moves this to staff_permission:tracking in T7 with that UI.
     */
    public function test_staff_are_refused_even_with_permissions_granted(): void
    {
        $owner = $this->owner(100);
        $staff = User::factory()->create(['owner_id' => $owner->id, 'role' => 'user']);

        foreach (StaffPermission::MODULE_KEYS as $key) {
            StaffPermission::create(['user_id' => $staff->id, 'module_key' => $key, 'enabled' => true]);
        }

        Sanctum::actingAs($staff);

        $this->getJson('/api/tracking/usage')->assertForbidden();
    }

    public function test_it_requires_authentication(): void
    {
        $this->getJson('/api/tracking/usage')->assertUnauthorized();
    }

    /** History is built from the Dhaka day, not now(), or the window is off by one near midnight UTC. */
    public function test_history_is_windowed_on_dhaka_days(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-15 20:00:00', 'UTC'));

        $owner = $this->owner(100);
        app(TrackingQuotaService::class)->admit($owner->id, 'Purchase');

        Sanctum::actingAs($owner);

        $this->getJson('/api/tracking/usage')
            ->assertOk()
            ->assertJsonPath('data.today.date', '2026-08-16')
            ->assertJsonPath('data.history.0.date', '2026-08-16');

        Carbon::setTestNow();
    }
}
