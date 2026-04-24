<?php

namespace Tests\Feature;

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
}
