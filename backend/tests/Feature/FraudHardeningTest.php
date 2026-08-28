<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * pre_launch_polish_context.md §খ — blacklist-add throttle, courier-check
 * throttle, and the new admin-facing global blacklist oversight view.
 */
class FraudHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_blacklist_add_is_throttled(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        for ($i = 0; $i < 20; $i++) {
            $this->actingAs($seller)
                ->postJson('/api/fraud/blacklist', ['phone' => sprintf('017%08d', $i)])
                ->assertCreated();
        }

        $this->actingAs($seller)
            ->postJson('/api/fraud/blacklist', ['phone' => '01799999999'])
            ->assertStatus(429);
    }

    public function test_courier_check_is_throttled(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        for ($i = 0; $i < 30; $i++) {
            $this->actingAs($seller)
                ->getJson('/api/fraud/courier-check?phone=01712345678');
        }

        $this->actingAs($seller)
            ->getJson('/api/fraud/courier-check?phone=01712345678')
            ->assertStatus(429);
    }

    public function test_admin_can_see_the_global_blacklist_with_seller_identity(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $sellerA = User::factory()->create(['role' => 'user']);
        $sellerB = User::factory()->create(['role' => 'user']);

        $this->actingAs($sellerA)
            ->postJson('/api/fraud/blacklist', ['phone' => '01711111111', 'reason' => 'Fake order'])
            ->assertCreated();
        $this->actingAs($sellerB)
            ->postJson('/api/fraud/blacklist', ['phone' => '01711111111'])
            ->assertCreated();

        $response = $this->actingAs($admin)->getJson('/api/admin/global-blacklist');

        $response->assertOk()->assertJsonCount(2, 'data');
        // Both rows for the shared phone report seller_count 2 — corroborated
        // by two unrelated sellers, not just one.
        $this->assertSame(2, $response->json('data.0.seller_count'));
        $this->assertSame(2, $response->json('data.1.seller_count'));
        $this->assertNotNull($response->json('data.0.seller_email'));
    }

    public function test_non_admin_cannot_see_the_global_blacklist(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $this->actingAs($seller)
            ->getJson('/api/admin/global-blacklist')
            ->assertForbidden();
    }

    public function test_global_blacklist_can_be_filtered_by_phone(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $seller = User::factory()->create(['role' => 'user']);

        $this->actingAs($seller)->postJson('/api/fraud/blacklist', ['phone' => '01711111111'])->assertCreated();
        $this->actingAs($seller)->postJson('/api/fraud/blacklist', ['phone' => '01722222222'])->assertCreated();

        $this->actingAs($admin)
            ->getJson('/api/admin/global-blacklist?phone=01711')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
