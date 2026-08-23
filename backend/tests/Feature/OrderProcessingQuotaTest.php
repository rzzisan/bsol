<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\StaffPermission;
use App\Models\SubscriptionPackage;
use App\Models\User;
use App\Services\OrderCreditService;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Order quota redesign (subscription_billing_context.md §9.2-A) — placing
 * an order is unlimited; the plan's monthly max_orders is enforced once,
 * the first time an order leaves 'pending', by
 * OrderStatusService::transition() (the single choke point every
 * status-change path funnels through). See also OrderBulkImportTest's
 * "monthly_order_limit_does_not_block_bulk_creation_any_more" and
 * ConnectApiTest's connector-sync siblings.
 */
class OrderProcessingQuotaTest extends TestCase
{
    use RefreshDatabase;

    private function sellerWithLimit(?int $maxOrders): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0,
            'duration_days' => 30, 'max_orders' => $maxOrders, 'is_active' => true,
        ]);

        return User::factory()->create(['subscription_package_id' => $package->id]);
    }

    private function order(User $owner, array $overrides = []): Order
    {
        $order = Order::create(array_merge([
            'user_id' => $owner->id,
            'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Test Customer',
            'customer_phone' => '01712345678',
            'subtotal' => 500,
            'shipping_charge' => 0,
            'discount' => 0,
            'total' => 500,
            'status' => 'pending',
        ], $overrides));

        $product = Product::create([
            'user_id' => $owner->id, 'name' => 'Test Product', 'sku' => 'TP-' . uniqid(),
            'selling_price' => 500, 'stock' => 100, 'track_stock' => false, 'status' => 'active',
        ]);

        OrderItem::create([
            'order_id' => $order->id, 'product_id' => $product->id,
            'product_name' => 'Test Product', 'quantity' => 1,
            'unit_price' => 500, 'total' => 500,
        ]);

        return $order->fresh();
    }

    public function test_order_creation_via_the_api_is_never_quota_blocked(): void
    {
        $owner = $this->sellerWithLimit(0); // 0 = no processing allowed at all this month
        Sanctum::actingAs($owner);

        $payload = [
            'customer_phone' => '01711111111',
            'items' => [['product_name' => 'X', 'quantity' => 1, 'unit_price' => 100]],
        ];

        $this->postJson('/api/orders', $payload)->assertCreated();
        $this->postJson('/api/orders', $payload)->assertCreated();
        $this->assertSame(2, Order::where('user_id', $owner->id)->count());
        $this->assertSame(0, Order::where('user_id', $owner->id)->whereNotNull('quota_consumed_at')->count());
    }

    public function test_first_transition_out_of_pending_consumes_one_unit_of_quota(): void
    {
        $owner = $this->sellerWithLimit(5);
        $order = $this->order($owner);

        $this->assertNull($order->quota_consumed_at);

        app(OrderStatusService::class)->transition($order, 'confirmed');

        $this->assertNotNull($order->fresh()->quota_consumed_at);
    }

    public function test_blocks_with_402_once_the_monthly_limit_is_reached(): void
    {
        $owner = $this->sellerWithLimit(1);
        $first = $this->order($owner);
        $second = $this->order($owner);

        app(OrderStatusService::class)->transition($first, 'confirmed');

        $this->expectException(ValidationException::class);
        try {
            app(OrderStatusService::class)->transition($second, 'confirmed');
        } catch (ValidationException $e) {
            $this->assertSame(402, $e->status);
            throw $e;
        }
    }

    public function test_null_max_orders_is_unlimited_and_still_stamps_the_column(): void
    {
        $owner = $this->sellerWithLimit(null);
        $order = $this->order($owner);

        for ($i = 0; $i < 5; $i++) {
            $extra = $this->order($owner);
            app(OrderStatusService::class)->transition($extra, 'confirmed');
        }

        app(OrderStatusService::class)->transition($order, 'confirmed');
        $this->assertNotNull($order->fresh()->quota_consumed_at);
    }

    public function test_no_refund_when_an_order_is_cancelled_or_reverts_to_pending(): void
    {
        $owner = $this->sellerWithLimit(1);
        $order = $this->order($owner);

        app(OrderStatusService::class)->transition($order, 'confirmed');
        app(OrderStatusService::class)->transition($order, 'cancelled');
        $consumedAt = $order->fresh()->quota_consumed_at;
        $this->assertNotNull($consumedAt);

        // Reverting to pending and leaving again must not re-charge or
        // clear the stamp — a second order under the same limit=1 plan
        // must still be blocked.
        app(OrderStatusService::class)->transition($order, 'pending');
        app(OrderStatusService::class)->transition($order, 'processing');
        $this->assertEquals($consumedAt, $order->fresh()->quota_consumed_at);

        $second = $this->order($owner);
        $this->expectException(ValidationException::class);
        app(OrderStatusService::class)->transition($second, 'confirmed');
    }

    public function test_quota_is_shop_wide_across_staff_not_per_user(): void
    {
        $owner = $this->sellerWithLimit(1);
        $staff = User::factory()->create(['owner_id' => $owner->id, 'role' => 'user', 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'orders', 'enabled' => true]);

        $order = $this->order($owner);
        app(OrderStatusService::class)->transition($order, 'confirmed', changedBy: $staff->id);

        $second = $this->order($owner);
        $this->expectException(ValidationException::class);
        app(OrderStatusService::class)->transition($second, 'confirmed');
    }

    public function test_bulk_status_reports_quota_failures_per_row_without_failing_the_whole_batch(): void
    {
        $owner = $this->sellerWithLimit(1);
        $first = $this->order($owner);
        $second = $this->order($owner);
        Sanctum::actingAs($owner);

        $res = $this->postJson('/api/orders/bulk-status', [
            'ids' => [$first->id, $second->id],
            'status' => 'confirmed',
        ])->assertOk();

        $this->assertSame(1, $first->fresh()->status === 'confirmed' ? 1 : 0);
        $this->assertCount(1, $res->json('failed'));
        $this->assertSame('pending', $second->fresh()->status);
    }

    public function test_single_update_status_endpoint_returns_402(): void
    {
        $owner = $this->sellerWithLimit(0);
        $order = $this->order($owner);
        Sanctum::actingAs($owner);

        $this->putJson("/api/orders/{$order->id}/status", ['status' => 'confirmed'])
            ->assertStatus(402);
    }

    // ── Order-credit add-on fallback (§9.2-B / §9.6 step 3) ─────────────────

    public function test_addon_credit_covers_an_order_once_plan_quota_is_exhausted(): void
    {
        $owner = $this->sellerWithLimit(1);
        app(OrderCreditService::class)->grant($owner->id, 5, 30, 'test grant');

        $first = $this->order($owner);
        $second = $this->order($owner);

        app(OrderStatusService::class)->transition($first, 'confirmed');
        $this->assertSame('plan', $first->fresh()->quota_source);

        // Plan quota is now exhausted, but the wallet has credit — this
        // must succeed instead of throwing, drawing from the add-on.
        app(OrderStatusService::class)->transition($second, 'confirmed');
        $this->assertSame('confirmed', $second->fresh()->status);
        $this->assertSame('addon_credit', $second->fresh()->quota_source);
        $this->assertSame(4, app(OrderCreditService::class)->getAvailableBalance($owner->id));
    }

    public function test_addon_credit_covered_orders_never_inflate_the_plan_quota_count(): void
    {
        // Regression guard for the exact bug this design avoids: if an
        // addon-covered order were counted as 'plan', it would eat into
        // the plan's own quota forever, making credits worthless.
        $owner = $this->sellerWithLimit(1);
        app(OrderCreditService::class)->grant($owner->id, 10, 30, 'test grant');

        for ($i = 0; $i < 3; $i++) {
            app(OrderStatusService::class)->transition($this->order($owner), 'confirmed');
        }

        $this->assertSame(
            1,
            Order::where('user_id', $owner->id)->where('quota_source', 'plan')->count(),
        );
        $this->assertSame(
            2,
            Order::where('user_id', $owner->id)->where('quota_source', 'addon_credit')->count(),
        );
    }

    public function test_still_blocks_with_402_once_both_plan_and_credit_are_exhausted(): void
    {
        $owner = $this->sellerWithLimit(1);
        app(OrderCreditService::class)->grant($owner->id, 1, 30, 'test grant');

        app(OrderStatusService::class)->transition($this->order($owner), 'confirmed'); // plan
        app(OrderStatusService::class)->transition($this->order($owner), 'confirmed'); // 1 credit

        $third = $this->order($owner);
        $this->expectException(ValidationException::class);
        app(OrderStatusService::class)->transition($third, 'confirmed');
    }

    public function test_an_expired_wallet_is_not_used_even_with_a_positive_balance(): void
    {
        $owner = $this->sellerWithLimit(1);
        app(OrderCreditService::class)->grant($owner->id, 5, 30, 'test grant');
        \App\Models\OrderCreditWallet::where('user_id', $owner->id)->update(['expires_at' => now()->subDay()]);

        app(OrderStatusService::class)->transition($this->order($owner), 'confirmed'); // plan

        $second = $this->order($owner);
        $this->expectException(ValidationException::class);
        app(OrderStatusService::class)->transition($second, 'confirmed');
    }

    public function test_a_failed_transition_never_spends_a_credit_or_a_quota_slot(): void
    {
        // Stock-insufficient failure inside the same DB::transaction must
        // roll back the quota/credit charge along with the status change
        // — otherwise a doomed-to-fail attempt silently burns a paid credit.
        $owner = $this->sellerWithLimit(5);
        $order = $this->order($owner);
        $order->items()->first()->product->update(['track_stock' => true, 'stock' => 0]);

        try {
            app(OrderStatusService::class)->transition($order, 'confirmed');
            $this->fail('Expected a ValidationException for insufficient stock.');
        } catch (ValidationException $e) {
            // expected
        }

        $this->assertNull($order->fresh()->quota_consumed_at);
    }
}
