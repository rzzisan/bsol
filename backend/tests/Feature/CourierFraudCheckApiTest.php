<?php

namespace Tests\Feature;

use App\Models\CourierFraudStat;
use App\Models\CourierSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CourierFraudCheckApiTest extends TestCase
{
    use RefreshDatabase;

    private function authHeaders(User $user): array
    {
        $token = $user->createToken('test-suite')->plainTextToken;

        return ['Authorization' => 'Bearer ' . $token];
    }

    private function fakeAllCouriers(): void
    {
        Http::fake([
            'merchant.pathao.com/api/v1/login' => Http::response(['access_token' => 'pathao-tok']),
            // Pathao's dashboard now returns a rating label, not raw delivery counts.
            'merchant.pathao.com/api/v1/user/success' => Http::response([
                'data' => ['version' => 'v2', 'customer_rating' => 'excellent_customer'],
            ]),
            'portal.packzy.com/api/v1/fraud_check/*' => Http::response([
                'total_parcels' => 20, 'total_delivered' => 18, 'total_cancelled' => 2,
            ]),
            'api.redx.com.bd/v4/auth/login' => Http::response(['data' => ['accessToken' => 'redx-tok']]),
            'redx.com.bd/api/redx_se/admin/parcel/customer-success-return-rate*' => Http::response([
                'data' => ['totalParcels' => 5, 'deliveredParcels' => 4],
            ]),
            'merchant.carrybee.com/api/auth/csrf' => Http::response(['csrfToken' => 'csrf-tok']),
            'merchant.carrybee.com/api/auth/callback/login*' => Http::response([]),
            'merchant.carrybee.com/api/auth/session' => Http::response([
                'accessToken' => 'carrybee-tok', 'user' => ['selectedBusinessId' => 'biz-1'],
            ]),
            'api-merchant.carrybee.com/api/v2/businesses/*/fraud-check/*' => Http::response([
                'data' => ['total_order' => 3, 'cancelled_order' => 1, 'success_rate' => 66.67],
            ]),
            'go-app.paperfly.com.bd/merchant/api/react/authentication/login_using_password.php' => Http::response(['token' => 'paperfly-tok']),
            'go-app.paperfly.com.bd/merchant/api/react/smart-check/list.php' => Http::response([
                'totalRecords' => 2,
                'records' => [['status' => 'Delivered'], ['status' => 'Returned']],
            ]),
        ]);
    }

    private function fullyConfiguredSettings(User $user): CourierSetting
    {
        return CourierSetting::create([
            'user_id' => $user->id,
            'steadfast_api_key' => 'sf-key',
            'steadfast_secret_key' => 'sf-secret',
            'pathao_username' => 'merchant@example.com',
            'pathao_password' => 'secret',
            'redx_phone' => '01700000000',
            'redx_password' => 'secret',
            'carrybee_phone' => '01700000000',
            'carrybee_password' => 'secret',
            'paperfly_username' => 'merchant',
            'paperfly_password' => 'secret',
        ]);
    }

    public function test_aggregates_all_five_couriers_and_caches_result(): void
    {
        $user = User::factory()->create();
        $this->fullyConfiguredSettings($user);
        $this->fakeAllCouriers();

        $response = $this->getJson('/api/fraud/courier-check?phone=01711223344', $this->authHeaders($user));

        // Pathao is rating-based and excluded from the aggregate:
        // steadfast(20/18) + redx(5/4) + carrybee(3/2) + paperfly(2/1)
        $response->assertOk()
            ->assertJsonPath('data.overall.total', 20 + 5 + 3 + 2)
            ->assertJsonPath('data.overall.success', 18 + 4 + 2 + 1)
            ->assertJsonCount(5, 'data.couriers');

        $names = collect($response->json('data.couriers'))->pluck('name')->sort()->values()->all();
        $this->assertSame(['carrybee', 'paperfly', 'pathao', 'redx', 'steadfast'], $names);

        $pathaoCard = collect($response->json('data.couriers'))->firstWhere('name', 'pathao');
        $this->assertSame('ok', $pathaoCard['status']);
        $this->assertSame('rating', $pathaoCard['data_type']);
        $this->assertSame('excellent_customer', $pathaoCard['rating']);

        $this->assertSame(5, CourierFraudStat::where('phone_number', '01711223344')->count());

        // Pathao: 2 requests, Steadfast: 1, RedX: 2, Carrybee: 4, Paperfly: 2 = 11
        Http::assertSentCount(11);

        // Second call within TTL must be served entirely from cache — no new HTTP calls.
        $this->getJson('/api/fraud/courier-check?phone=01711223344', $this->authHeaders($user))
            ->assertOk()
            ->assertJsonCount(5, 'data.couriers');

        Http::assertSentCount(11);
    }

    public function test_courier_without_credentials_is_marked_not_configured(): void
    {
        $user = User::factory()->create();
        // No CourierSetting row at all.
        Http::fake();

        $response = $this->getJson('/api/fraud/courier-check?phone=01711223344', $this->authHeaders($user));

        $response->assertOk();
        foreach ($response->json('data.couriers') as $card) {
            $this->assertSame('not_configured', $card['status']);
        }
        Http::assertNothingSent();
    }

    public function test_failed_courier_is_cached_as_error_and_not_retried_within_cooldown(): void
    {
        $user = User::factory()->create();
        $this->fullyConfiguredSettings($user);

        Http::fake([
            'portal.packzy.com/api/v1/fraud_check/*' => Http::response(['message' => 'Unauthorized'], 401),
            '*' => Http::response(['error' => true], 500),
        ]);

        $first = $this->getJson('/api/fraud/courier-check?phone=01711223344', $this->authHeaders($user));
        $steadfastCard = collect($first->json('data.couriers'))->firstWhere('name', 'steadfast');
        $this->assertSame('error', $steadfastCard['status']);

        $sentAfterFirst = count(Http::recorded());

        $this->getJson('/api/fraud/courier-check?phone=01711223344', $this->authHeaders($user));

        // Still within the error cooldown window — no additional requests fired.
        $this->assertCount($sentAfterFirst, Http::recorded());
    }
}
