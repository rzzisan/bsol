<?php

namespace Tests\Feature;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Models\StaffPermission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Courier COD amount must default to the real due balance (total minus
 * everything already manually collected), never the full order total, and
 * staff sub-accounts can never override it. See
 * manual_payment_collection_context.md §3খ.
 */
class CourierCodAmountTest extends TestCase
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
            'customer_address' => 'House 1, Road 2, Mirpur, Dhaka',
            'subtotal' => 1000, 'shipping_charge' => 0, 'discount' => 0, 'total' => 1000,
            'status' => 'confirmed',
        ], $overrides));
    }

    private function collectManualPayment(Order $order, User $owner, float $amount): void
    {
        Sanctum::actingAs($owner);
        $this->postJson("/api/orders/{$order->id}/payments", [
            'purpose' => 'advance', 'method' => 'cash', 'amount' => $amount, 'collected_by' => $owner->id,
        ])->assertCreated();
    }

    private function fakeSteadfastBooking(): void
    {
        Http::fake([
            'portal.packzy.com/api/v1/create_order' => Http::response(['consignment_id' => 555111]),
        ]);
    }

    // ── Manual tracking entry branch ────────────────────────────────────────

    public function test_manual_entry_defaults_cod_to_the_real_due_amount(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $this->collectManualPayment($order, $owner, 500); // due now 500

        Sanctum::actingAs($owner);
        $this->postJson("/api/courier/book/{$order->id}", [
            'courier' => 'manual', 'tracking_id' => 'MANUAL-1',
        ])->assertOk();

        $this->assertEquals(500.0, (float) $order->fresh()->courier_cod_amount);
    }

    public function test_owner_can_still_hand_set_a_different_cod_amount(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $this->collectManualPayment($order, $owner, 500); // due 500

        Sanctum::actingAs($owner);
        $this->postJson("/api/courier/book/{$order->id}", [
            'courier' => 'manual', 'tracking_id' => 'MANUAL-1', 'cod_amount' => 300,
        ])->assertOk();

        $this->assertEquals(300.0, (float) $order->fresh()->courier_cod_amount);
    }

    public function test_staff_cannot_override_cod_amount(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'courier', 'enabled' => true]);
        $order = $this->makeOrder($owner);
        $this->collectManualPayment($order, $owner, 500); // due 500

        Sanctum::actingAs($staff);
        $this->postJson("/api/courier/book/{$order->id}", [
            'courier' => 'manual', 'tracking_id' => 'MANUAL-1', 'cod_amount' => 999, // ignored
        ])->assertOk();

        $this->assertEquals(500.0, (float) $order->fresh()->courier_cod_amount);
    }

    // ── Real provider (Steadfast) booking branch ────────────────────────────

    public function test_steadfast_booking_defaults_cod_to_due_not_total(): void
    {
        $owner = User::factory()->create();
        CourierSetting::create(['user_id' => $owner->id, 'steadfast_api_key' => 'k', 'steadfast_secret_key' => 's']);
        $order = $this->makeOrder($owner);
        $this->collectManualPayment($order, $owner, 500); // due 500
        $this->fakeSteadfastBooking();

        Sanctum::actingAs($owner);
        $this->postJson("/api/courier/book/{$order->id}", ['courier' => 'steadfast'])->assertOk();

        $this->assertEquals(500.0, (float) $order->fresh()->courier_cod_amount);
        Http::assertSent(fn ($request) => ($request['cod_amount'] ?? null) == 500);
    }

    public function test_an_order_with_no_manual_payments_still_defaults_to_the_full_total(): void
    {
        $owner = User::factory()->create();
        CourierSetting::create(['user_id' => $owner->id, 'steadfast_api_key' => 'k', 'steadfast_secret_key' => 's']);
        $order = $this->makeOrder($owner);
        $this->fakeSteadfastBooking();

        Sanctum::actingAs($owner);
        $this->postJson("/api/courier/book/{$order->id}", ['courier' => 'steadfast'])->assertOk();

        $this->assertEquals(1000.0, (float) $order->fresh()->courier_cod_amount);
    }

    // ── List endpoints expose paid/due ──────────────────────────────────────

    public function test_order_index_exposes_paid_and_due_amounts(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $this->collectManualPayment($order, $owner, 500);

        Sanctum::actingAs($owner);
        $response = $this->getJson('/api/orders');

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('id', $order->id);
        $this->assertEquals(500.0, (float) $row['paid_amount']);
        $this->assertEquals(500.0, (float) $row['due_amount']);
    }

    public function test_ready_to_book_exposes_due_amount(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);
        $this->collectManualPayment($order, $owner, 500);

        Sanctum::actingAs($owner);
        $response = $this->getJson('/api/courier/ready');

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('id', $order->id);
        $this->assertEquals(500.0, (float) $row['due_amount']);
    }
}
