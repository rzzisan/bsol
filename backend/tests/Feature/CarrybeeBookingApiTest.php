<?php

namespace Tests\Feature;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CarrybeeBookingApiTest extends TestCase
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
            'carrybee_client_id' => 'test-client-id',
            'carrybee_client_secret' => 'test-client-secret',
            'carrybee_client_context' => 'test-client-context',
            'carrybee_environment' => 'sandbox',
            'carrybee_store_id' => 'store-abc',
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

    public function test_cities_endpoint_proxies_the_official_api(): void
    {
        $user = $this->configuredUser();

        Http::fake([
            'sandbox.carrybee.com/api/v2/cities' => Http::response([
                'error' => false, 'message' => 'City list fetched successfully',
                'data' => ['cities' => [['id' => 1, 'name' => 'Dhaka']]],
            ]),
        ]);

        $response = $this->getJson('/api/courier/carrybee/cities', $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('data.0.name', 'Dhaka');

        Http::assertSent(fn ($request) => $request->hasHeader('Client-ID', 'test-client-id')
            && $request->hasHeader('Client-Secret', 'test-client-secret')
            && $request->hasHeader('Client-Context', 'test-client-context'));
    }

    public function test_create_store_proxies_the_official_api(): void
    {
        $user = $this->configuredUser();

        Http::fake([
            'sandbox.carrybee.com/api/v2/stores' => Http::response([
                'error' => false, 'message' => 'Store created successfully', 'data' => null,
            ], 201),
        ]);

        $response = $this->postJson('/api/courier/carrybee/stores', [
            'name' => 'My Store', 'contact_person_name' => 'Zisan', 'contact_person_number' => '01898000999',
            'address' => 'Test Address, Dhaka', 'city_id' => 1, 'zone_id' => 1, 'area_id' => 1,
        ], $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('success', true);
    }

    public function test_single_booking_creates_order_and_persists_tracking_id(): void
    {
        $user = $this->configuredUser();
        $order = $this->makeOrder($user);

        Http::fake([
            'sandbox.carrybee.com/api/v2/orders' => Http::response([
                'error' => false, 'message' => 'Order created successfully',
                'data' => ['order' => [
                    'consignment_id' => 'CB123456', 'store_id' => 'store-abc',
                    'merchant_order_id' => 'ORD-1001', 'collectable_amount' => '1500', 'cod_fee' => 15, 'delivery_fee' => '60',
                ]],
            ], 201),
        ]);

        $response = $this->postJson("/api/courier/book/{$order->id}", [
            'courier' => 'carrybee',
            'cod_amount' => 1500,
            'delivery_city_id' => 1,
            'delivery_zone_id' => 1,
            'delivery_area_id' => 100,
            'parcel_weight_kg' => 0.5,
        ], $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('consignment_id', 'CB123456');

        $order->refresh();
        $this->assertSame('carrybee', $order->courier_name);
        $this->assertSame('CB123456', $order->courier_tracking_id);
        $this->assertSame('booked', $order->courier_status);
        $this->assertSame('processing', $order->status);

        // item_weight sent to CarryBee must be in grams (0.5kg -> 500g), store_id from settings default.
        Http::assertSent(function ($request) {
            return $request['item_weight'] === 500
                && $request['store_id'] === 'store-abc'
                && $request['city_id'] === 1
                && $request['zone_id'] === 1
                && $request['area_id'] === 100
                && $request['collectable_amount'] == 1500;
        });
    }

    public function test_booking_fails_without_delivery_city_or_zone(): void
    {
        $user = $this->configuredUser();
        $order = $this->makeOrder($user);

        Http::fake();

        $response = $this->postJson("/api/courier/book/{$order->id}", [
            'courier' => 'carrybee',
            'cod_amount' => 1500,
        ], $this->authHeaders($user));

        $response->assertStatus(422);
        Http::assertNothingSent();
    }

    public function test_track_order_updates_courier_status_from_order_details(): void
    {
        $user = $this->configuredUser();
        $order = $this->makeOrder($user);
        $order->update([
            'courier_name' => 'carrybee',
            'courier_tracking_id' => 'CB123456',
        ]);

        Http::fake([
            'sandbox.carrybee.com/api/v2/orders/*/details' => Http::response([
                'error' => false, 'message' => 'Order details',
                'data' => ['transfer_status' => 'in-transit', 'consignment_id' => 'CB123456'],
            ]),
        ]);

        $response = $this->getJson("/api/courier/track/{$order->id}", $this->authHeaders($user));

        $response->assertOk();
        $this->assertSame('in-transit', $order->fresh()->courier_status);
    }
}
