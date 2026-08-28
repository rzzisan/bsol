<?php

namespace Tests\Feature;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * pre_launch_polish_context.md §গ — CarryBee is now bulk-booking eligible
 * (previously excluded: no per-order area-search UI existed in the bulk
 * modal). CarrybeeCourierProvider::book() auto-resolving each order's own
 * address (CourierBookingApiTest/CarrybeeBookingApiTest) is what makes this
 * safe to allow through the generic AbstractCourierProvider::bookBulk()
 * loop with no bulk-specific location fields at all.
 */
class CourierBulkBookingTest extends TestCase
{
    use RefreshDatabase;

    private function authHeaders(User $user): array
    {
        $token = $user->createToken('test-suite')->plainTextToken;

        return ['Authorization' => 'Bearer ' . $token];
    }

    private function configuredSeller(): User
    {
        $user = User::factory()->create();
        CourierSetting::create([
            'user_id' => $user->id,
            'carrybee_client_id' => 'test-client-id',
            'carrybee_client_secret' => 'test-client-secret',
            'carrybee_client_context' => 'test-client-context',
            'carrybee_environment' => 'sandbox',
            'carrybee_store_id' => 'store-abc',
        ]);

        return $user;
    }

    private function order(User $user, string $orderNumber, string $address): Order
    {
        return Order::create([
            'user_id' => $user->id,
            'order_number' => $orderNumber,
            'customer_name' => 'Test Customer',
            'customer_phone' => '01711223344',
            'customer_address' => $address,
            'status' => 'confirmed',
            'total' => 1500,
        ]);
    }

    public function test_carrybee_bulk_booking_auto_resolves_each_orders_own_area(): void
    {
        $user = $this->configuredSeller();
        $order1 = $this->order($user, 'ORD-B1', 'House 1, Road 2, Mirpur');
        $order2 = $this->order($user, 'ORD-B2', 'House 9, Road 4, Dhanmondi');

        Http::fake([
            'sandbox.carrybee.com/api/v2/area-suggestion*' => Http::sequence()
                ->push(['error' => false, 'data' => ['items' => [['city_id' => 3, 'zone_id' => 7, 'area_id' => 42]]]])
                ->push(['error' => false, 'data' => ['items' => [['city_id' => 3, 'zone_id' => 9, 'area_id' => 55]]]]),
            'sandbox.carrybee.com/api/v2/orders' => Http::sequence()
                ->push(['error' => false, 'data' => ['order' => ['consignment_id' => 'CB-1']]], 201)
                ->push(['error' => false, 'data' => ['order' => ['consignment_id' => 'CB-2']]], 201),
        ]);

        $response = $this->postJson('/api/courier/book/bulk', [
            'courier' => 'carrybee',
            'order_ids' => [$order1->id, $order2->id],
        ], $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('data.success', 2)->assertJsonPath('data.failed', 0);

        $this->assertSame('CB-1', $order1->fresh()->courier_tracking_id);
        $this->assertSame('CB-2', $order2->fresh()->courier_tracking_id);
        $this->assertSame('carrybee', $order1->fresh()->courier_name);
    }

    public function test_carrybee_bulk_booking_reports_a_per_order_failure_without_failing_the_whole_batch(): void
    {
        $user = $this->configuredSeller();
        $resolvable = $this->order($user, 'ORD-B3', 'House 1, Road 2, Mirpur');
        $unresolvable = $this->order($user, 'ORD-B4', 'no useful address at all');

        Http::fake([
            'sandbox.carrybee.com/api/v2/area-suggestion*' => Http::sequence()
                ->push(['error' => false, 'data' => ['items' => [['city_id' => 3, 'zone_id' => 7, 'area_id' => 42]]]])
                ->push(['error' => true, 'message' => 'No match found.']),
            'sandbox.carrybee.com/api/v2/orders' => Http::response(
                ['error' => false, 'data' => ['order' => ['consignment_id' => 'CB-3']]],
                201
            ),
        ]);

        $response = $this->postJson('/api/courier/book/bulk', [
            'courier' => 'carrybee',
            'order_ids' => [$resolvable->id, $unresolvable->id],
        ], $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('data.success', 1)->assertJsonPath('data.failed', 1);

        $this->assertSame('CB-3', $resolvable->fresh()->courier_tracking_id);
        $this->assertNull($unresolvable->fresh()->courier_tracking_id);
    }

    public function test_pathao_and_steadfast_remain_unaffected_by_the_carrybee_validation_change(): void
    {
        $user = User::factory()->create();
        CourierSetting::create(['user_id' => $user->id, 'steadfast_api_key' => 'k', 'steadfast_secret_key' => 's']);
        $o1 = $this->order($user, 'ORD-B5', 'Address 1');
        $o2 = $this->order($user, 'ORD-B6', 'Address 2');

        Http::fake([
            'portal.packzy.com/api/v1/create_order/bulk-order' => Http::response([
                'data' => [
                    ['invoice' => 'ORD-B5', 'consignment_id' => 1],
                    ['invoice' => 'ORD-B6', 'consignment_id' => 2],
                ],
            ]),
        ]);

        $this->postJson('/api/courier/book/bulk', [
            'courier' => 'steadfast',
            'order_ids' => [$o1->id, $o2->id],
        ], $this->authHeaders($user))->assertOk()->assertJsonPath('data.success', 2);
    }
}
