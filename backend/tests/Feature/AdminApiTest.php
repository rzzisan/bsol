<?php

namespace Tests\Feature;

use App\Models\EmailOtpVerification;
use App\Models\RegistrationSetting;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_dashboard_summary(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        User::factory()->count(2)->create();

        $token = $admin->createToken('test-suite')->plainTextToken;

        $this->getJson('/api/admin/summary', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonStructure([
                'totals' => ['users', 'admins', 'active_packages'],
                'recent_users',
            ]);
    }

    public function test_non_admin_cannot_access_admin_apis(): void
    {
        $user = User::factory()->create(['role' => 'user']);
        $token = $user->createToken('test-suite')->plainTextToken;

        $this->getJson('/api/admin/users', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertForbidden();
    }

    public function test_admin_can_crud_subscription_packages(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test-suite')->plainTextToken;

        $createResponse = $this->postJson('/api/admin/packages', [
            'name' => 'Starter',
            'slug' => 'starter',
            'price' => 499,
            'duration_days' => 30,
            'max_orders' => 100,
            'features' => ['analytics', 'crm'],
            'is_active' => true,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertCreated();

        $packageId = $createResponse->json('package.id');

        $this->putJson('/api/admin/packages/'.$packageId, [
            'price' => 599,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('package.price', '599.00');

        $this->deleteJson('/api/admin/packages/'.$packageId, [], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk();

        $this->assertDatabaseMissing('subscription_packages', [
            'id' => $packageId,
        ]);
    }

    public function test_admin_can_create_user_from_dashboard_api(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test-suite')->plainTextToken;
        $package = SubscriptionPackage::create([
            'name' => 'Growth',
            'slug' => 'growth',
            'price' => 999,
            'duration_days' => 30,
        ]);

        $this->postJson('/api/admin/users', [
            'name' => 'Managed User',
            'mobile' => '01800000000',
            'email' => 'managed@example.com',
            'password' => 'password123',
            'role' => 'user',
            'subscription_package_id' => $package->id,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertCreated()
            ->assertJsonPath('user.email', 'managed@example.com');

        $this->assertDatabaseHas('users', [
            'email' => 'managed@example.com',
            'subscription_package_id' => $package->id,
        ]);
    }

    public function test_updating_user_email_resets_email_verification_and_clears_pending_email_otps(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $user = User::factory()->create([
            'email' => 'old@example.com',
            'email_verified_at' => now(),
        ]);

        EmailOtpVerification::create([
            'token' => str_repeat('a', 64),
            'email' => 'old@example.com',
            'otp_code' => '123456',
            'verification_token' => str_repeat('b', 64),
            'purpose' => 'registration',
            'pending_data' => ['user_id' => $user->id, 'name' => $user->name],
            'resend_count' => 0,
            'expires_at' => now()->addMinutes(30),
        ]);

        $token = $admin->createToken('test-suite')->plainTextToken;

        $this->putJson('/api/admin/users/'.$user->id, [
            'email' => 'new@example.com',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('user.email', 'new@example.com');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'email' => 'new@example.com',
            'email_verified_at' => null,
        ]);

        $this->assertDatabaseMissing('email_otp_verifications', [
            'email' => 'old@example.com',
            'verified_at' => null,
        ]);
    }

    public function test_admin_can_update_registration_defaults(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test-suite')->plainTextToken;

        $package = SubscriptionPackage::create([
            'name' => 'Starter',
            'slug' => 'starter',
            'price' => 399,
            'duration_days' => 30,
        ]);

        $this->putJson('/api/admin/registration-defaults', [
            'default_user_status' => 'active',
            'default_subscription_package_id' => $package->id,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('defaults.default_user_status', 'active')
            ->assertJsonPath('defaults.default_subscription_package_id', $package->id);

        $this->getJson('/api/admin/registration-defaults', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('defaults.default_user_status', 'active')
            ->assertJsonPath('defaults.default_subscription_package_id', $package->id)
            ->assertJsonPath('defaults.default_package.name', 'Starter');

        $this->assertDatabaseHas('registration_settings', [
            'default_user_status' => 'active',
            'default_subscription_package_id' => $package->id,
        ]);

        RegistrationSetting::query()->delete();

        $this->getJson('/api/admin/registration-defaults', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('defaults.default_user_status', 'pending')
            ->assertJsonPath('defaults.default_subscription_package_id', null);
    }
}
