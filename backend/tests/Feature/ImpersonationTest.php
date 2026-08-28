<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/**
 * pre_launch_polish_context.md §ঠ / domain_security_audit.md §L-2 — no
 * test file existed for impersonation at all. Covers the two gaps the
 * audit flagged: the token wasn't revoked server-side on "Return" (stayed
 * valid for the rest of its 60-minute TTL), and impersonation wasn't in
 * the admin audit trail at all despite being exactly the kind of
 * account-takeover-blast-radius action AdminAuditLogger exists for.
 *
 * Sanctum pins the resolved user for the whole test on first resolution —
 * `$this->app['auth']->forgetGuards()` before any request that switches to
 * a different Bearer token, same convention as AdminSubdomainToolsTest.
 */
class ImpersonationTest extends TestCase
{
    use RefreshDatabase;

    private function bearer(string $token): array
    {
        return ['Authorization' => "Bearer {$token}"];
    }

    public function test_starting_impersonation_issues_a_token_and_logs_it(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $adminToken = $admin->createToken('admin-session')->plainTextToken;
        $seller = User::factory()->create(['role' => 'user']);

        $response = $this->withHeaders($this->bearer($adminToken))
            ->postJson("/api/admin/users/{$seller->id}/impersonate");

        $response->assertOk()->assertJsonPath('data.user.id', $seller->id);

        $log = AdminAuditLog::where('action', 'impersonation_started')->sole();
        $this->assertSame($admin->id, $log->admin_user_id);
        $this->assertSame($seller->id, $log->target_id);
    }

    public function test_admin_accounts_cannot_be_impersonated(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $adminToken = $admin->createToken('admin-session')->plainTextToken;
        $otherAdmin = User::factory()->create(['role' => 'admin']);

        $this->withHeaders($this->bearer($adminToken))
            ->postJson("/api/admin/users/{$otherAdmin->id}/impersonate")
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'target_is_admin');
    }

    public function test_ending_impersonation_revokes_the_token_and_logs_it_against_the_real_admin(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $adminToken = $admin->createToken('admin-session')->plainTextToken;
        $seller = User::factory()->create(['role' => 'user']);

        $start = $this->withHeaders($this->bearer($adminToken))
            ->postJson("/api/admin/users/{$seller->id}/impersonate");
        $impersonationToken = $start->json('data.token');

        $this->assertNotNull(PersonalAccessToken::findToken($impersonationToken));

        $this->app['auth']->forgetGuards();

        $end = $this->withHeaders($this->bearer($impersonationToken))
            ->postJson('/api/impersonate/end');

        $end->assertOk()->assertJsonPath('success', true);

        // The token itself is gone — findToken() looks it up fresh, no
        // stale auth-guard state to fool this assertion.
        $this->assertNull(PersonalAccessToken::findToken($impersonationToken));

        $log = AdminAuditLog::where('action', 'impersonation_ended')->sole();
        $this->assertSame($admin->id, $log->admin_user_id, 'must attribute to the real admin, not the impersonated seller');
        $this->assertSame($seller->id, $log->target_id);
    }

    public function test_ending_impersonation_a_second_time_is_a_harmless_no_op(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $adminToken = $admin->createToken('admin-session')->plainTextToken;
        $seller = User::factory()->create(['role' => 'user']);

        $start = $this->withHeaders($this->bearer($adminToken))
            ->postJson("/api/admin/users/{$seller->id}/impersonate");
        $impersonationToken = $start->json('data.token');

        $this->app['auth']->forgetGuards();

        $this->withHeaders($this->bearer($impersonationToken))
            ->postJson('/api/impersonate/end')->assertOk();

        $this->app['auth']->forgetGuards();

        // The token no longer exists, so this second call can't even
        // authenticate — a 401 is the correct outcome, not a crash.
        $this->withHeaders($this->bearer($impersonationToken))
            ->postJson('/api/impersonate/end')
            ->assertStatus(401);
    }

    public function test_calling_end_on_a_sellers_own_ordinary_token_does_not_revoke_it_or_log_anything(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        $ownToken = $seller->createToken('normal-login')->plainTextToken;

        $this->withHeaders($this->bearer($ownToken))
            ->postJson('/api/impersonate/end')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertNotNull(PersonalAccessToken::findToken($ownToken));
        $this->assertSame(0, AdminAuditLog::count());
    }

    public function test_a_non_admin_cannot_start_impersonation(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        $sellerToken = $seller->createToken('seller-session')->plainTextToken;
        $otherSeller = User::factory()->create(['role' => 'user']);

        $this->withHeaders($this->bearer($sellerToken))
            ->postJson("/api/admin/users/{$otherSeller->id}/impersonate")
            ->assertForbidden();
    }
}
