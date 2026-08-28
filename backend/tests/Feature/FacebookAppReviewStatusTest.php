<?php

namespace Tests\Feature;

use App\Models\PlatformFacebookSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * pre_launch_polish_context.md §ঞ — App Review is still partial
 * (facebook_integration_context.md §10): pages_manage_metadata/engagement/
 * messaging are pending resubmission, so Meta's Development Mode blocks
 * every seller who isn't an admin/developer/tester on the app. This admin
 * toggle + seller-facing flag lets the dashboard show an honest notice
 * instead of the seller hitting an unexplained Facebook-side rejection,
 * and lets the notice disappear the moment an admin flips it on — no
 * redeploy needed either way.
 */
class FacebookAppReviewStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_defaults_to_not_approved(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)->getJson('/api/admin/settings/facebook')
            ->assertOk()
            ->assertJsonPath('data.app_review_approved', false);
    }

    public function test_an_admin_can_flip_it_on(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)->putJson('/api/admin/settings/facebook/app-review-status', [
            'app_review_approved' => true,
        ])->assertOk()->assertJsonPath('data.app_review_approved', true);

        $this->assertTrue(PlatformFacebookSetting::getSetting()->fresh()->app_review_approved);
    }

    public function test_an_admin_can_flip_it_back_off(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        PlatformFacebookSetting::getSetting()->update(['app_review_approved' => true]);

        $this->actingAs($admin)->putJson('/api/admin/settings/facebook/app-review-status', [
            'app_review_approved' => false,
        ])->assertOk()->assertJsonPath('data.app_review_approved', false);
    }

    public function test_a_non_admin_cannot_toggle_it(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $this->actingAs($seller)->putJson('/api/admin/settings/facebook/app-review-status', [
            'app_review_approved' => true,
        ])->assertForbidden();
    }

    public function test_toggling_app_review_status_never_touches_the_stored_app_id(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        PlatformFacebookSetting::getSetting()->update(['app_id' => 'existing-app-id']);

        $this->actingAs($admin)->putJson('/api/admin/settings/facebook/app-review-status', [
            'app_review_approved' => true,
        ])->assertOk();

        $this->assertSame('existing-app-id', PlatformFacebookSetting::getSetting()->fresh()->app_id);
    }

    public function test_the_sellers_connect_status_endpoint_reports_the_flag(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $this->actingAs($seller)->getJson('/api/facebook/connect/status')
            ->assertOk()
            ->assertJsonPath('app_review_approved', false);

        PlatformFacebookSetting::getSetting()->update(['app_review_approved' => true]);

        $this->actingAs($seller)->getJson('/api/facebook/connect/status')
            ->assertOk()
            ->assertJsonPath('app_review_approved', true);
    }
}
