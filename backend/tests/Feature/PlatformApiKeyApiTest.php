<?php

namespace Tests\Feature;

use App\Models\PlatformApiKey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformApiKeyApiTest extends TestCase
{
    use RefreshDatabase;

    private function authHeaders(User $user): array
    {
        $token = $user->createToken('test-suite')->plainTextToken;

        return ['Authorization' => 'Bearer ' . $token];
    }

    public function test_index_returns_an_empty_list_when_no_keys_exist(): void
    {
        $user = User::factory()->create();

        $this->getJson('/api/wordpress/api-keys', $this->authHeaders($user))
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_store_generates_a_key_and_returns_the_raw_value_once(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/wordpress/api-keys', ['domain' => 'https://MyShop.com/'], $this->authHeaders($user));

        $response->assertCreated()
            ->assertJsonPath('data.domain', 'myshop.com')
            ->assertJsonPath('data.status', 'pending');

        $rawKey = $response->json('data.api_key');
        $this->assertNotEmpty($rawKey);
        $this->assertStringStartsWith('bsol_', $rawKey);

        $this->assertDatabaseHas('platform_api_keys', [
            'user_id' => $user->id,
            'domain' => 'myshop.com',
            'status' => 'pending',
        ]);

        $stored = PlatformApiKey::where('user_id', $user->id)->first();
        $this->assertSame(hash('sha256', $rawKey), $stored->key_hash);
    }

    public function test_store_regenerates_the_same_domain_in_place(): void
    {
        $user = User::factory()->create();

        $first = $this->postJson('/api/wordpress/api-keys', ['domain' => 'myshop.com'], $this->authHeaders($user));
        $firstId = $first->json('data.id');
        $firstKey = $first->json('data.api_key');

        $second = $this->postJson('/api/wordpress/api-keys', ['domain' => 'myshop.com'], $this->authHeaders($user));
        $secondId = $second->json('data.id');
        $secondKey = $second->json('data.api_key');

        $this->assertNotSame($firstKey, $secondKey);
        $this->assertNull(PlatformApiKey::findByRawKey($firstKey));
        $this->assertNotNull(PlatformApiKey::findByRawKey($secondKey));

        // Same site (domain) reconnecting updates its existing row in
        // place — id stays stable (so orders/products already tagged with
        // it stay correctly attributed) rather than adding a duplicate.
        $this->assertSame($firstId, $secondId);
        $this->assertSame(1, PlatformApiKey::where('user_id', $user->id)->count());
    }

    public function test_store_a_second_domain_adds_a_new_connection_alongside_the_first(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/wordpress/api-keys', ['domain' => 'shop-a.com'], $this->authHeaders($user))->assertCreated();
        $this->postJson('/api/wordpress/api-keys', ['domain' => 'shop-b.com'], $this->authHeaders($user))->assertCreated();

        $this->assertSame(2, PlatformApiKey::where('user_id', $user->id)->count());

        $response = $this->getJson('/api/wordpress/api-keys', $this->authHeaders($user));
        $domains = collect($response->json('data'))->pluck('domain')->sort()->values()->all();
        $this->assertSame(['shop-a.com', 'shop-b.com'], $domains);
    }

    public function test_destroy_soft_revokes_only_the_targeted_key(): void
    {
        $user = User::factory()->create();
        $keyA = $this->postJson('/api/wordpress/api-keys', ['domain' => 'shop-a.com'], $this->authHeaders($user))->json('data.id');
        $keyB = $this->postJson('/api/wordpress/api-keys', ['domain' => 'shop-b.com'], $this->authHeaders($user))->json('data.id');

        $this->deleteJson("/api/wordpress/api-keys/{$keyA}", [], $this->authHeaders($user))->assertOk();

        $this->assertDatabaseHas('platform_api_keys', ['id' => $keyA, 'status' => 'revoked']);
        $this->assertDatabaseHas('platform_api_keys', ['id' => $keyB, 'status' => 'pending']);
    }

    public function test_destroy_404s_for_another_owners_key(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $keyId = $this->actingAs($owner, 'sanctum')
            ->postJson('/api/wordpress/api-keys', ['domain' => 'shop-a.com'])
            ->json('data.id');

        // actingAs(), not a manually-built Bearer header, for the second
        // call — Sanctum's guard caches the resolved user on the guard
        // instance for the lifetime of a single test method, so a second
        // postJson()/deleteJson() call with a *different* raw token can
        // still resolve the first call's user unless the guard is
        // explicitly swapped (a test-harness quirk, not a real request
        // boundary — each real HTTP request gets a fresh guard).
        $this->actingAs($other, 'sanctum')
            ->deleteJson("/api/wordpress/api-keys/{$keyId}")
            ->assertStatus(404);

        $this->assertDatabaseHas('platform_api_keys', ['id' => $keyId, 'status' => 'pending']);
    }

    public function test_otp_setting_toggles_only_the_targeted_connection(): void
    {
        $user = User::factory()->create();
        $keyA = $this->postJson('/api/wordpress/api-keys', ['domain' => 'shop-a.com'], $this->authHeaders($user))->json('data.id');
        $keyB = $this->postJson('/api/wordpress/api-keys', ['domain' => 'shop-b.com'], $this->authHeaders($user))->json('data.id');

        $this->putJson("/api/wordpress/api-keys/{$keyA}/otp-settings", ['enabled' => true], $this->authHeaders($user))
            ->assertOk()
            ->assertJsonPath('data.otp_verification_enabled', true);

        $this->assertDatabaseHas('platform_api_keys', ['id' => $keyA, 'otp_verification_enabled' => true]);
        $this->assertDatabaseHas('platform_api_keys', ['id' => $keyB, 'otp_verification_enabled' => false]);
    }

    public function test_staff_cannot_manage_the_connector_keys(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);

        $this->getJson('/api/wordpress/api-keys', $this->authHeaders($staff))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'owner_only');

        $this->postJson('/api/wordpress/api-keys', ['domain' => 'myshop.com'], $this->authHeaders($staff))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'owner_only');
    }

    // ── Self-update notice (Phase 13) ────────────────────────────────────────

    public function test_plugin_version_is_public_and_reads_the_real_plugin_header(): void
    {
        // No auth headers at all — this endpoint must be public.
        $response = $this->getJson('/api/wordpress/plugin-version');

        $response->assertOk()->assertJsonStructure(['success', 'data' => ['version', 'download_url']]);

        $mainFile = base_path('../wordpress-plugin/bsol-connect/bsol-connect.php');
        preg_match('/^\s*\*\s*Version:\s*([0-9.]+)/mi', file_get_contents($mainFile), $m);

        $response->assertJsonPath('data.version', $m[1]);
        $this->assertStringContainsString('/api/wordpress/plugin-download', $response->json('data.download_url'));
    }
}
