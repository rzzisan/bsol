<?php

namespace Tests\Feature;

use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FreePlanActivationTest extends TestCase
{
    use RefreshDatabase;

    private function package(string $slug, float $price, int $days = 14): SubscriptionPackage
    {
        return SubscriptionPackage::create([
            'slug' => $slug, 'name' => ucfirst($slug), 'price' => $price,
            'duration_days' => $days, 'max_orders' => 50, 'features' => ['orders'], 'is_active' => true,
        ]);
    }

    private function seller(array $attrs = []): User
    {
        $user = User::factory()->create($attrs);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_expired_seller_can_activate_free_package_once(): void
    {
        $trial = $this->package('free-trial', 0);
        $user = $this->seller(['subscription_status' => 'expired', 'subscription_ends_at' => now()->subDay()]);

        $this->postJson('/api/subscription/activate-free', ['package_id' => $trial->id])->assertOk();

        $user->refresh();
        $this->assertSame($trial->id, $user->subscription_package_id);
        $this->assertTrue($user->subscription_ends_at->isFuture());
        $this->assertDatabaseHas('subscription_payments', [
            'user_id' => $user->id, 'package_id' => $trial->id, 'status' => 'approved', 'payment_method' => 'free',
        ]);
    }

    public function test_free_package_cannot_be_reclaimed(): void
    {
        $trial = $this->package('free-trial', 0);
        $this->seller([
            'subscription_package_id' => $trial->id,
            'subscription_status' => 'expired',
            'subscription_ends_at' => now()->subDay(),
        ]);

        $this->postJson('/api/subscription/activate-free', ['package_id' => $trial->id])->assertStatus(422);
    }

    public function test_paid_package_is_rejected(): void
    {
        $paid = $this->package('starter', 799, 30);
        $this->seller(['subscription_status' => 'expired', 'subscription_ends_at' => now()->subDay()]);

        $this->postJson('/api/subscription/activate-free', ['package_id' => $paid->id])->assertStatus(422);
    }
}
