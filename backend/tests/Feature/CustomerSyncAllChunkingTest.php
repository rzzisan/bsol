<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * CustomerController::syncAll() now chunks through orders instead of
 * loading every one into memory at once — pre_launch_polish_context.md §ক.
 */
class CustomerSyncAllChunkingTest extends TestCase
{
    use RefreshDatabase;

    private function bulkInsertOrders(User $owner, array $rows): void
    {
        $now = now();
        Order::insert(array_map(fn (array $row) => array_merge([
            'user_id' => $owner->id,
            'public_token' => bin2hex(random_bytes(24)),
            'subtotal' => 500, 'shipping_charge' => 0, 'discount' => 0, 'total' => 500,
            'status' => 'pending', 'payment_method' => 'cod', 'payment_status' => 'due',
            'created_at' => $now, 'updated_at' => $now,
        ], $row), $rows));
    }

    public function test_dedupes_by_phone_and_seeds_from_the_latest_order(): void
    {
        $owner = User::factory()->create(['role' => 'user']);

        $this->bulkInsertOrders($owner, [
            ['order_number' => 'ORD-1', 'customer_phone' => '01711111111', 'customer_name' => 'Old Name', 'id' => 1],
            ['order_number' => 'ORD-2', 'customer_phone' => '01711111111', 'customer_name' => 'New Name', 'id' => 2],
            ['order_number' => 'ORD-3', 'customer_phone' => '01722222222', 'customer_name' => 'Other Customer', 'id' => 3],
        ]);

        $this->actingAs($owner)
            ->postJson('/api/customers/sync-all')
            ->assertOk()
            ->assertJsonPath('message', '2 customers synced.');

        $customer1 = Customer::where('user_id', $owner->id)->where('phone', '01711111111')->sole();
        $this->assertSame('New Name', $customer1->name);
        $this->assertSame(2, $customer1->total_orders);
    }

    /**
     * Crosses the 500-row chunk boundary — confirms nothing at/around the
     * boundary is skipped or double-processed incorrectly.
     */
    public function test_correctly_processes_more_than_one_chunk(): void
    {
        $owner = User::factory()->create(['role' => 'user']);

        $rows = [];
        for ($i = 1; $i <= 501; $i++) {
            $rows[] = [
                'order_number' => "ORD-{$i}",
                'customer_phone' => sprintf('017%08d', $i), // unique phone per order
                'customer_name' => "Customer {$i}",
            ];
        }
        // One extra order for an already-used phone, placed last (highest id)
        // so it's encountered in the FIRST chunk processed (orderByDesc) —
        // must still correctly dedupe against the row from deep in the scan.
        $rows[] = ['order_number' => 'ORD-DUP', 'customer_phone' => sprintf('017%08d', 1), 'customer_name' => 'Latest For 1'];

        $this->bulkInsertOrders($owner, $rows);

        $this->actingAs($owner)
            ->postJson('/api/customers/sync-all')
            ->assertOk()
            ->assertJsonPath('message', '501 customers synced.');

        $customerForPhone1 = Customer::where('user_id', $owner->id)
            ->where('phone', sprintf('017%08d', 1))
            ->sole();
        $this->assertSame('Latest For 1', $customerForPhone1->name);
        $this->assertSame(2, $customerForPhone1->total_orders);

        $this->assertSame(501, Customer::where('user_id', $owner->id)->count());
    }
}
