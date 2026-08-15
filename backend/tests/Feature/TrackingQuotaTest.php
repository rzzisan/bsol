<?php

namespace Tests\Feature;

use App\Models\SubscriptionPackage;
use App\Models\TrackingUsageDaily;
use App\Models\User;
use App\Services\Tracking\TrackingQuotaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * The quota tiering from tracking_capi_context.md §5.2. The property that
 * matters most: a seller who blows through their limit still gets Purchase
 * and OrderDelivered delivered to Meta, because losing those is losing the
 * feature itself.
 */
class TrackingQuotaTest extends TestCase
{
    use RefreshDatabase;

    private TrackingQuotaService $quota;

    protected function setUp(): void
    {
        parent::setUp();
        $this->quota = app(TrackingQuotaService::class);
    }

    private function sellerWithLimit(?int $limit): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0,
            'duration_days' => 30, 'max_tracking_events_per_day' => $limit,
        ]);

        return User::factory()->create(['subscription_package_id' => $package->id]);
    }

    /**
     * Replace the sampling coin flip with a fixed outcome. Without this any
     * assertion near a threshold is itself a coin flip, and neither sampling
     * branch is ever really covered.
     */
    private function pinSampling(bool $keep): void
    {
        $this->quota = new class($keep) extends TrackingQuotaService
        {
            public function __construct(private readonly bool $keep) {}

            protected function keepSample(): bool
            {
                return $this->keep;
            }
        };
    }

    /** Burn n slots so the counter sits at a known point. */
    private function spend(User $user, int $n): void
    {
        for ($i = 0; $i < $n; $i++) {
            $this->quota->admit($user->id, 'Purchase');
        }
    }

    public function test_a_package_without_a_limit_admits_everything(): void
    {
        $user = $this->sellerWithLimit(null);

        foreach (['Purchase', 'AddToCart', 'PageView'] as $event) {
            $this->assertTrue($this->quota->admit($user->id, $event)['admitted']);
        }

        $this->assertNull($this->quota->usageToday($user->id)['limit']);
    }

    /** 0 is "tracking is not part of this package" — different from a spent quota, so P0 gets no exemption. */
    public function test_a_zero_limit_blocks_even_critical_events(): void
    {
        $user = $this->sellerWithLimit(0);

        $decision = $this->quota->admit($user->id, 'Purchase');

        $this->assertFalse($decision['admitted']);
        $this->assertSame('tracking_not_in_package', $decision['reason']);
        $this->assertSame(1, TrackingUsageDaily::where('user_id', $user->id)->value('dropped_count'));
    }

    public function test_critical_events_are_admitted_past_the_limit_and_counted_as_overage(): void
    {
        $user = $this->sellerWithLimit(10);
        $this->spend($user, 10);

        $decision = $this->quota->admit($user->id, 'OrderDelivered');

        $this->assertTrue($decision['admitted']);
        $this->assertTrue($decision['overage']);

        $usage = $this->quota->usageToday($user->id);
        $this->assertSame(1, $usage['overage']);
        // The meter stops at 100% rather than reading past it — nothing is
        // actually being blocked, so a 110% reading would look like a bug.
        $this->assertSame(100, $usage['percent']);
    }

    public function test_funnel_events_are_dropped_once_the_limit_is_reached(): void
    {
        $user = $this->sellerWithLimit(10);
        $this->spend($user, 10);

        $decision = $this->quota->admit($user->id, 'AddToCart');

        $this->assertFalse($decision['admitted']);
        $this->assertSame('quota_exceeded', $decision['reason']);
        $this->assertSame(TrackingQuotaService::P1, $decision['priority']);
    }

    /** Ambient traffic is shed at 80%, keeping the last fifth of the quota for events worth more. */
    public function test_ambient_events_are_dropped_before_funnel_events(): void
    {
        $this->pinSampling(true); // the funnel event is inside its sampling band here
        $user = $this->sellerWithLimit(100);
        $this->spend($user, 85);

        $this->assertFalse($this->quota->admit($user->id, 'PageView')['admitted']);
        $this->assertTrue($this->quota->admit($user->id, 'InitiateCheckout')['admitted']);
    }

    public function test_funnel_events_are_sampled_between_80_and_100_percent(): void
    {
        $this->pinSampling(false);
        $user = $this->sellerWithLimit(100);
        $this->spend($user, 85);

        $decision = $this->quota->admit($user->id, 'AddToCart');

        $this->assertFalse($decision['admitted']);
        $this->assertSame('quota_sampled', $decision['reason']);
    }

    public function test_ambient_events_start_being_sampled_at_60_percent(): void
    {
        $user = $this->sellerWithLimit(100);
        $this->spend($user, 65);

        $this->pinSampling(false);
        $this->assertSame('quota_sampled', $this->quota->admit($user->id, 'PageView')['reason']);

        $this->pinSampling(true);
        $this->assertTrue($this->quota->admit($user->id, 'PageView')['admitted']);
    }

    /** Below every threshold nothing is sampled, so a losing coin flip changes nothing. */
    public function test_nothing_is_sampled_while_the_quota_is_barely_used(): void
    {
        $this->pinSampling(false);
        $user = $this->sellerWithLimit(100);
        $this->spend($user, 10);

        $this->assertTrue($this->quota->admit($user->id, 'PageView')['admitted']);
        $this->assertTrue($this->quota->admit($user->id, 'AddToCart')['admitted']);
    }

    public function test_dropped_events_do_not_consume_quota(): void
    {
        $user = $this->sellerWithLimit(10);
        $this->spend($user, 10);

        $this->quota->admit($user->id, 'PageView');
        $this->quota->admit($user->id, 'PageView');

        $usage = $this->quota->usageToday($user->id);
        $this->assertSame(10, $usage['used']);
        $this->assertSame(2, $usage['dropped']);
    }

    public function test_an_unknown_event_name_is_treated_as_funnel(): void
    {
        // Not P0: a custom name must not be a way around the limit. Not P2:
        // a seller who deliberately sent it probably wants it kept.
        $this->assertSame(TrackingQuotaService::P1, $this->quota->priorityFor('SomeCustomEvent'));
    }

    public function test_a_refund_returns_the_slot(): void
    {
        $user = $this->sellerWithLimit(10);
        $this->spend($user, 3);

        $this->quota->refund($user->id);

        $this->assertSame(2, $this->quota->usageToday($user->id)['used']);
        $this->assertTrue($this->quota->admit($user->id, 'PageView')['admitted']);
    }

    /** A refund on a fresh counter must not go negative, or the day turns into free quota. */
    public function test_a_refund_cannot_drive_counters_below_zero(): void
    {
        $user = $this->sellerWithLimit(10);

        $this->quota->refund($user->id, true);

        $usage = $this->quota->usageToday($user->id);
        $this->assertSame(0, $usage['used']);
        $this->assertSame(0, $usage['overage']);
        $this->assertSame(0, (int) Cache::get('tracking:q:' . $user->id . ':' . $this->quota->today(), 0));
    }

    /**
     * The window is the seller's calendar day, not UTC's. At 20:00 UTC it is
     * already 02:00 the next day in Dhaka, so a UTC-based counter would give
     * a seller two partial days instead of one whole one.
     */
    public function test_the_day_boundary_follows_dhaka_not_utc(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-15 20:00:00', 'UTC'));

        $user = $this->sellerWithLimit(10);
        $this->quota->admit($user->id, 'Purchase');

        $this->assertSame('2026-08-16', $this->quota->today());
        $this->assertDatabaseHas('tracking_usage_daily', [
            'user_id' => $user->id,
            'date' => '2026-08-16',
            'accepted_count' => 1,
        ]);

        Carbon::setTestNow();
    }
}
