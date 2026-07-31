<?php

namespace Tests\Feature;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RedxBookingApiTest extends TestCase
{
    use RefreshDatabase;

    private function authHeaders(User $user): array
    {
        $token = $user->createToken('test-suite')->plainTextToken;

        return ['Authorization' => 'Bearer ' . $token];
    }

    private function configuredUser(): User
    {
        $user = User::factory()->create();
        CourierSetting::create([
            'user_id' => $user->id,
            'redx_api_key' => 'test-redx-token',
            'redx_environment' => 'sandbox',
            'redx_pickup_store_id' => 1,
        ]);

        return $user;
    }

    private function makeOrder(User $user, string $orderNumber = 'ORD-1001'): Order
    {
        return Order::create([
            'user_id' => $user->id,
            'order_number' => $orderNumber,
            'customer_name' => 'Test Customer',
            'customer_phone' => '01711223344',
            'customer_address' => 'House 1, Road 2, Mirpur',
            'status' => 'confirmed',
            'total' => 1500,
        ]);
    }

    public function test_redx_areas_endpoint_proxies_the_official_api(): void
    {
        $user = $this->configuredUser();

        Http::fake([
            'sandbox.redx.com.bd/v1.0.0-beta/areas*' => Http::response([
                'areas' => [
                    ['id' => 1, 'name' => 'Mirpur DOHS', 'post_code' => 1216, 'district_name' => 'Dhaka', 'division_name' => 'Dhaka', 'zone_id' => 1],
                ],
            ]),
        ]);

        $response = $this->getJson('/api/courier/redx/areas?district_name=Dhaka', $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('data.0.name', 'Mirpur DOHS');

        Http::assertSent(fn ($request) => $request->hasHeader('API-ACCESS-TOKEN', 'Bearer test-redx-token'));
    }

    public function test_create_pickup_store_proxies_the_official_api(): void
    {
        $user = $this->configuredUser();

        Http::fake([
            'sandbox.redx.com.bd/v1.0.0-beta/pickup/store' => Http::response([
                'id' => 5, 'name' => 'My Store', 'address' => 'Test Address', 'area_name' => 'Mirpur DOHS', 'area_id' => 1, 'phone' => '8801898000999',
            ]),
        ]);

        $response = $this->postJson('/api/courier/redx/pickup-stores', [
            'name' => 'My Store', 'phone' => '01898000999', 'address' => 'Test Address, Dhaka', 'area_id' => 1,
        ], $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('data.id', 5);
    }

    public function test_single_booking_creates_parcel_and_persists_tracking_id(): void
    {
        $user = $this->configuredUser();
        $order = $this->makeOrder($user);

        Http::fake([
            'sandbox.redx.com.bd/v1.0.0-beta/parcel' => Http::response(['tracking_id' => '21A427TU4BN3R']),
        ]);

        $response = $this->postJson("/api/courier/book/{$order->id}", [
            'courier' => 'redx',
            'cod_amount' => 1500,
            'delivery_area_id' => 12,
            'delivery_area' => 'Mirpur DOHS',
            'parcel_weight_kg' => 0.5,
        ], $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('consignment_id', '21A427TU4BN3R');

        $order->refresh();
        $this->assertSame('redx', $order->courier_name);
        $this->assertSame('21A427TU4BN3R', $order->courier_tracking_id);
        $this->assertSame('booked', $order->courier_status);
        $this->assertSame('processing', $order->status);

        // parcel_weight sent to RedX must be in grams (0.5kg -> 500g), pickup_store_id from settings default.
        Http::assertSent(function ($request) {
            return $request['parcel_weight'] === 500
                && $request['pickup_store_id'] === 1
                && $request['delivery_area_id'] === 12
                && $request['cash_collection_amount'] == 1500;
        });
    }

    public function test_booking_fails_without_delivery_area(): void
    {
        $user = $this->configuredUser();
        $order = $this->makeOrder($user);

        Http::fake();

        $response = $this->postJson("/api/courier/book/{$order->id}", [
            'courier' => 'redx',
            'cod_amount' => 1500,
        ], $this->authHeaders($user));

        $response->assertStatus(422);
        Http::assertNothingSent();
    }

    public function test_bulk_booking_loops_per_order(): void
    {
        $user = $this->configuredUser();
        $order1 = $this->makeOrder($user, 'ORD-2001');
        $order2 = $this->makeOrder($user, 'ORD-2002');

        Http::fake([
            'sandbox.redx.com.bd/v1.0.0-beta/parcel' => Http::sequence()
                ->push(['tracking_id' => 'TRK-1'])
                ->push(['tracking_id' => 'TRK-2']),
        ]);

        // Bulk booking doesn't collect delivery_area per order in this flow — set it on the order directly.
        $order1->update(['redx_area_id' => 12]);
        $order2->update(['redx_area_id' => 12]);

        $response = $this->postJson('/api/courier/book/bulk', [
            'courier' => 'redx',
            'order_ids' => [$order1->id, $order2->id],
            'delivery_area' => 'Mirpur DOHS',
        ], $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('data.success', 2);
        $this->assertSame('TRK-1', $order1->fresh()->courier_tracking_id);
        $this->assertSame('TRK-2', $order2->fresh()->courier_tracking_id);
    }

    public function test_track_order_updates_courier_status_from_parcel_info(): void
    {
        $user = $this->configuredUser();
        $order = $this->makeOrder($user);
        $order->update([
            'courier_name' => 'redx',
            'courier_tracking_id' => '21A427TU4BN3R',
        ]);

        Http::fake([
            'sandbox.redx.com.bd/v1.0.0-beta/parcel/info/*' => Http::response([
                'parcel' => ['tracking_id' => '21A427TU4BN3R', 'status' => 'pickup-pending'],
            ]),
        ]);

        $response = $this->getJson("/api/courier/track/{$order->id}", $this->authHeaders($user));

        $response->assertOk();
        $this->assertSame('pickup-pending', $order->fresh()->courier_status);
    }
}
