<?php

namespace Tests\Feature;

use App\Models\CourierSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * pre_launch_polish_context.md §গ — RedX/Carrybee previously had no
 * test-connection endpoint at all (only Steadfast and Pathao did), and
 * PathaoService/PathaoLocationService had two independently-maintained,
 * divergent token-fetch implementations (one hitting a token endpoint
 * that isn't real Pathao API). Both fixed here.
 */
class CourierTestConnectionTest extends TestCase
{
    use RefreshDatabase;

    private function actingSeller(): User
    {
        $user = User::factory()->create(['role' => 'user']);
        $this->actingAs($user);
        return $user;
    }

    // ── RedX ──────────────────────────────────────────────────────────────

    public function test_redx_test_connection_fails_cleanly_with_no_credentials(): void
    {
        $this->actingSeller();

        $this->postJson('/api/courier/settings/test-redx')
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_redx_test_connection_succeeds_and_reports_pickup_store_count(): void
    {
        $user = $this->actingSeller();
        CourierSetting::create(['user_id' => $user->id, 'redx_api_key' => 'a-real-token']);

        Http::fake([
            '*/pickup/stores' => Http::response(['pickup_stores' => [['id' => 1], ['id' => 2]]]),
        ]);

        $this->postJson('/api/courier/settings/test-redx')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.pickup_store_count', 2);
    }

    public function test_redx_test_connection_surfaces_the_providers_error_message(): void
    {
        $user = $this->actingSeller();
        CourierSetting::create(['user_id' => $user->id, 'redx_api_key' => 'bad-token']);

        Http::fake([
            '*/pickup/stores' => Http::response(['message' => 'Invalid token.'], 401),
        ]);

        $this->postJson('/api/courier/settings/test-redx')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Invalid token.');
    }

    // ── CarryBee ──────────────────────────────────────────────────────────

    public function test_carrybee_test_connection_fails_cleanly_with_no_credentials(): void
    {
        $this->actingSeller();

        $this->postJson('/api/courier/settings/test-carrybee')
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_carrybee_test_connection_succeeds_and_reports_store_count(): void
    {
        $user = $this->actingSeller();
        CourierSetting::create([
            'user_id' => $user->id,
            'carrybee_client_id' => 'client-id',
            'carrybee_client_secret' => 'client-secret',
            'carrybee_client_context' => 'client-context',
        ]);

        Http::fake([
            '*/api/v2/stores' => Http::response(['error' => false, 'data' => ['stores' => [['id' => 1]]]]),
        ]);

        $this->postJson('/api/courier/settings/test-carrybee')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.store_count', 1);
    }

    // ── Pathao token-fetch unification ───────────────────────────────────

    public function test_pathao_location_dropdown_works_off_a_still_valid_cached_token_with_no_stored_password(): void
    {
        $user = $this->actingSeller();

        // Legacy/imported setting: client_id + client_secret + a still-valid
        // cached token, but no username/password ever stored. Before the
        // unification fix, PathaoLocationService's own hasCredentials()
        // only checked client_id/secret so this already worked by accident;
        // now it's routed through PathaoService::hasCredentials(), which
        // must also recognize this case as usable.
        CourierSetting::create([
            'user_id' => $user->id,
            'pathao_client_id' => 'client-id',
            'pathao_client_secret' => 'client-secret',
            'pathao_access_token' => 'still-valid-cached-token',
            'pathao_token_expires_at' => now()->addHour(),
        ]);

        Http::fake([
            '*/aladdin/api/v1/countries/1/city-list' => Http::response([
                'data' => ['data' => [['city_id' => 1, 'city_name' => 'Dhaka']]],
            ]),
        ]);

        $response = $this->getJson('/api/courier/locations/cities');

        $response->assertOk()->assertJsonPath('has_credentials', true);
        $this->assertNotEmpty($response->json('data'));

        // The real (issue-token) endpoint was never hit — the cached token
        // was reused, not re-derived from a bogus /external/login call.
        Http::assertSentCount(1);
    }

    public function test_pathao_location_dropdown_reports_no_credentials_when_nothing_is_usable(): void
    {
        $this->actingSeller();

        $response = $this->getJson('/api/courier/locations/cities');

        $response->assertOk()->assertJsonPath('has_credentials', false)->assertJsonPath('data', []);
    }
}
