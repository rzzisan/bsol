<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\TrackingEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * GET /orders/{id} — the fraud-signal section T7 adds to order detail
 * (tracking_capi_context.md §9): which tracking events fired for this
 * order, and whether Meta's strongest match signals (fbp/fbc) were present.
 */
class OrderTrackingSignalTest extends TestCase
{
    use RefreshDatabase;

    private function order(User $user): Order
    {
        return Order::create([
            'user_id' => $user->id,
            'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'subtotal' => 1000, 'shipping_charge' => 120, 'discount' => 0, 'total' => 1120,
            'status' => 'pending',
        ]);
    }

    public function test_order_detail_lists_its_tracking_events_with_match_signals(): void
    {
        $owner = User::factory()->create();
        $order = $this->order($owner);

        TrackingEvent::create([
            'user_id' => $owner->id, 'order_id' => $order->id,
            'event_name' => 'Purchase', 'event_id' => 'order_' . $order->id,
            'event_time' => now(), 'status' => 'sent',
            'user_data_hashed' => ['ph' => ['x'], 'fbc' => 'fb.1.1.1'],
        ]);

        Sanctum::actingAs($owner);

        $this->getJson("/api/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.tracking_events.0.event_name', 'Purchase')
            ->assertJsonPath('data.tracking_events.0.has_fbc', true)
            ->assertJsonPath('data.tracking_events.0.has_fbp', false)
            ->assertJsonMissingPath('data.tracking_events.0.user_data_hashed');
    }

    public function test_an_order_with_no_tracking_events_reports_an_empty_list(): void
    {
        $owner = User::factory()->create();
        $order = $this->order($owner);

        Sanctum::actingAs($owner);

        $this->getJson("/api/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.tracking_events', []);
    }
}
