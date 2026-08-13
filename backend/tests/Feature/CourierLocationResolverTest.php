<?php

namespace Tests\Feature;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Models\User;
use App\Services\CourierLocationResolverService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Direct service-level tests for the resolver itself (Pathao/RedX are also
 * exercised end-to-end through ConnectCourierController in
 * ConnectCourierTest — these focus on Carrybee, which isn't otherwise
 * covered, and the resolver's own not-configured short-circuit).
 */
class CourierLocationResolverTest extends TestCase
{
    use RefreshDatabase;

    private function order(array $overrides = []): Order
    {
        $user = User::factory()->create();

        return Order::create(array_merge([
            'user_id' => $user->id,
            'order_number' => 'ORD-1',
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01755443322',
            'customer_address' => 'House 5, Road 2, Dhanmondi, Dhaka',
            'source' => 'woocommerce',
            'source_ref' => 'wc-order-1',
            'total' => 500,
            'status' => 'pending',
        ], $overrides));
    }

    public function test_carrybee_resolves_using_top_result_with_defensive_key_fallback(): void
    {
        $order = $this->order();

        CourierSetting::create([
            'user_id' => $order->user_id,
            'carrybee_client_id' => 'client-id',
            'carrybee_client_secret' => 'client-secret',
            'carrybee_client_context' => 'client-context',
            'carrybee_environment' => 'sandbox',
        ]);

        Http::fake([
            'sandbox.carrybee.com/api/v2/area-suggestion*' => Http::response([
                'error' => false,
                'data' => ['items' => [
                    // camelCase — deliberately not the same casing the
                    // resolver defaults to first, to exercise the fallback.
                    ['cityId' => 5, 'zoneId' => 12, 'areaName' => 'Dhanmondi'],
                ]],
            ]),
        ]);

        $resolver = app(CourierLocationResolverService::class);
        $result = $resolver->resolveForCourier('carrybee', $order);

        $this->assertTrue($result['resolved']);
        $this->assertSame(5, $result['fields']['delivery_city_id']);
        $this->assertSame(12, $result['fields']['delivery_zone_id']);
        $this->assertSame('Dhanmondi', $result['fields']['delivery_area_name']);
    }

    public function test_carrybee_fails_cleanly_when_search_returns_nothing(): void
    {
        $order = $this->order();

        CourierSetting::create([
            'user_id' => $order->user_id,
            'carrybee_client_id' => 'client-id',
            'carrybee_client_secret' => 'client-secret',
            'carrybee_client_context' => 'client-context',
            'carrybee_environment' => 'sandbox',
        ]);

        Http::fake([
            'sandbox.carrybee.com/api/v2/area-suggestion*' => Http::response(['error' => false, 'data' => ['items' => []]]),
        ]);

        $resolver = app(CourierLocationResolverService::class);
        $result = $resolver->resolveForCourier('carrybee', $order);

        $this->assertFalse($result['resolved']);
        $this->assertNotEmpty($result['message']);
    }

    public function test_courier_not_configured_short_circuits_without_a_remote_call(): void
    {
        $order = $this->order();

        Http::fake();

        $resolver = app(CourierLocationResolverService::class);
        $result = $resolver->resolveForCourier('carrybee', $order);

        $this->assertFalse($result['resolved']);
        $this->assertStringContainsString('not configured', $result['message']);
        Http::assertNothingSent();
    }
}
