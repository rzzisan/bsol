<?php

namespace Tests\Feature;

use App\Console\Commands\SyncCourierStatuses;
use App\Models\CourierSetting;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Before this: CourierController::trackOrder() only ever wrote the raw
 * courier_status column — a real courier delivery never advanced order.status
 * (no inventory release, no COD income confirmation, no payment_status flip,
 * no Meta OrderDelivered pixel event, no order_status_logs row, invisible to
 * every delivered-based analytics query). See courier_status_sync_context.md.
 */
class CourierStatusSyncTest extends TestCase
{
    use RefreshDatabase;

    private function steadfastOrder(User $user, array $overrides = []): Order
    {
        $order = Order::create(array_merge([
            'user_id' => $user->id,
            'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'subtotal' => 500, 'shipping_charge' => 120, 'discount' => 0, 'total' => 620,
            'status' => 'processing',
            'payment_method' => 'cod',
            'payment_status' => 'partial',
            'courier_name' => 'steadfast',
            'courier_tracking_id' => '555444',
        ], $overrides));

        OrderItem::create([
            'order_id' => $order->id, 'product_name' => 'Test Product',
            'quantity' => 1, 'unit_price' => 500, 'total' => 500,
        ]);

        CourierSetting::updateOrCreate(
            ['user_id' => $user->id],
            ['steadfast_api_key' => 'sf-key', 'steadfast_secret_key' => 'sf-secret'],
        );

        return $order;
    }

    private function fakeSteadfastStatus(string $status): void
    {
        Http::fake([
            'portal.packzy.com/api/v1/status_by_cid/*' => Http::response(['delivery_status' => $status]),
        ]);
    }

    // ── CourierController::trackOrder() cascades into order.status ─────────────

    public function test_refreshing_a_delivered_courier_status_cascades_the_whole_order(): void
    {
        $user = User::factory()->create();
        $order = $this->steadfastOrder($user);

        // Real-world casing seen on a live order (dashboard capitalization,
        // not the API's lowercase slug) — classify() must not care.
        $this->fakeSteadfastStatus('Delivered');

        Sanctum::actingAs($user);

        $response = $this->getJson("/api/courier/track/{$order->id}");

        $response->assertOk();

        $order->refresh();
        $this->assertSame('Delivered', $order->courier_status);
        $this->assertSame('delivered', $order->status);
        $this->assertSame('paid', $order->payment_status);

        $this->assertDatabaseHas('order_status_logs', [
            'order_id' => $order->id, 'old_status' => 'processing', 'new_status' => 'delivered',
        ]);

        $transaction = Transaction::where('reference_type', 'order')->where('reference_id', $order->id)->first();
        $this->assertSame(Transaction::STATUS_CONFIRMED, $transaction->status);
        $this->assertEquals(620.0, (float) $transaction->amount);
    }

    public function test_an_in_transit_status_advances_to_shipped_not_delivered(): void
    {
        $user = User::factory()->create();
        $order = $this->steadfastOrder($user);
        $this->fakeSteadfastStatus('in_transit');

        Sanctum::actingAs($user);
        $this->getJson("/api/courier/track/{$order->id}")->assertOk();

        $order->refresh();
        $this->assertSame('shipped', $order->status);
        $this->assertSame('partial', $order->payment_status); // unchanged — not delivered yet
    }

    public function test_an_unrecognized_status_leaves_order_status_untouched(): void
    {
        $user = User::factory()->create();
        $order = $this->steadfastOrder($user);
        $this->fakeSteadfastStatus('in_review');

        Sanctum::actingAs($user);
        $this->getJson("/api/courier/track/{$order->id}")->assertOk();

        $order->refresh();
        $this->assertSame('in_review', $order->courier_status); // still persisted
        $this->assertSame('processing', $order->status); // but no confident mapping — no cascade
    }

    public function test_a_delivered_order_is_never_moved_back_by_a_later_status_flap(): void
    {
        $user = User::factory()->create();
        $order = $this->steadfastOrder($user, ['status' => 'delivered', 'payment_status' => 'paid']);
        $this->fakeSteadfastStatus('cancelled'); // courier's own data glitching post-delivery

        Sanctum::actingAs($user);
        $this->getJson("/api/courier/track/{$order->id}")->assertOk();

        $order->refresh();
        $this->assertSame('delivered', $order->status); // terminal — never re-opened
        $this->assertSame('paid', $order->payment_status);
        $this->assertSame(0, OrderStatusLog::where('order_id', $order->id)->count()); // guard short-circuits before transition() ever logs anything
    }

    public function test_a_returned_order_reverses_a_previously_confirmed_cod_payment(): void
    {
        $user = User::factory()->create();
        $order = $this->steadfastOrder($user, ['status' => 'shipped', 'payment_status' => 'paid']);
        $this->fakeSteadfastStatus('Returned');

        Sanctum::actingAs($user);
        $this->getJson("/api/courier/track/{$order->id}")->assertOk();

        $order->refresh();
        $this->assertSame('returned', $order->status);
        $this->assertSame('due', $order->payment_status);
        $this->assertSame(0, Transaction::where('reference_type', 'order')->where('reference_id', $order->id)->count());
    }

    // ── app:sync-courier-statuses (the missing automatic trigger) ──────────────

    public function test_the_scheduled_command_syncs_every_eligible_order(): void
    {
        $user = User::factory()->create();
        $delivered = $this->steadfastOrder($user, ['courier_tracking_id' => '111']);
        $alreadyDelivered = $this->steadfastOrder($user, ['courier_tracking_id' => '222', 'status' => 'delivered']);
        $noCourier = Order::create([
            'user_id' => $user->id, 'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)), 'customer_phone' => '01711112222',
            'subtotal' => 100, 'shipping_charge' => 0, 'discount' => 0, 'total' => 100,
            'status' => 'processing',
        ]);

        $this->fakeSteadfastStatus('Delivered');

        $this->artisan(SyncCourierStatuses::class)->assertSuccessful();

        $this->assertSame('delivered', $delivered->fresh()->status);
        $this->assertSame('delivered', $alreadyDelivered->fresh()->status); // untouched, was already terminal
        $this->assertSame('processing', $noCourier->fresh()->status); // no tracking id — never queried

        Http::assertSentCount(1); // only the one still-open, courier-tracked order was polled
    }
}
