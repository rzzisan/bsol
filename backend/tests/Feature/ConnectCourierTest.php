<?php

namespace Tests\Feature;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Models\PlatformApiKey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ConnectCourierTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: User, 1: string} */
    private function connectedMerchant(array $userAttrs = []): array
    {
        $user = User::factory()->create($userAttrs);
        $rawKey = PlatformApiKey::generateRawKey();

        PlatformApiKey::create([
            'user_id'    => $user->id,
            'platform'   => 'woocommerce',
            'domain'     => 'myshop.com',
            'key_hash'   => PlatformApiKey::hashKey($rawKey),
            'key_prefix' => substr($rawKey, 0, 12),
            'status'     => 'connected',
        ]);

        return [$user, $rawKey];
    }

    private function connectHeaders(string $rawKey, string $domain = 'myshop.com'): array
    {
        return ['X-API-KEY' => $rawKey, 'X-Client-Domain' => $domain];
    }

    private function syncedOrder(User $user, string $rawKey, string $wcOrderId = 'wc-order-1'): Order
    {
        $this->postJson('/api/connect/v1/orders/sync', [
            'wc_order_id'    => $wcOrderId,
            'customer_name'  => 'Karim Uddin',
            'customer_phone' => '01755443322',
            'customer_address' => 'Dhanmondi, Dhaka',
            'line_items'     => [
                ['name' => 'T-Shirt', 'quantity' => 1, 'total' => 500],
            ],
        ], $this->connectHeaders($rawKey))->assertCreated();

        return Order::where('user_id', $user->id)->where('source_ref', $wcOrderId)->firstOrFail();
    }

    public function test_book_steadfast_succeeds_and_writes_order_columns(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $order = $this->syncedOrder($user, $rawKey);

        CourierSetting::create([
            'user_id' => $user->id,
            'steadfast_api_key' => 'sf-key',
            'steadfast_secret_key' => 'sf-secret',
        ]);

        Http::fake([
            'portal.packzy.com/api/v1/create_order' => Http::response(['consignment_id' => 555444]),
        ]);

        $response = $this->postJson('/api/connect/v1/courier/book', [
            'wc_order_id' => 'wc-order-1',
            'courier' => 'steadfast',
        ], $this->connectHeaders($rawKey));

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('consignment_id', '555444');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'courier_name' => 'steadfast',
            'courier_tracking_id' => '555444',
            'status' => 'processing',
        ]);
    }

    public function test_book_rejects_unsupported_courier_without_a_remote_call(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->syncedOrder($user, $rawKey);

        Http::fake();

        $response = $this->postJson('/api/connect/v1/courier/book', [
            'wc_order_id' => 'wc-order-1',
            'courier' => 'pathao',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(422)->assertJsonValidationErrors('courier');
        Http::assertNothingSent();
    }

    public function test_book_returns_order_not_found_for_unknown_wc_order_id(): void
    {
        [, $rawKey] = $this->connectedMerchant();

        $this->postJson('/api/connect/v1/courier/book', [
            'wc_order_id' => 'does-not-exist',
            'courier' => 'steadfast',
        ], $this->connectHeaders($rawKey))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'order_not_found');
    }

    public function test_manual_tracking_entry_succeeds_without_any_provider_credentials(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->syncedOrder($user, $rawKey);

        $response = $this->postJson('/api/connect/v1/courier/book', [
            'wc_order_id' => 'wc-order-1',
            'courier' => 'manual',
            'tracking_id' => 'HAND-DELIVERY-1',
        ], $this->connectHeaders($rawKey));

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseHas('orders', [
            'courier_name' => 'manual',
            'courier_tracking_id' => 'HAND-DELIVERY-1',
        ]);
    }

    public function test_track_before_booking_returns_a_clean_error(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->syncedOrder($user, $rawKey);

        $response = $this->postJson('/api/connect/v1/courier/track', [
            'wc_order_id' => 'wc-order-1',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(422)->assertJsonPath('message', 'No tracking ID.');
    }

    public function test_cancel_surfaces_steadfasts_lack_of_cancel_support(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $this->syncedOrder($user, $rawKey);

        CourierSetting::create([
            'user_id' => $user->id,
            'steadfast_api_key' => 'sf-key',
            'steadfast_secret_key' => 'sf-secret',
        ]);
        Http::fake(['portal.packzy.com/api/v1/create_order' => Http::response(['consignment_id' => 111])]);

        $this->postJson('/api/connect/v1/courier/book', [
            'wc_order_id' => 'wc-order-1',
            'courier' => 'steadfast',
        ], $this->connectHeaders($rawKey))->assertOk();

        $response = $this->postJson('/api/connect/v1/courier/cancel', [
            'wc_order_id' => 'wc-order-1',
        ], $this->connectHeaders($rawKey));

        $response->assertStatus(422)
            ->assertJsonPath('message', 'App\\Services\\Courier\\SteadfastCourierProvider does not support order cancellation via API.');
    }

    public function test_balance_delegates_to_steadfast_balance_check(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();

        CourierSetting::create([
            'user_id' => $user->id,
            'steadfast_api_key' => 'sf-key',
            'steadfast_secret_key' => 'sf-secret',
        ]);
        Http::fake(['portal.packzy.com/api/v1/get_balance' => Http::response(['status' => 200, 'current_balance' => 1234.5])]);

        $response = $this->getJson('/api/connect/v1/courier/balance', $this->connectHeaders($rawKey));

        $response->assertOk()->assertJsonPath('data.current_balance', 1234.5);
    }
}
