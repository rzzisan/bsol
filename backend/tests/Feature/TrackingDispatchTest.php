<?php

namespace Tests\Feature;

use App\Jobs\DispatchTrackingEventsJob;
use App\Jobs\SendFacebookCapiPurchaseEventJob;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\SubscriptionPackage;
use App\Models\TrackingDestination;
use App\Models\TrackingEvent;
use App\Models\TrackingUsageDaily;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * T2 — the actual send to Meta. DispatchTrackingEventsJob (fan-out, retry,
 * per-destination result) and SendFacebookCapiPurchaseEventJob as a thin
 * wrapper over the pipeline it used to talk to Meta directly from
 * (tracking_capi_context.md §6.1).
 */
class TrackingDispatchTest extends TestCase
{
    use RefreshDatabase;

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
            'label' => 'Default',
            'pixel_id' => '1234567890',
            'access_token' => 'token-secret',
            'enabled' => true,
        ], $overrides));
    }

    private function queuedEvent(User $user, array $overrides = []): TrackingEvent
    {
        return TrackingEvent::create(array_merge([
            'user_id' => $user->id,
            'event_name' => 'Purchase',
            'event_id' => 'order_1',
            'event_time' => Carbon::now(),
            'action_source' => 'website',
            'user_data_hashed' => ['ph' => [hash('sha256', '8801712345678')]],
            'custom_data' => ['currency' => 'BDT', 'value' => 500],
            'status' => TrackingEvent::STATUS_QUEUED,
        ], $overrides));
    }

    private function runDispatch(TrackingEvent $event): void
    {
        // Direct handle() call, not ::dispatch() — deterministic regardless
        // of how the sync queue driver treats retries/failed(), and this is
        // the only path that matters: the job's own decision logic.
        app()->call([new DispatchTrackingEventsJob($event->id), 'handle']);
    }

    // -- DispatchTrackingEventsJob ------------------------------------------------

    public function test_a_successful_send_marks_the_event_sent_and_updates_the_destination(): void
    {
        $user = $this->seller();
        $destination = $this->destination($user);
        $event = $this->queuedEvent($user);

        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1, 'fbtrace_id' => 'abc'], 200)]);

        $this->runDispatch($event);

        $event->refresh();
        $this->assertSame(TrackingEvent::STATUS_SENT, $event->status);
        $this->assertSame($destination->id, $event->tracking_destination_id);
        $this->assertNotNull($event->sent_at);
        $this->assertSame(1, $event->attempts);
        $this->assertNull($event->error_message);

        $destination->refresh();
        $this->assertNotNull($destination->last_sent_at);
        $this->assertNull($destination->last_error);

        $this->assertSame(1, TrackingUsageDaily::where('user_id', $user->id)->value('sent_count'));
    }

    public function test_the_meta_request_carries_the_destinations_own_access_token_and_pixel(): void
    {
        $user = $this->seller();
        $destination = $this->destination($user, ['pixel_id' => 'px_999', 'access_token' => 'super-secret-token']);
        $event = $this->queuedEvent($user);

        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1], 200)]);

        $this->runDispatch($event);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/px_999/events')
                && $request['access_token'] === 'super-secret-token'
                && $request['data'][0]['event_name'] === 'Purchase'
                && $request['data'][0]['event_id'] === 'order_1';
        });
    }

    /** A rejected/unreachable send throws so the queue worker retries — nothing is marked failed yet. */
    public function test_a_failed_send_is_not_marked_failed_before_retries_are_exhausted(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $event = $this->queuedEvent($user);

        Http::fake(['graph.facebook.com/*' => Http::response(['error' => ['message' => 'Invalid OAuth access token']], 400)]);

        try {
            $this->runDispatch($event);
            $this->fail('Expected the job to throw so the worker retries.');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('Invalid OAuth access token', $e->getMessage());
        }

        $event->refresh();
        $this->assertSame(TrackingEvent::STATUS_QUEUED, $event->status);
        $this->assertSame(1, $event->attempts);
        $this->assertStringContainsString('Invalid OAuth access token', $event->error_message);
    }

    /** failed() runs once the queue worker gives up — that's what actually closes the row out. */
    public function test_failed_marks_the_event_failed_once_retries_are_exhausted(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $event = $this->queuedEvent($user);

        $job = new DispatchTrackingEventsJob($event->id);
        $job->failed(new \RuntimeException('Meta CAPI dispatch failed'));

        $event->refresh();
        $this->assertSame(TrackingEvent::STATUS_FAILED, $event->status);
        $this->assertSame(1, TrackingUsageDaily::where('user_id', $user->id)->value('failed_count'));
    }

    /**
     * One pixel takes it, one rejects it — still counts as delivered.
     * Resending to the destination that already succeeded would waste its
     * rate limit for nothing (Meta already dedupes on event_id).
     */
    public function test_one_destination_succeeding_is_enough_to_mark_the_event_sent(): void
    {
        $user = $this->seller();
        $good = $this->destination($user, ['label' => 'Good Pixel', 'pixel_id' => 'good_px']);
        $bad = $this->destination($user, ['label' => 'Bad Pixel', 'pixel_id' => 'bad_px']);
        $event = $this->queuedEvent($user);

        Http::fake([
            'graph.facebook.com/*/good_px/events' => Http::response(['events_received' => 1], 200),
            'graph.facebook.com/*/bad_px/events' => Http::response(['error' => ['message' => 'Rejected']], 400),
        ]);

        $this->runDispatch($event);

        $event->refresh();
        $this->assertSame(TrackingEvent::STATUS_SENT, $event->status);
        $this->assertSame($good->id, $event->tracking_destination_id);
        $this->assertStringContainsString('Bad Pixel', $event->error_message);
        $this->assertStringContainsString('Rejected', $event->error_message);

        $this->assertNotNull($good->fresh()->last_sent_at);
        $this->assertSame('Rejected', $bad->fresh()->last_error);
    }

    /** The destination was disabled/deleted between ingest and dispatch — nothing to retry. */
    public function test_no_sendable_destination_at_dispatch_time_fails_immediately_without_a_request(): void
    {
        $user = $this->seller();
        $this->destination($user, ['enabled' => false]);
        $event = $this->queuedEvent($user);

        Http::fake();

        $this->runDispatch($event);

        $event->refresh();
        $this->assertSame(TrackingEvent::STATUS_FAILED, $event->status);
        $this->assertStringContainsString('No sendable destination', $event->error_message);
        Http::assertNothingSent();

        $this->assertSame(1, TrackingUsageDaily::where('user_id', $user->id)->value('failed_count'));
    }

    /** Already-sent rows (a retry that lost a race with a successful attempt) are left alone. */
    public function test_an_already_sent_event_is_not_reprocessed(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $event = $this->queuedEvent($user, ['status' => TrackingEvent::STATUS_SENT, 'attempts' => 1]);

        Http::fake();

        $this->runDispatch($event);

        Http::assertNothingSent();
    }

    // -- SendFacebookCapiPurchaseEventJob (thin wrapper) --------------------------

    private function orderWithItem(User $user, array $overrides = []): Order
    {
        $order = Order::create(array_merge([
            'user_id' => $user->id,
            'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'total' => 1500,
            'status' => 'pending',
        ], $overrides));

        OrderItem::create([
            'order_id' => $order->id,
            'product_name' => 'Test Product',
            'quantity' => 2,
            'unit_price' => 750,
            'total' => 1500,
        ]);

        return $order;
    }

    public function test_the_purchase_job_submits_into_the_tracking_pipeline_and_reaches_meta(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $order = $this->orderWithItem($user);

        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1], 200)]);

        SendFacebookCapiPurchaseEventJob::dispatch($order->id, '103.0.0.1', 'Mozilla/5.0', 'https://zareen.zyrotechbd.com/thank-you');

        $event = TrackingEvent::sole();
        $this->assertSame('order_' . $order->id, $event->event_id);
        $this->assertSame('Purchase', $event->event_name);
        $this->assertSame($order->id, $event->order_id);
        $this->assertSame(TrackingEvent::STATUS_SENT, $event->status);
        // Same normalization SendFacebookCapiPurchaseEventJob always used —
        // TrackingUserDataBuilder now does it, but the digest must match.
        $this->assertSame([hash('sha256', '8801712345678')], $event->user_data_hashed['ph']);
        $this->assertEquals(1500.0, $event->custom_data['value']);
    }

    /** No pixel configured — silent no-op, exactly like the job's previous behavior. */
    public function test_the_purchase_job_is_a_silent_no_op_with_no_destination_configured(): void
    {
        $user = $this->seller();
        $order = $this->orderWithItem($user);

        Http::fake();

        SendFacebookCapiPurchaseEventJob::dispatch($order->id, null, null, 'https://zareen.zyrotechbd.com/thank-you');

        $this->assertSame(0, TrackingEvent::count());
        Http::assertNothingSent();
    }

    public function test_the_purchase_job_is_a_no_op_for_a_missing_order(): void
    {
        Http::fake();

        SendFacebookCapiPurchaseEventJob::dispatch(999999, null, null, 'https://example.com');

        $this->assertSame(0, TrackingEvent::count());
        Http::assertNothingSent();
    }

    /** Re-dispatching for the same order (e.g. a job retry after a partial failure) must not double-send. */
    public function test_a_repeated_dispatch_for_the_same_order_does_not_double_send(): void
    {
        $user = $this->seller();
        $this->destination($user);
        $order = $this->orderWithItem($user);

        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1], 200)]);

        SendFacebookCapiPurchaseEventJob::dispatch($order->id, null, null, 'https://example.com');
        SendFacebookCapiPurchaseEventJob::dispatch($order->id, null, null, 'https://example.com');

        $this->assertSame(1, TrackingEvent::count());
        Http::assertSentCount(1);
    }
}
