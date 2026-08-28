<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\User;
use App\Services\Security\TotpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * security_hardening_context.md §2 — admin two-factor setup/enable/login/
 * disable, end to end through the real API surface.
 */
class TwoFactorAuthTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'password' => Hash::make('secret-pass'),
        ]);
    }

    public function test_setup_returns_a_secret_but_does_not_enable_two_factor_yet(): void
    {
        $admin = $this->admin();

        $response = $this->actingAs($admin)->postJson('/api/admin/2fa/setup');

        $response->assertOk()->assertJsonStructure(['secret', 'otpauth_url']);

        $admin->refresh();
        $this->assertNotNull($admin->two_factor_secret);
        $this->assertFalse($admin->hasTwoFactorEnabled());
    }

    public function test_enable_rejects_a_wrong_code(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin)->postJson('/api/admin/2fa/setup');

        $this->actingAs($admin)
            ->postJson('/api/admin/2fa/enable', ['code' => '000000'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');

        $this->assertFalse($admin->fresh()->hasTwoFactorEnabled());
    }

    public function test_enable_with_the_correct_code_activates_two_factor_and_returns_recovery_codes(): void
    {
        $admin = $this->admin();
        $setup = $this->actingAs($admin)->postJson('/api/admin/2fa/setup')->json();
        $code = TotpService::codeAt($setup['secret']);

        $response = $this->actingAs($admin)->postJson('/api/admin/2fa/enable', ['code' => $code]);

        $response->assertOk()->assertJsonStructure(['recovery_codes']);
        $this->assertCount(8, $response->json('recovery_codes'));

        $admin->refresh();
        $this->assertTrue($admin->hasTwoFactorEnabled());

        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_user_id' => $admin->id,
            'action' => 'admin.2fa_enabled',
        ]);
    }

    private function enableTwoFactorFor(User $admin): array
    {
        $setup = $this->actingAs($admin)->postJson('/api/admin/2fa/setup')->json();
        $code = TotpService::codeAt($setup['secret']);
        $enable = $this->actingAs($admin)->postJson('/api/admin/2fa/enable', ['code' => $code])->json();

        return ['secret' => $setup['secret'], 'recovery_codes' => $enable['recovery_codes']];
    }

    public function test_login_with_two_factor_enabled_withholds_the_token_and_returns_a_challenge(): void
    {
        $admin = $this->admin();
        $this->enableTwoFactorFor($admin);

        $response = $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'secret-pass',
        ]);

        $response->assertOk()
            ->assertJsonPath('requires_2fa', true)
            ->assertJsonStructure(['challenge_token']);

        $this->assertArrayNotHasKey('token', $response->json());
    }

    public function test_completing_the_challenge_with_the_correct_code_issues_a_working_token(): void
    {
        $admin = $this->admin();
        $twoFactor = $this->enableTwoFactorFor($admin);

        $challengeToken = $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'secret-pass',
        ])->json('challenge_token');

        $code = TotpService::codeAt($twoFactor['secret']);

        $response = $this->postJson('/api/2fa/challenge', [
            'challenge_token' => $challengeToken,
            'code' => $code,
        ]);

        $response->assertOk()->assertJsonStructure(['token']);

        $this->getJson('/api/me', ['Authorization' => 'Bearer ' . $response->json('token')])
            ->assertOk()
            ->assertJsonPath('user.email', $admin->email);

        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_user_id' => $admin->id,
            'action' => 'admin.login_via_2fa',
        ]);
    }

    public function test_challenge_is_single_use(): void
    {
        $admin = $this->admin();
        $twoFactor = $this->enableTwoFactorFor($admin);

        $challengeToken = $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'secret-pass',
        ])->json('challenge_token');

        $code = TotpService::codeAt($twoFactor['secret']);

        $this->postJson('/api/2fa/challenge', ['challenge_token' => $challengeToken, 'code' => $code])
            ->assertOk();

        $this->postJson('/api/2fa/challenge', ['challenge_token' => $challengeToken, 'code' => $code])
            ->assertUnprocessable()
            ->assertJsonPath('error_code', 'challenge_expired');
    }

    public function test_challenge_locks_out_after_five_wrong_codes(): void
    {
        $admin = $this->admin();
        $this->enableTwoFactorFor($admin);

        $challengeToken = $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'secret-pass',
        ])->json('challenge_token');

        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/api/2fa/challenge', ['challenge_token' => $challengeToken, 'code' => '000000'])
                ->assertUnprocessable()
                ->assertJsonPath('error_code', 'invalid_code');
        }

        $this->postJson('/api/2fa/challenge', ['challenge_token' => $challengeToken, 'code' => '000000'])
            ->assertUnprocessable()
            ->assertJsonPath('error_code', 'challenge_locked');

        // Even the correct code no longer works — the challenge is dead.
        $this->postJson('/api/2fa/challenge', ['challenge_token' => $challengeToken, 'code' => '111111'])
            ->assertUnprocessable()
            ->assertJsonPath('error_code', 'challenge_expired');
    }

    public function test_a_recovery_code_works_once_and_then_is_rejected(): void
    {
        $admin = $this->admin();
        $twoFactor = $this->enableTwoFactorFor($admin);
        $recoveryCode = $twoFactor['recovery_codes'][0];

        $challengeToken = $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'secret-pass',
        ])->json('challenge_token');

        $this->postJson('/api/2fa/challenge', [
            'challenge_token' => $challengeToken,
            'recovery_code' => $recoveryCode,
        ])->assertOk()->assertJsonPath('used_recovery_code', true);

        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_user_id' => $admin->id,
            'action' => 'admin.login_via_recovery_code',
        ]);

        // Same code again, a fresh login attempt — must be rejected now.
        $challengeToken2 = $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'secret-pass',
        ])->json('challenge_token');

        $this->postJson('/api/2fa/challenge', [
            'challenge_token' => $challengeToken2,
            'recovery_code' => $recoveryCode,
        ])->assertUnprocessable()->assertJsonPath('error_code', 'invalid_code');
    }

    public function test_disable_requires_the_correct_password(): void
    {
        $admin = $this->admin();
        $this->enableTwoFactorFor($admin);

        $this->actingAs($admin)
            ->postJson('/api/admin/2fa/disable', ['password' => 'wrong-password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');

        $this->assertTrue($admin->fresh()->hasTwoFactorEnabled());

        $this->actingAs($admin)
            ->postJson('/api/admin/2fa/disable', ['password' => 'secret-pass'])
            ->assertOk();

        $this->assertFalse($admin->fresh()->hasTwoFactorEnabled());
        $this->assertNull($admin->fresh()->two_factor_secret);
    }

    public function test_regular_user_login_is_unaffected_by_two_factor(): void
    {
        $user = User::factory()->create([
            'role' => 'user',
            'password' => Hash::make('secret-pass'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'secret-pass',
        ]);

        $response->assertOk()->assertJsonStructure(['token']);
        $this->assertArrayNotHasKey('requires_2fa', $response->json());
    }

    public function test_two_factor_routes_require_admin_role(): void
    {
        $user = User::factory()->create(['role' => 'user']);

        $this->actingAs($user)->postJson('/api/admin/2fa/setup')->assertForbidden();
        $this->actingAs($user)->getJson('/api/admin/audit-logs')->assertForbidden();
    }

    public function test_admin_login_itself_is_audit_logged(): void
    {
        $admin = $this->admin();

        $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'secret-pass',
        ])->assertOk();

        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_user_id' => $admin->id,
            'action' => 'admin.login',
        ]);
    }

    public function test_admin_can_list_audit_logs(): void
    {
        $admin = $this->admin();
        AdminAuditLog::factory()->count(3)->create(['admin_user_id' => $admin->id]);

        $this->actingAs($admin)
            ->getJson('/api/admin/audit-logs')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }
}
