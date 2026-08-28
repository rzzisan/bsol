<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * EnsureActiveSubscription's 'allow_delivery_confirmation' mode —
 * pre_launch_polish_context.md §ছ / security_hardening_context.md: an
 * expired-subscription seller can still confirm delivered/returned/
 * cancelled (the courier already acted regardless of subscription state),
 * but every other order-status transition still hard-blocks.
 */
class OrderStatusSubscriptionGateTest extends TestCase
{
    use RefreshDatabase;

    private function expiredSeller(): User
    {
        return User::factory()->create(['role' => 'user', 'subscription_status' => 'expired']);
    }

    private function makeOrder(User $owner, array $overrides = []): Order
    {
        return Order::create(array_merge([
            'user_id' => $owner->id,
            'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'subtotal' => 1000, 'shipping_charge' => 0, 'discount' => 0, 'total' => 1000,
            'status' => 'shipped',
            'payment_method' => 'cod',
            'payment_status' => 'due',
        ], $overrides));
    }

    public function test_an_expired_seller_can_still_mark_an_order_delivered(): void
    {
        $seller = $this->expiredSeller();
        $order = $this->makeOrder($seller);

        $this->actingAs($seller)
            ->putJson("/api/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertOk();

        $this->assertSame('delivered', $order->fresh()->status);
    }

    public function test_an_expired_seller_can_still_mark_an_order_returned_or_cancelled(): void
    {
        $seller = $this->expiredSeller();

        $returned = $this->makeOrder($seller);
        $this->actingAs($seller)
            ->putJson("/api/orders/{$returned->id}/status", ['status' => 'returned'])
            ->assertOk();
        $this->assertSame('returned', $returned->fresh()->status);

        $cancelled = $this->makeOrder($seller, ['status' => 'pending']);
        $this->actingAs($seller)
            ->putJson("/api/orders/{$cancelled->id}/status", ['status' => 'cancelled'])
            ->assertOk();
        $this->assertSame('cancelled', $cancelled->fresh()->status);
    }

    public function test_an_expired_seller_still_cannot_progress_normal_order_processing(): void
    {
        $seller = $this->expiredSeller();
        $order = $this->makeOrder($seller, ['status' => 'pending']);

        $this->actingAs($seller)
            ->putJson("/api/orders/{$order->id}/status", ['status' => 'confirmed'])
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'subscription_expired');

        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_an_expired_seller_still_cannot_create_a_new_order(): void
    {
        $seller = $this->expiredSeller();

        $this->actingAs($seller)
            ->postJson('/api/orders', [
                'customer_name' => 'Karim',
                'customer_phone' => '01712345678',
                'items' => [],
            ])
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'subscription_expired');
    }

    public function test_bulk_status_to_delivered_is_also_exempt_but_to_confirmed_is_not(): void
    {
        $seller = $this->expiredSeller();
        $a = $this->makeOrder($seller);
        $b = $this->makeOrder($seller, ['status' => 'pending']);

        $this->actingAs($seller)
            ->postJson('/api/orders/bulk-status', ['ids' => [$a->id], 'status' => 'delivered'])
            ->assertOk();
        $this->assertSame('delivered', $a->fresh()->status);

        $this->actingAs($seller)
            ->postJson('/api/orders/bulk-status', ['ids' => [$b->id], 'status' => 'confirmed'])
            ->assertStatus(402)
            ->assertJsonPath('error_code', 'subscription_expired');
        $this->assertSame('pending', $b->fresh()->status);
    }

    public function test_a_seller_with_an_active_subscription_is_unaffected(): void
    {
        $seller = User::factory()->create(['role' => 'user', 'subscription_status' => 'active']);
        $order = $this->makeOrder($seller, ['status' => 'pending']);

        $this->actingAs($seller)
            ->putJson("/api/orders/{$order->id}/status", ['status' => 'confirmed'])
            ->assertOk();
    }
}
