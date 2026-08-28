<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Transaction;
use App\Models\User;
use App\Services\AccountingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * transactions_dedup_unique (2026_08_28_100000) + AccountingService's
 * upsertTransaction() wrapper — pre_launch_polish_context.md §ছ.
 */
class AccountingServiceLedgerDedupTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(User $owner, array $overrides = []): Order
    {
        return Order::create(array_merge([
            'user_id' => $owner->id,
            'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'subtotal' => 1000, 'shipping_charge' => 0, 'discount' => 0, 'total' => 1000,
            'status' => 'pending',
            'payment_method' => 'cod',
            'payment_status' => 'due',
        ], $overrides));
    }

    public function test_on_order_created_books_a_single_pending_income_row(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);

        (new AccountingService())->onOrderCreated($order);

        $this->assertSame(1, Transaction::where('reference_id', $order->id)
            ->where('reference_type', 'order')
            ->where('category', 'order_cod')
            ->count());
    }

    public function test_calling_on_order_created_twice_updates_the_same_row_instead_of_duplicating(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $service = new AccountingService();

        $service->onOrderCreated($order);
        $service->onOrderCreated($order); // e.g. a retried request

        $rows = Transaction::where('reference_id', $order->id)
            ->where('reference_type', 'order')
            ->where('category', 'order_cod')
            ->get();

        $this->assertCount(1, $rows);
    }

    public function test_on_order_delivered_confirms_the_existing_pending_row(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $service = new AccountingService();

        $service->onOrderCreated($order);
        $service->onOrderDelivered($order);

        $row = Transaction::where('reference_id', $order->id)
            ->where('reference_type', 'order')
            ->where('category', 'order_cod')
            ->sole();

        $this->assertSame(Transaction::STATUS_CONFIRMED, $row->status);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    /**
     * Simulates the actual race the migration guards against: a duplicate
     * row already exists (e.g. two concurrent requests both lost the
     * find-then-create race before the unique index existed, or a retry
     * landed between find and create) — upsertTransaction() must still
     * resolve to updating in place rather than throwing once the unique
     * index is what stops the second insert.
     */
    public function test_a_concurrent_duplicate_write_updates_in_place_instead_of_erroring(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $service = new AccountingService();

        $service->onOrderCreated($order);

        // Second caller changes the order's total first (simulating an
        // edit that happened between the two racing requests), then also
        // calls onOrderCreated — must update the existing row's amount,
        // not throw a unique-constraint exception.
        $order->update(['total' => 1500]);
        $service->onOrderCreated($order);

        $row = Transaction::where('reference_id', $order->id)
            ->where('reference_type', 'order')
            ->where('category', 'order_cod')
            ->sole();

        $this->assertEquals(1500, (float) $row->amount);
    }

    public function test_courier_charge_updated_is_also_race_safe(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner, ['courier_charge' => 60]);
        $service = new AccountingService();

        $service->onCourierChargeUpdated($order);
        $service->onCourierChargeUpdated($order);

        $this->assertSame(1, Transaction::where('reference_id', $order->id)
            ->where('category', 'courier_charge')
            ->count());
    }

    public function test_deleting_an_order_removes_its_income_transaction_but_keeps_the_courier_expense(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner, ['courier_charge' => 60]);
        $service = new AccountingService();

        $service->onOrderCreated($order);
        $service->onCourierChargeUpdated($order);
        $service->onOrderDeleted($order);

        $this->assertSame(0, Transaction::where('reference_id', $order->id)
            ->where('type', Transaction::TYPE_INCOME)->count());
        $this->assertSame(1, Transaction::where('reference_id', $order->id)
            ->where('type', Transaction::TYPE_EXPENSE)->count());
    }

    public function test_the_delete_order_endpoint_cleans_up_its_ledger_row(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        (new AccountingService())->onOrderCreated($order);

        $this->actingAs($owner)
            ->deleteJson("/api/orders/{$order->id}")
            ->assertOk();

        $this->assertSame(0, Transaction::where('reference_id', $order->id)
            ->where('type', Transaction::TYPE_INCOME)->count());
        $this->assertSoftDeleted('orders', ['id' => $order->id]);
    }

    public function test_the_unique_index_actually_exists_at_the_database_level(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);

        Transaction::create([
            'user_id' => $owner->id,
            'reference_type' => 'order',
            'reference_id' => $order->id,
            'type' => Transaction::TYPE_INCOME,
            'category' => 'order_cod',
            'status' => Transaction::STATUS_PENDING,
            'amount' => 1000,
            'transaction_date' => now()->toDateString(),
            'is_auto' => true,
        ]);

        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);

        Transaction::create([
            'user_id' => $owner->id,
            'reference_type' => 'order',
            'reference_id' => $order->id,
            'type' => Transaction::TYPE_INCOME,
            'category' => 'order_cod',
            'status' => Transaction::STATUS_PENDING,
            'amount' => 999,
            'transaction_date' => now()->toDateString(),
            'is_auto' => true,
        ]);
    }
}
