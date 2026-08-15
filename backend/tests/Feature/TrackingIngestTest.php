<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\SubscriptionPackage;
use App\Models\TrackingDestination;
use App\Models\TrackingEvent;
use App\Models\TrackingUsageDaily;
use App\Models\User;
use App\Services\Tracking\TrackingIngestService;
use App\Services\Tracking\TrackingUserDataBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The ordering rules in TrackingIngestService — no destination costs
 * nothing, a duplicate costs nothing, and a dropped event never becomes a
 * row (tracking_capi_context.md §5.2, §5.3).
 */
class TrackingIngestTest extends TestCase
{
    use RefreshDatabase;

    private TrackingIngestService $ingest;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ingest = app(TrackingIngestService::class);
    }

    private function seller(?int $limit = null): User
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

    private function event(array $overrides = []): array
    {
        return array_merge([
            'event_name' => 'Purchase',
            'event_id' => 'order_1',
        ], $overrides);
    }

    /**
     * A seller who never configured a pixel must not spend a single slot —
     * otherwise a busy site burns the whole day's allowance on events that
     * had nowhere to go.
     */
    public function test_an_event_with_no_destination_is_neither_stored_nor_charged(): void
    {
        $user = $this->seller(100);

        $result = $this->ingest->ingest($user->id, $this->event());

        $this->assertSame(TrackingIngestService::NO_DESTINATION, $result['status']);
        $this->assertSame(0, TrackingEvent::count());
        $this->assertSame(0, TrackingUsageDaily::where('user_id', $user->id)->count());
    }

    public function test_an_accepted_event_is_stored_as_queued_and_counted(): void
    {
        $user = $this->seller(100);
        $this->destination($user);

        $result = $this->ingest->ingest($user->id, $this->event([
            'event_source_url' => 'https://zareen.zyrotechbd.com/offer',
            'custom_data' => ['currency' => 'BDT', 'value' => 1250],
        ]));

        $this->assertSame(TrackingIngestService::ACCEPTED, $result['status']);

        $row = TrackingEvent::sole();
        $this->assertSame($user->id, $row->user_id);
        $this->assertSame(TrackingEvent::STATUS_QUEUED, $row->status);
        $this->assertSame(1250, $row->custom_data['value']);
        // Fan-out happens at dispatch (T2) — one ingest is one row no matter
        // how many pixels end up receiving it (§11.1).
        $this->assertNull($row->tracking_destination_id);

        $this->assertSame(1, app(\App\Services\Tracking\TrackingQuotaService::class)->usageToday($user->id)['used']);
    }

    /** Raw PII must never reach the table — only sha256 of the normalised value. */
    public function test_customer_details_are_stored_hashed_never_raw(): void
    {
        $user = $this->seller(100);
        $this->destination($user);

        $this->ingest->ingest($user->id, $this->event([
            'user_data' => [
                'ph' => '01712345678',
                'em' => '  Zareen@Example.COM ',
                'fbp' => 'fb.1.1700000000000.123456',
                'client_ip_address' => '103.0.0.1',
            ],
        ]));

        $stored = TrackingEvent::sole()->user_data_hashed;

        $this->assertSame([hash('sha256', '8801712345678')], $stored['ph']);
        $this->assertSame([hash('sha256', 'zareen@example.com')], $stored['em']);
        // fbp and the IP are meaningless to Meta if hashed.
        $this->assertSame('fb.1.1700000000000.123456', $stored['fbp']);
        $this->assertSame('103.0.0.1', $stored['client_ip_address']);

        $encoded = json_encode($stored);
        $this->assertStringNotContainsString('01712345678', $encoded);
        $this->assertStringNotContainsString('zareen@example.com', $encoded);
    }

    /**
     * Meta pairs a browser event with its server counterpart on
     * event_name + event_id, so letting the same pair through twice would
     * have Meta count one conversion as two.
     */
    public function test_a_repeated_event_id_is_rejected_and_not_charged_twice(): void
    {
        $user = $this->seller(100);
        $this->destination($user);

        $this->ingest->ingest($user->id, $this->event());
        $second = $this->ingest->ingest($user->id, $this->event());

        $this->assertSame(TrackingIngestService::DUPLICATE, $second['status']);
        $this->assertSame(1, TrackingEvent::count());
        $this->assertSame(1, app(\App\Services\Tracking\TrackingQuotaService::class)->usageToday($user->id)['used']);
    }

    /** Same event id under a different name is a different event (Purchase vs OrderDelivered on one order). */
    public function test_the_same_id_under_a_different_event_name_is_allowed(): void
    {
        $user = $this->seller(100);
        $this->destination($user);

        $this->ingest->ingest($user->id, $this->event(['event_name' => 'Purchase', 'event_id' => 'order_7']));
        $result = $this->ingest->ingest($user->id, $this->event(['event_name' => 'OrderDelivered', 'event_id' => 'order_7']));

        $this->assertSame(TrackingIngestService::ACCEPTED, $result['status']);
        $this->assertSame(2, TrackingEvent::count());
    }

    /** Two sellers using the same id (both number their orders from 1) must not collide. */
    public function test_two_sellers_can_use_the_same_event_id(): void
    {
        $a = $this->seller(100);
        $b = $this->seller(100);
        $this->destination($a);
        $this->destination($b);

        $this->assertSame(TrackingIngestService::ACCEPTED, $this->ingest->ingest($a->id, $this->event())['status']);
        $this->assertSame(TrackingIngestService::ACCEPTED, $this->ingest->ingest($b->id, $this->event())['status']);

        $this->assertSame(2, TrackingEvent::count());
    }

    /**
     * Writing dropped events would defeat the point: the quota exists to cap
     * cost, and the row is most of the cost (§5.2).
     */
    public function test_a_dropped_event_is_not_written_to_the_events_table(): void
    {
        $user = $this->seller(2);
        $this->destination($user);

        $this->ingest->ingest($user->id, $this->event(['event_name' => 'PageView', 'event_id' => 'p1']));
        $this->ingest->ingest($user->id, $this->event(['event_name' => 'PageView', 'event_id' => 'p2']));
        $result = $this->ingest->ingest($user->id, $this->event(['event_name' => 'PageView', 'event_id' => 'p3']));

        $this->assertSame(TrackingIngestService::DROPPED, $result['status']);
        $this->assertSame(2, TrackingEvent::count());
        $this->assertSame(1, TrackingUsageDaily::where('user_id', $user->id)->value('dropped_count'));
    }

    public function test_an_event_missing_its_name_or_id_is_rejected(): void
    {
        $user = $this->seller(100);
        $this->destination($user);

        $this->assertSame(TrackingIngestService::INVALID, $this->ingest->ingest($user->id, ['event_id' => 'x'])['status']);
        $this->assertSame(TrackingIngestService::INVALID, $this->ingest->ingest($user->id, ['event_name' => 'Purchase'])['status']);
        $this->assertSame(0, TrackingEvent::count());
    }

    public function test_a_disabled_destination_does_not_count_as_a_destination(): void
    {
        $user = $this->seller(100);
        $this->destination($user, ['enabled' => false]);

        $this->assertSame(TrackingIngestService::NO_DESTINATION, $this->ingest->ingest($user->id, $this->event())['status']);
    }

    /** Enabled but with no token configured is just as unusable as disabled. */
    public function test_a_destination_without_credentials_does_not_count(): void
    {
        $user = $this->seller(100);
        $this->destination($user, ['access_token' => null]);

        $this->assertSame(TrackingIngestService::NO_DESTINATION, $this->ingest->ingest($user->id, $this->event())['status']);
    }

    /** A pixel pinned to one landing page must not receive another page's events. */
    public function test_a_scoped_destination_only_applies_within_its_scope(): void
    {
        $user = $this->seller(100);
        $page = LandingPage::create([
            'user_id' => $user->id, 'title' => 'Offer', 'slug' => 'offer',
            'content' => [], 'status' => 'draft',
        ]);
        $this->destination($user, ['scope_type' => 'landing_page', 'scope_id' => $page->id]);

        $outside = $this->ingest->ingest($user->id, $this->event(['event_id' => 'a']));
        $inside = $this->ingest->ingest($user->id, $this->event(['event_id' => 'b']), [
            'scope_type' => 'landing_page',
            'scope_id' => $page->id,
            'landing_page_id' => $page->id,
        ]);

        $this->assertSame(TrackingIngestService::NO_DESTINATION, $outside['status']);
        $this->assertSame(TrackingIngestService::ACCEPTED, $inside['status']);
        $this->assertSame($page->id, TrackingEvent::sole()->landing_page_id);
    }

    public function test_a_batch_reports_each_event_separately(): void
    {
        $user = $this->seller(100);
        $this->destination($user);

        $results = $this->ingest->ingestBatch($user->id, [
            $this->event(['event_id' => 'a']),
            ['event_name' => ''],                 // invalid
            $this->event(['event_id' => 'a']),    // duplicate of the first
        ]);

        $this->assertSame(
            [TrackingIngestService::ACCEPTED, TrackingIngestService::INVALID, TrackingIngestService::DUPLICATE],
            array_column($results, 'status')
        );
        $this->assertSame(1, TrackingEvent::count());
    }

    /**
     * The backfill copies ciphertext straight between two 'encrypted'
     * columns. This is the one assumption in it worth pinning down: a
     * ciphertext written raw still decrypts when read through the cast.
     */
    public function test_an_encrypted_token_survives_being_copied_as_raw_ciphertext(): void
    {
        $user = $this->seller();
        $original = $this->destination($user, ['access_token' => 'EAAG-secret-token']);

        $ciphertext = TrackingDestination::withoutGlobalScopes()
            ->getConnection()->table('tracking_destinations')->where('id', $original->id)->value('access_token');

        $copy = TrackingDestination::create([
            'user_id' => $user->id, 'pixel_id' => '999', 'enabled' => true,
        ]);
        $copy->getConnection()->table('tracking_destinations')
            ->where('id', $copy->id)->update(['access_token' => $ciphertext]);

        $this->assertSame('EAAG-secret-token', $copy->fresh()->access_token);
    }

    public function test_fbc_is_synthesised_from_a_click_id_when_the_cookie_is_missing(): void
    {
        $fbc = app(TrackingUserDataBuilder::class)->fbcFromClickId('IwAR123', 1700000000000);

        $this->assertSame('fb.1.1700000000000.IwAR123', $fbc);
        $this->assertNull(app(TrackingUserDataBuilder::class)->fbcFromClickId(null));
    }
}
