<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\LandingPageVisit;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * pre_launch_polish_context.md §ঘ — checklist claimed order_id here wasn't
 * scoped to the caller's own orders (just a global `exists` check), which
 * would let a seller link another seller's order into their own landing
 * page's analytics. Verified already fixed by an earlier commit
 * (36fab21, "fix: landing-page analytics IDOR + cleanup dead GrapesJS/
 * legacy code") — this locks that fix in with a regression test, since
 * none existed for it yet.
 */
class LandingPageAnalyticsLinkVisitTest extends TestCase
{
    use RefreshDatabase;

    private function landingPage(User $owner): LandingPage
    {
        return LandingPage::create([
            'user_id' => $owner->id,
            'title' => 'Test Page',
            'slug' => 'test-page-' . $owner->id . '-' . uniqid(),
            'status' => 'published',
        ]);
    }

    private function visit(LandingPage $page): LandingPageVisit
    {
        return LandingPageVisit::create([
            'landing_page_id' => $page->id,
            'ip_address' => '127.0.0.1',
        ]);
    }

    private function order(User $owner, string $orderNumber): Order
    {
        return Order::create([
            'user_id' => $owner->id,
            'order_number' => $orderNumber,
            'customer_name' => 'Test Customer',
            'customer_phone' => '01711223344',
            'customer_address' => 'Some Address',
            'status' => 'confirmed',
            'total' => 500,
        ]);
    }

    public function test_owner_can_link_their_own_visit_to_their_own_order(): void
    {
        $owner = User::factory()->create();
        $page = $this->landingPage($owner);
        $visit = $this->visit($page);
        $order = $this->order($owner, 'ORD-OWN-1');

        $response = $this->actingAs($owner)->postJson(
            "/api/landing/analytics/{$page->id}/link-visit-to-order",
            ['visit_id' => $visit->id, 'order_id' => $order->id]
        );

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertTrue($visit->orders()->where('orders.id', $order->id)->exists());
    }

    public function test_cannot_link_another_sellers_order_into_ones_own_landing_page(): void
    {
        $owner = User::factory()->create();
        $otherSeller = User::factory()->create();
        $page = $this->landingPage($owner);
        $visit = $this->visit($page);
        $foreignOrder = $this->order($otherSeller, 'ORD-FOREIGN-1');

        $response = $this->actingAs($owner)->postJson(
            "/api/landing/analytics/{$page->id}/link-visit-to-order",
            ['visit_id' => $visit->id, 'order_id' => $foreignOrder->id]
        );

        $response->assertStatus(422)->assertJsonValidationErrors('order_id');
        $this->assertFalse($visit->orders()->where('orders.id', $foreignOrder->id)->exists());
    }

    public function test_cannot_link_a_visit_belonging_to_a_different_landing_page(): void
    {
        $owner = User::factory()->create();
        $page = $this->landingPage($owner);
        $otherPage = $this->landingPage($owner);
        $foreignVisit = $this->visit($otherPage);
        $order = $this->order($owner, 'ORD-OWN-2');

        $response = $this->actingAs($owner)->postJson(
            "/api/landing/analytics/{$page->id}/link-visit-to-order",
            ['visit_id' => $foreignVisit->id, 'order_id' => $order->id]
        );

        $response->assertStatus(422)->assertJsonValidationErrors('visit_id');
    }

    public function test_cannot_operate_on_another_sellers_landing_page_at_all(): void
    {
        $owner = User::factory()->create();
        $otherSeller = User::factory()->create();
        $page = $this->landingPage($otherSeller);
        $visit = $this->visit($page);
        $order = $this->order($owner, 'ORD-OWN-3');

        $response = $this->actingAs($owner)->postJson(
            "/api/landing/analytics/{$page->id}/link-visit-to-order",
            ['visit_id' => $visit->id, 'order_id' => $order->id]
        );

        $response->assertStatus(403);
    }
}
