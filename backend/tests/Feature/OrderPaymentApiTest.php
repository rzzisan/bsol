<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\StaffPermission;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Manual payment collection — see manual_payment_collection_context.md.
 */
class OrderPaymentApiTest extends TestCase
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
            'subtotal' => 500, 'shipping_charge' => 120, 'discount' => 0, 'total' => 620,
            'status' => 'processing',
            'payment_method' => 'cod',
            'payment_status' => 'due',
        ], $overrides));
    }

    public function test_recording_a_manual_payment_reduces_due_and_books_a_transaction(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);

        Sanctum::actingAs($owner);

        $response = $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'advance',
            'method' => 'cash',
            'amount' => 100,
            'collected_by' => $owner->id,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.order.due_amount', 520);
        $response->assertJsonPath('data.order.payment_status', 'partial');

        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id, 'amount' => 100, 'purpose' => 'advance', 'method' => 'cash',
        ]);

        $transaction = Transaction::where('reference_type', 'order_payment')->first();
        $this->assertNotNull($transaction);
        $this->assertSame('order_manual_payment', $transaction->category);
        $this->assertSame(Transaction::STATUS_CONFIRMED, $transaction->status);
        $this->assertEquals(100.0, (float) $transaction->amount);

        $this->assertSame('partial', $order->fresh()->payment_status);
    }

    public function test_collecting_the_full_due_amount_marks_the_order_paid(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'full_payment', 'method' => 'cash', 'amount' => 620, 'collected_by' => $owner->id,
        ])->assertCreated();

        $order->refresh();
        $this->assertSame('paid', $order->payment_status);
        $this->assertSame(0.0, $order->dueAmount());
    }

    public function test_a_discount_only_entry_reduces_due_without_a_transaction(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'other', 'method' => 'other', 'discount' => 620, 'collected_by' => $owner->id,
        ])->assertCreated();

        $order->refresh();
        $this->assertSame('paid', $order->payment_status);
        $this->assertSame(0, Transaction::where('reference_type', 'order_payment')->count());
    }

    public function test_screenshot_is_required_for_mobile_banking_methods(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'full_payment', 'method' => 'bkash', 'amount' => 620, 'collected_by' => $owner->id,
        ])->assertJsonValidationErrors('screenshot');

        $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'full_payment', 'method' => 'bkash', 'amount' => 620, 'collected_by' => $owner->id,
            'screenshot' => UploadedFile::fake()->image('proof.jpg'),
        ])->assertCreated();

        $this->assertNotNull($order->fresh()->payments()->first()->screenshot_path);
    }

    public function test_collected_by_must_be_a_shop_team_member(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $outsider = User::factory()->create();
        Sanctum::actingAs($owner);

        $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'advance', 'method' => 'cash', 'amount' => 100, 'collected_by' => $outsider->id,
        ])->assertJsonValidationErrors('collected_by');
    }

    public function test_a_staff_member_can_log_a_payment_received_by_the_owner(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'orders', 'enabled' => true]);
        $order = $this->makeOrder($owner);

        Sanctum::actingAs($staff);

        $response = $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'advance', 'method' => 'cash', 'amount' => 100, 'collected_by' => $owner->id,
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id, 'collected_by' => $owner->id, 'created_by' => $staff->id,
        ]);
    }

    public function test_deleting_a_payment_reverses_the_transaction_and_recomputes_due(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        Sanctum::actingAs($owner);

        $create = $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'full_payment', 'method' => 'cash', 'amount' => 620, 'collected_by' => $owner->id,
        ]);
        $paymentId = $create->json('data.payment.id');
        $this->assertSame('paid', $order->fresh()->payment_status);

        $this->deleteJson("/api/orders/{$order->id}/payments/{$paymentId}")
            ->assertOk()
            ->assertJsonPath('data.order.due_amount', 620)
            ->assertJsonPath('data.order.payment_status', 'due');

        $this->assertSame(0, Transaction::where('reference_type', 'order_payment')->count());
        $this->assertDatabaseMissing('order_payments', ['id' => $paymentId]);
    }

    public function test_index_returns_history_and_shop_collector_list(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'orders', 'enabled' => true]);
        $order = $this->makeOrder($owner);

        Sanctum::actingAs($owner);
        $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'advance', 'method' => 'cash', 'amount' => 100, 'collected_by' => $staff->id,
        ])->assertCreated();

        $response = $this->getJson("/api/orders/{$order->id}/payments");

        $response->assertOk();
        $response->assertJsonCount(1, 'data.payments');
        $response->assertJsonCount(2, 'data.collectors'); // owner + staff
        $response->assertJsonPath('data.order.due_amount', 520);
    }
}
