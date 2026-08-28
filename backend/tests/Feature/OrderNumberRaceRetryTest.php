<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * OrderController::store()'s retry-on-order-number-collision wrapper —
 * pre_launch_polish_context.md §ক. Order::generateOrderNumber() has no
 * lock, so two truly concurrent requests for the same shop can compute the
 * same next sequence; genuine multi-process concurrency isn't reproducible
 * in a synchronous test process, so this file covers what is testable:
 * normal sequential numbering still works, and the specific DB constraint
 * the retry logic keys off (orders_user_id_order_number_unique) fires
 * exactly the way store()'s catch block expects.
 */
class OrderNumberRaceRetryTest extends TestCase
{
    use RefreshDatabase;

    private function orderPayload(): array
    {
        return [
            'customer_phone' => '01712345678',
            'items' => [[
                'product_name' => 'Test item',
                'quantity' => 1,
                'unit_price' => 500,
            ]],
        ];
    }

    public function test_sequential_orders_for_the_same_shop_get_distinct_incrementing_numbers(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $first = $this->actingAs($seller)->postJson('/api/orders', $this->orderPayload())->assertCreated();
        $second = $this->actingAs($seller)->postJson('/api/orders', $this->orderPayload())->assertCreated();

        $firstNumber = $first->json('data.order_number');
        $secondNumber = $second->json('data.order_number');

        $this->assertNotSame($firstNumber, $secondNumber);
        $this->assertSame(
            (int) substr($firstNumber, -4) + 1,
            (int) substr($secondNumber, -4),
        );
    }

    public function test_two_different_shops_can_use_the_same_order_number_on_the_same_day(): void
    {
        $sellerA = User::factory()->create(['role' => 'user']);
        $sellerB = User::factory()->create(['role' => 'user']);

        $numberA = $this->actingAs($sellerA)->postJson('/api/orders', $this->orderPayload())
            ->assertCreated()->json('data.order_number');
        $numberB = $this->actingAs($sellerB)->postJson('/api/orders', $this->orderPayload())
            ->assertCreated()->json('data.order_number');

        // Both shops' first order of the day — same number is fine, it's
        // scoped per user_id (2026-08-22 cross-shop collision fix).
        $this->assertSame($numberA, $numberB);
    }

    /**
     * Confirms the DB-level guard store()'s catch block relies on actually
     * fires as UniqueConstraintViolationException (engine-agnostic — this
     * is the type check store() uses). The exact message text store() also
     * checks (str_contains for 'orders_user_id_order_number_unique') is
     * Postgres-specific wording and was verified separately against the
     * real production database in a rollback-wrapped tinker session (this
     * suite runs on SQLite, whose message format differs — same known gap
     * as security_hardening_context.md §5's sqlite-vs-postgres note).
     */
    public function test_the_order_number_unique_constraint_exists_and_fires_as_expected(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $base = [
            'user_id' => $seller->id,
            'order_number' => 'ORD-20260101-0001',
            'public_token' => bin2hex(random_bytes(24)),
            'customer_phone' => '01712345678',
            'subtotal' => 100, 'shipping_charge' => 0, 'discount' => 0, 'total' => 100,
            'status' => 'pending', 'payment_method' => 'cod', 'payment_status' => 'due',
        ];

        Order::create($base);

        $this->expectException(UniqueConstraintViolationException::class);

        Order::create(array_merge($base, ['public_token' => bin2hex(random_bytes(24))]));
    }
}
