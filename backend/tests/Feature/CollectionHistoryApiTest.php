<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\StaffPermission;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Unified manual + courier-COD collection history — see
 * SAAS_MODULE_CONTEXT.md §19.
 */
class CollectionHistoryApiTest extends TestCase
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
            'status' => 'delivered',
            'payment_method' => 'cod',
            'payment_status' => 'paid',
        ], $overrides));
    }

    private function makeManualPayment(Order $order, User $owner): void
    {
        Sanctum::actingAs($owner);
        $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'full_payment', 'method' => 'cash', 'amount' => 400, 'collected_by' => $owner->id,
        ])->assertCreated();
    }

    private function makeCourierCodTransaction(Order $order): void
    {
        Transaction::create([
            'user_id' => $order->user_id,
            'type' => Transaction::TYPE_INCOME,
            'status' => Transaction::STATUS_CONFIRMED,
            'category' => 'order_cod',
            'reference_type' => 'order',
            'reference_id' => $order->id,
            'amount' => 600,
            'note' => 'COD income confirmed on delivered order.',
            'transaction_date' => now()->toDateString(),
            'is_auto' => true,
        ]);
    }

    public function test_it_unions_manual_and_courier_cod_rows_sorted_by_date(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $this->makeManualPayment($order, $owner);
        $this->makeCourierCodTransaction($order);

        Sanctum::actingAs($owner);
        $response = $this->getJson('/api/accounting/collections');

        $response->assertOk();
        $sources = collect($response->json('data'))->pluck('source')->sort()->values()->all();
        $this->assertSame(['courier_cod', 'manual'], $sources);
    }

    public function test_courier_cod_row_has_no_individual_collector(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $this->makeCourierCodTransaction($order);

        Sanctum::actingAs($owner);
        $response = $this->getJson('/api/accounting/collections');

        $row = collect($response->json('data'))->firstWhere('source', 'courier_cod');
        $this->assertNull($row['collected_by_id']);
        $this->assertNull($row['collected_by_name']);
        $this->assertEquals(600.0, $row['amount']);
    }

    public function test_source_filter_returns_only_that_branch(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $this->makeManualPayment($order, $owner);
        $this->makeCourierCodTransaction($order);

        Sanctum::actingAs($owner);
        $response = $this->getJson('/api/accounting/collections?source=manual');

        $response->assertOk();
        $sources = collect($response->json('data'))->pluck('source')->unique()->all();
        $this->assertSame(['manual'], $sources);
    }

    public function test_collected_by_filter_excludes_courier_cod_rows(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $this->makeManualPayment($order, $owner);
        $this->makeCourierCodTransaction($order);

        Sanctum::actingAs($owner);
        $response = $this->getJson("/api/accounting/collections?collected_by={$owner->id}");

        $response->assertOk();
        $sources = collect($response->json('data'))->pluck('source')->unique()->all();
        $this->assertSame(['manual'], $sources);
    }

    public function test_search_matches_order_number_in_both_branches(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner, ['order_number' => 'ORD-FINDME-1']);
        $other = $this->makeOrder($owner, ['order_number' => 'ORD-OTHER-2']);
        $this->makeManualPayment($order, $owner);
        $this->makeCourierCodTransaction($order);
        $this->makeCourierCodTransaction($other);

        Sanctum::actingAs($owner);
        $response = $this->getJson('/api/accounting/collections?search=FINDME');

        $response->assertOk();
        $this->assertCount(2, $response->json('data'));
        foreach ($response->json('data') as $row) {
            $this->assertSame('ORD-FINDME-1', $row['order_number']);
        }
    }

    public function test_it_does_not_leak_another_shops_collections(): void
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        $order = $this->makeOrder($stranger);
        $this->makeManualPayment($order, $stranger);
        $this->makeCourierCodTransaction($order);

        Sanctum::actingAs($owner);
        $response = $this->getJson('/api/accounting/collections');

        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    public function test_a_staff_member_with_accounting_permission_can_read_it(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'accounting', 'enabled' => true]);
        $order = $this->makeOrder($owner);
        $this->makeManualPayment($order, $owner);

        Sanctum::actingAs($staff);
        $this->getJson('/api/accounting/collections')->assertOk();
    }

    public function test_summary_sums_both_sources(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $this->makeManualPayment($order, $owner); // 400
        $this->makeCourierCodTransaction($order); // 600

        Sanctum::actingAs($owner);
        $response = $this->getJson('/api/accounting/collections/summary?range=month');

        $response->assertOk();
        $this->assertEquals(400.0, $response->json('data.manual_total'));
        $this->assertEquals(600.0, $response->json('data.courier_cod_total'));
        $this->assertEquals(1000.0, $response->json('data.grand_total'));
    }

    public function test_pagination_is_correct_across_a_merged_result_set(): void
    {
        $owner = User::factory()->create();
        for ($i = 0; $i < 5; $i++) {
            $order = $this->makeOrder($owner, ['order_number' => 'ORD-PG-' . $i]);
            $this->makeManualPayment($order, $owner);
        }
        for ($i = 0; $i < 5; $i++) {
            $order = $this->makeOrder($owner, ['order_number' => 'ORD-PGC-' . $i]);
            $this->makeCourierCodTransaction($order);
        }

        Sanctum::actingAs($owner);

        $page1 = $this->getJson('/api/accounting/collections?per_page=4&page=1')->assertOk();
        $page2 = $this->getJson('/api/accounting/collections?per_page=4&page=2')->assertOk();
        $page3 = $this->getJson('/api/accounting/collections?per_page=4&page=3')->assertOk();

        $this->assertSame(10, $page1->json('meta.total'));
        $this->assertCount(4, $page1->json('data'));
        $this->assertCount(4, $page2->json('data'));
        $this->assertCount(2, $page3->json('data'));

        // No row appears on two different pages.
        $ids = collect([$page1, $page2, $page3])
            ->flatMap(fn ($r) => collect($r->json('data'))->map(fn ($row) => $row['source'] . ':' . $row['source_id']));
        $this->assertCount(10, $ids->unique());
    }
}
