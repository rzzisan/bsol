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

    public function test_show_returns_null_when_no_key_exists(): void
    {
        $user = User::factory()->create();

        $this->getJson('/api/wordpress/api-key', $this->authHeaders($user))
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_store_generates_a_key_and_returns_the_raw_value_once(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/wordpress/api-key', ['domain' => 'https://MyShop.com/'], $this->authHeaders($user));

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

    public function test_store_regenerates_and_invalidates_the_previous_key(): void
    {
        $user = User::factory()->create();

        $first = $this->postJson('/api/wordpress/api-key', ['domain' => 'myshop.com'], $this->authHeaders($user))
            ->json('data.api_key');

        $second = $this->postJson('/api/wordpress/api-key', ['domain' => 'myshop.com'], $this->authHeaders($user))
            ->json('data.api_key');

        $this->assertNotSame($first, $second);
        $this->assertNull(PlatformApiKey::findByRawKey($first));
        $this->assertNotNull(PlatformApiKey::findByRawKey($second));

        // Still exactly one row per owner.
        $this->assertSame(1, PlatformApiKey::where('user_id', $user->id)->count());
    }

    public function test_destroy_soft_revokes_the_key(): void
    {
        $user = User::factory()->create();
        $this->postJson('/api/wordpress/api-key', ['domain' => 'myshop.com'], $this->authHeaders($user));

        $this->deleteJson('/api/wordpress/api-key', [], $this->authHeaders($user))->assertOk();

        $this->assertDatabaseHas('platform_api_keys', [
            'user_id' => $user->id,
            'status' => 'revoked',
        ]);
    }

    public function test_staff_cannot_manage_the_connector_key(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);

        $this->getJson('/api/wordpress/api-key', $this->authHeaders($staff))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'owner_only');

        $this->postJson('/api/wordpress/api-key', ['domain' => 'myshop.com'], $this->authHeaders($staff))
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
