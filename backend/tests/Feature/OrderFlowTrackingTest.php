<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PlatformApiKey;
use App\Models\Product;
use App\Models\SubscriptionPackage;
use App\Models\TrackingDestination;
use App\Models\TrackingEvent;
use App\Models\User;
use App\Services\OrderStatusService;
use App\Services\Tracking\TrackingIngestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

/**
 * T5 — order-status transitions submitting Meta order-flow events
 * (tracking_capi_context.md §1, §7). BSOL is the authoritative source for
 * these (courier delivery outcome, not a WooCommerce guess), so the hook
 * lives in OrderStatusService::transition() itself.
 */
class OrderFlowTrackingTest extends TestCase
{
    use RefreshDatabase;

    private int $productId;

    protected function setUp(): void
    {
        parent::setUp();

        // The actual Meta send (DispatchTrackingEventsJob) is T2's concern,
        // already covered in TrackingDispatchTest. Faking the queue here
        // keeps this file about whether transition() submits the right
        // event, not whether the sync test-queue driver runs it inline.
        Queue::fake();
    }

    private function seller(?int $limit = 100): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0,
            'duration_days' => 30, 'max_tracking_events_per_day' => $limit,
        ]);

        return User::factory()->create(['subscription_package_id' => $package->id]);
    }

    private function destination(User $user, array $overrides = []): TrackingDestination
    {
        return TrackingDestination::create(array_merge([
            'user_id' => $user->id,
            'pixel_id' => '1234567890',
            'access_token' => 'token-secret',
            'enabled' => true,
        ], $overrides));
    }

    private function order(User $user, array $overrides = []): Order
    {
        $order = Order::create(array_merge([
            'user_id' => $user->id,
            'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'subtotal' => 1000,
            'shipping_charge' => 120,
            'discount' => 0,
            'total' => 1120,
            'status' => 'pending',
        ], $overrides));

        $product = Product::create([
            'user_id' => $user->id, 'name' => 'Test Product', 'sku' => 'TP-' . uniqid(),
            'selling_price' => 1000, 'stock' => 100, 'track_stock' => false, 'status' => 'active',
        ]);

        OrderItem::create([
            'order_id' => $order->id, 'product_id' => $product->id,
            'product_name' => 'Test Product', 'quantity' => 1,
            'unit_price' => 1000, 'total' => 1000,
        ]);

        $this->productId = $product->id;

        return $order->fresh();
    }

    private function transition(Order $order, string $status): void
    {
        app(OrderStatusService::class)->transition($order, $status);
    }

    public function test_delivered_submits_orderdelivered_with_value_excluding_shipping(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $order = $this->order($user, ['status' => 'processing']);

        $this->transition($order, 'delivered');

        $event = TrackingEvent::sole();
        $this->assertSame('OrderDelivered', $event->event_name);
        $this->assertSame('order_' . $order->id . '_OrderDelivered', $event->event_id);
        $this->assertSame($order->id, $event->order_id);
        $this->assertSame('system_generated', $event->action_source);
        // total (1120) - shipping_charge (120) = 1000, not the full total.
        $this->assertEquals(1000.0, $event->custom_data['value']);
        $this->assertSame([$this->productId], $event->custom_data['content_ids']);
        $this->assertSame([hash('sha256', '8801712345678')], $event->user_data_hashed['ph']);
    }

    /**
     * Order-flow events fire from a status transition, not a checkout
     * request — the order row is the only place fbp/fbc can come from here
     * (tracking_capi_context.md §11.4).
     */
    public function test_delivered_carries_the_orders_persisted_fbp_and_fbc(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $order = $this->order($user, [
            'status' => 'processing',
            'fbp' => 'fb.1.1700000000000.111',
            'fbc' => 'fb.1.1700000000000.222',
        ]);

        $this->transition($order, 'delivered');

        $stored = TrackingEvent::sole()->user_data_hashed;
        $this->assertSame('fb.1.1700000000000.111', $stored['fbp']);
        $this->assertSame('fb.1.1700000000000.222', $stored['fbc']);
    }

    public function test_returned_submits_a_negative_value(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $order = $this->order($user, ['status' => 'delivered']);

        $this->transition($order, 'returned');

        $event = TrackingEvent::where('event_name', 'OrderReturned')->sole();
        $this->assertEquals(-1000.0, $event->custom_data['value']);
    }

    public function test_cancelled_submits_a_negative_value(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $order = $this->order($user, ['status' => 'processing']);

        $this->transition($order, 'cancelled');

        $event = TrackingEvent::where('event_name', 'OrderCanceled')->sole();
        $this->assertEquals(-1000.0, $event->custom_data['value']);
    }

    public function test_confirmed_and_shipped_submit_their_own_events(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $order = $this->order($user, ['status' => 'pending']);

        $this->transition($order, 'confirmed');
        $order->refresh();
        $this->transition($order, 'shipped');

        $this->assertSame(
            ['OrderConfirmed', 'OrderShipped'],
            TrackingEvent::orderBy('id')->pluck('event_name')->all()
        );
    }

    /** Nothing ad-relevant happens at these two — no event, no quota spent. */
    public function test_pending_and_processing_submit_nothing(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $order = $this->order($user, ['status' => 'pending']);

        $this->transition($order, 'processing');

        $this->assertSame(0, TrackingEvent::count());
    }

    public function test_no_destination_configured_is_a_silent_no_op(): void
    {
        $user = $this->seller();
        $order = $this->order($user, ['status' => 'processing']);

        // The core transition must still succeed with no tracking_destinations row.
        $this->transition($order, 'delivered');

        $this->assertSame('delivered', $order->fresh()->status);
        $this->assertSame(0, TrackingEvent::count());
    }

    /** Delivered → Returned → Delivered again must not double-count the same conversion. */
    public function test_flapping_back_to_a_status_does_not_duplicate_its_event(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $order = $this->order($user, ['status' => 'processing']);

        $this->transition($order, 'delivered');
        $order->refresh();
        $this->transition($order, 'returned');
        $order->refresh();
        $this->transition($order, 'delivered');

        // Only the first Delivered created a row — the second is a
        // same-event_id duplicate, silently rejected by ingest().
        $this->assertSame(1, TrackingEvent::where('event_name', 'OrderDelivered')->count());
        $this->assertSame(1, TrackingEvent::where('event_name', 'OrderReturned')->count());
    }

    /**
     * A repeat within one status is already a no-op before tracking is ever
     * reached — transition() itself returns early when old === new.
     */
    public function test_reapplying_the_same_status_is_a_no_op_at_the_transition_level(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $order = $this->order($user, ['status' => 'delivered']);

        $this->transition($order, 'delivered');

        $this->assertSame(0, TrackingEvent::count());
    }

    public function test_delivered_uses_the_orders_platform_api_key_scope(): void
    {
        $user = $this->seller();
        $rawKey = PlatformApiKey::generateRawKey();
        $apiKey = PlatformApiKey::create([
            'user_id' => $user->id, 'platform' => 'woocommerce', 'domain' => 'myshop.com',
            'key_hash' => PlatformApiKey::hashKey($rawKey), 'key_prefix' => substr($rawKey, 0, 12),
            'status' => 'connected',
        ]);
        $this->destination($user, ['scope_type' => 'platform_api_key', 'scope_id' => $apiKey->id]);
        $order = $this->order($user, ['status' => 'processing', 'platform_api_key_id' => $apiKey->id]);

        $this->transition($order, 'delivered');

        $event = TrackingEvent::sole();
        $this->assertSame($apiKey->id, $event->platform_api_key_id);
    }

    /**
     * A bug in the tracking pipeline is not allowed to break an order
     * status transition — that's core business logic, this is an ad
     * platform side-effect. Proven by making ingest() itself blow up.
     */
    public function test_a_tracking_pipeline_failure_does_not_break_the_status_transition(): void
    {
        $user = $this->seller();
        $order = $this->order($user, ['status' => 'processing']);

        $mock = Mockery::mock(TrackingIngestService::class);
        $mock->shouldReceive('ingest')->andThrow(new \RuntimeException('boom'));
        $this->app->instance(TrackingIngestService::class, $mock);

        app(OrderStatusService::class)->transition($order, 'delivered');

        $this->assertSame('delivered', $order->fresh()->status);
    }

    public function test_a_dropped_quota_event_still_leaves_the_status_transition_intact(): void
    {
        $user = $this->seller(0); // 0 = tracking not in package, even P0 refused
        $this->destination($user);
        $order = $this->order($user, ['status' => 'processing']);

        Http::fake();

        $this->transition($order, 'delivered');

        $this->assertSame('delivered', $order->fresh()->status);
        $this->assertSame(0, TrackingEvent::count());
    }
}
