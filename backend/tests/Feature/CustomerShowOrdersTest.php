<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\StaffPermission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * CustomerController::show() now reuses Customer::orders() instead of
 * hand-duplicating the same shop-scoped, phone-matched query —
 * pre_launch_polish_context.md §ক dead-code cleanup.
 */
class CustomerShowOrdersTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(User $owner, string $phone, array $overrides = []): Order
    {
        return Order::create(array_merge([
            'user_id' => $owner->id,
            'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Karim Uddin',
            'customer_phone' => $phone,
            'subtotal' => 500, 'shipping_charge' => 0, 'discount' => 0, 'total' => 500,
            'status' => 'pending', 'payment_method' => 'cod', 'payment_status' => 'due',
        ], $overrides));
    }

    public function test_show_returns_the_customers_orders(): void
    {
        $owner = User::factory()->create(['role' => 'user']);
        $order = $this->makeOrder($owner, '01712345678');
        Customer::syncFromOrder($order);
        $customer = Customer::where('user_id', $owner->id)->where('phone', '01712345678')->sole();

        $response = $this->actingAs($owner)->getJson("/api/customers/{$customer->id}");

        $response->assertOk();
        $this->assertCount(1, $response->json('data.orders'));
        $this->assertSame($order->id, $response->json('data.orders.0.id'));
    }

    public function test_show_does_not_leak_another_shops_order_with_the_same_phone(): void
    {
        $owner = User::factory()->create(['role' => 'user']);
        $otherShop = User::factory()->create(['role' => 'user']);
        $order = $this->makeOrder($owner, '01712345678');
        $this->makeOrder($otherShop, '01712345678');
        Customer::syncFromOrder($order);
        $customer = Customer::where('user_id', $owner->id)->where('phone', '01712345678')->sole();

        $response = $this->actingAs($owner)->getJson("/api/customers/{$customer->id}");

        $response->assertOk();
        $this->assertCount(1, $response->json('data.orders'));
    }

    public function test_a_staff_member_sees_orders_placed_by_other_staff_in_the_same_shop(): void
    {
        $owner = User::factory()->create(['role' => 'user']);
        $staff = User::factory()->create(['role' => 'user', 'owner_id' => $owner->id, 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'customers', 'enabled' => true]);

        // Order placed under the staff member's own acting id but Order.user_id
        // is always the shop owner (staff_team_role_context.md §3.3).
        $order = $this->makeOrder($owner, '01712345678');
        Customer::syncFromOrder($order);
        $customer = Customer::where('user_id', $owner->id)->where('phone', '01712345678')->sole();

        $this->actingAs($staff)
            ->getJson("/api/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.orders');
    }
}
