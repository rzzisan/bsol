<?php

namespace Tests\Feature;

use App\Models\SubscriptionPackage;
use App\Models\TrackingDestination;
use App\Models\TrackingUsageDaily;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * GET /admin/tracking/usage — per-seller usage in one screen for admin
 * (tracking_capi_context.md §5.2/§6.2, T7).
 */
class AdminTrackingUsageApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sees_every_sellers_usage(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-16 06:00:00', 'UTC')); // 12:00 Dhaka

        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0,
            'duration_days' => 30, 'max_tracking_events_per_day' => 100,
        ]);
        $seller = User::factory()->create(['subscription_package_id' => $package->id, 'role' => 'user']);
        TrackingUsageDaily::create([
            'user_id' => $seller->id, 'date' => '2026-08-16',
            'accepted_count' => 40, 'dropped_count' => 1, 'overage_count' => 0,
            'sent_count' => 38, 'failed_count' => 1,
        ]);
        TrackingDestination::create(['user_id' => $seller->id, 'label' => 'Main', 'pixel_id' => '1', 'access_token' => 'tok']);

        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test')->plainTextToken;

        $this->getJson('/api/admin/tracking/usage', ['Authorization' => 'Bearer ' . $token])
            ->assertOk()
            ->assertJsonPath('date', '2026-08-16')
            ->assertJsonFragment([
                'id' => $seller->id,
                'accepted' => 40,
                'dropped' => 1,
                'daily_limit' => 100,
                'destinations_count' => 1,
            ]);

        Carbon::setTestNow();
    }

    public function test_a_seller_with_no_usage_today_still_appears_with_zeros(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test')->plainTextToken;

        $this->getJson('/api/admin/tracking/usage', ['Authorization' => 'Bearer ' . $token])
            ->assertOk()
            ->assertJsonFragment(['id' => $seller->id, 'accepted' => 0, 'destinations_count' => 0]);
    }

    public function test_staff_sub_accounts_are_excluded(): void
    {
        $owner = User::factory()->create(['role' => 'user']);
        User::factory()->create(['owner_id' => $owner->id, 'role' => 'user']);
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test')->plainTextToken;

        $res = $this->getJson('/api/admin/tracking/usage', ['Authorization' => 'Bearer ' . $token])->assertOk();
        $this->assertCount(1, $res->json('data'));
    }

    public function test_non_admin_cannot_access(): void
    {
        $user = User::factory()->create(['role' => 'user']);
        $token = $user->createToken('test')->plainTextToken;

        $this->getJson('/api/admin/tracking/usage', ['Authorization' => 'Bearer ' . $token])
            ->assertForbidden();
    }
}
