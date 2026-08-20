<?php

namespace Tests\Feature;

use App\Models\DigitalDelivery;
use App\Models\DigitalProductSetting;
use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\NotificationUseCaseBinding;
use App\Models\Order;
use App\Models\OrderOnlinePayment;
use App\Models\PaymentGatewaySetting;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\SubscriptionPackage;
use App\Models\User;
use App\Services\NotificationDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

/**
 * Digital product delivery — see digital_product_context.md.
 */
class DigitalProductTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Storage::fake('local');
    }

    private function apex(): string
    {
        return config('app.subdomain_apex');
    }

    /** @return array{0: User, 1: LandingPage, 2: Product} */
    private function shopWithDigitalProduct(array $productOverrides = [], string $subdomain = 'shopa'): array
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0, 'duration_days' => 30,
        ]);
        $owner = User::factory()->create(['subscription_package_id' => $package->id]);

        ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => $subdomain, 'subdomain_status' => 'active',
        ]);

        $page = LandingPage::create([
            'user_id' => $owner->id, 'title' => 'Offer', 'slug' => 'offer',
            'status' => 'published', 'published_at' => now(), 'content' => [],
        ]);

        $product = Product::create(array_merge([
            'user_id' => $owner->id, 'name' => 'E-Book', 'sku' => 'EB-' . uniqid(),
            'selling_price' => 500, 'stock' => 0, 'track_stock' => false, 'status' => 'active',
            'product_type' => Product::TYPE_DIGITAL,
            'digital_delivery_type' => Product::DIGITAL_DELIVERY_HOSTED_FILE,
            'digital_file_path' => 'digital-products/1/1/book.pdf',
            'digital_file_name' => 'book.pdf',
            'digital_delivery_channels' => ['email', 'sms'],
        ], $productOverrides));

        LandingPageProduct::create([
            'landing_page_id' => $page->id, 'product_id' => $product->id, 'sort_order' => 0,
        ]);

        return [$owner, $page, $product];
    }

    private function enableBkash(User $owner): void
    {
        PaymentGatewaySetting::create([
            'user_id' => $owner->id,
            'bkash_personal_enabled' => true,
            'bkash_personal_number' => '01799990000',
        ]);
    }

    private function mockDispatchAsSent(): void
    {
        $mock = Mockery::mock(NotificationDispatchService::class);
        $mock->shouldReceive('dispatch')->andReturnUsing(function ($user, $useCaseKey, $phone, $email) {
            $results = [];
            if ($phone) $results[] = ['channel' => 'sms', 'status' => 'sent'];
            if ($email) $results[] = ['channel' => 'email', 'status' => 'sent'];
            return ['status' => 'success', 'results' => $results];
        });
        $this->app->instance(NotificationDispatchService::class, $mock);
    }

    // ── Admin policy ─────────────────────────────────────────────────────

    public function test_admin_can_read_default_policy_then_update_it(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/settings/digital-products')
            ->assertOk()
            ->assertJsonPath('data.max_file_size_mb', 200);

        $this->putJson('/api/admin/settings/digital-products', [
            'max_file_size_mb' => 50,
            'allowed_extensions' => ['pdf', 'zip'],
            'download_link_expiry_hours' => 24,
            'max_downloads_per_purchase' => 2,
        ])->assertOk();

        $this->assertDatabaseHas('digital_product_settings', ['max_file_size_mb' => 50]);
        $this->getJson('/api/admin/settings/digital-products')
            ->assertJsonPath('data.max_file_size_mb', 50)
            ->assertJsonPath('data.max_downloads_per_purchase', 2);
    }

    public function test_non_admin_cannot_write_policy(): void
    {
        $seller = User::factory()->create();
        Sanctum::actingAs($seller);

        $this->putJson('/api/admin/settings/digital-products', [
            'max_file_size_mb' => 50,
            'allowed_extensions' => ['pdf'],
            'download_link_expiry_hours' => 24,
            'max_downloads_per_purchase' => 2,
        ])->assertStatus(403);
    }

    // ── Seller file upload ───────────────────────────────────────────────

    public function test_seller_can_upload_hosted_file_within_policy(): void
    {
        [$owner, , $product] = $this->shopWithDigitalProduct(['digital_file_path' => null]);
        Sanctum::actingAs($owner);

        $file = UploadedFile::fake()->create('book.pdf', 500, 'application/pdf');

        $response = $this->postJson("/api/products/{$product->id}/digital-file", ['file' => $file]);

        $response->assertCreated();
        $product->refresh();
        $this->assertNotNull($product->digital_file_path);
        Storage::disk('local')->assertExists($product->digital_file_path);
    }

    public function test_upload_rejected_for_disallowed_extension(): void
    {
        [$owner, , $product] = $this->shopWithDigitalProduct(['digital_file_path' => null]);
        Sanctum::actingAs($owner);

        $file = UploadedFile::fake()->create('virus.exe', 10, 'application/octet-stream');

        $this->postJson("/api/products/{$product->id}/digital-file", ['file' => $file])
            ->assertStatus(422);
    }

    public function test_upload_rejected_over_configured_size_limit(): void
    {
        DigitalProductSetting::create([
            'user_id' => User::factory()->create(['role' => 'admin'])->id,
            'max_file_size_mb' => 1,
            'allowed_extensions' => ['pdf'],
            'download_link_expiry_hours' => 168,
            'max_downloads_per_purchase' => 5,
            'is_active' => true,
        ]);
        [$owner, , $product] = $this->shopWithDigitalProduct(['digital_file_path' => null]);
        Sanctum::actingAs($owner);

        $file = UploadedFile::fake()->create('book.pdf', 2000, 'application/pdf'); // 2MB > 1MB limit

        $this->postJson("/api/products/{$product->id}/digital-file", ['file' => $file])
            ->assertStatus(422);
    }

    public function test_seller_cannot_upload_a_digital_file_for_another_shops_product(): void
    {
        [, , $product] = $this->shopWithDigitalProduct(['digital_file_path' => null], 'shopa');
        $intruder = User::factory()->create();
        Sanctum::actingAs($intruder);

        $file = UploadedFile::fake()->create('book.pdf', 500, 'application/pdf');

        $this->postJson("/api/products/{$product->id}/digital-file", ['file' => $file])
            ->assertStatus(404);
    }

    // ── Checkout-time gates ──────────────────────────────────────────────

    public function test_mixed_cart_is_rejected(): void
    {
        [$owner, $page, $digital] = $this->shopWithDigitalProduct();
        $physical = Product::create([
            'user_id' => $owner->id, 'name' => 'T-Shirt', 'sku' => 'TS-' . uniqid(),
            'selling_price' => 300, 'stock' => 10, 'track_stock' => true, 'status' => 'active',
        ]);
        LandingPageProduct::create(['landing_page_id' => $page->id, 'product_id' => $physical->id, 'sort_order' => 1]);

        $response = $this->postJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/order", [
            'customer_name' => 'Karim', 'customer_phone' => '01712345678',
            'customer_address' => 'Dhaka', 'customer_email' => 'karim@example.com',
            'items' => [
                ['enabled' => true, 'product_id' => $digital->id, 'quantity' => 1],
                ['enabled' => true, 'product_id' => $physical->id, 'quantity' => 1],
            ],
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_cod_is_rejected_for_a_digital_only_cart(): void
    {
        [, , $product] = $this->shopWithDigitalProduct();

        $response = $this->postJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/order", [
            'customer_name' => 'Karim', 'customer_phone' => '01712345678',
            'customer_address' => 'Dhaka',
            'customer_email' => 'karim@example.com',
            'payment_method' => 'cod',
            'items' => [['enabled' => true, 'product_id' => $product->id, 'quantity' => 1]],
        ]);

        $response->assertStatus(422);
        $this->assertArrayHasKey('payment_method', $response->json('errors'));
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_email_required_when_product_declares_email_channel(): void
    {
        [, , $product] = $this->shopWithDigitalProduct();

        $response = $this->postJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/order", [
            'customer_name' => 'Karim', 'customer_phone' => '01712345678',
            'customer_address' => 'Dhaka',
            'payment_method' => 'bkash',
            'items' => [['enabled' => true, 'product_id' => $product->id, 'quantity' => 1]],
        ]);

        $response->assertStatus(422);
        $this->assertArrayHasKey('customer_email', $response->json('errors'));
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_digital_order_without_email_channel_does_not_require_email(): void
    {
        [, , $product] = $this->shopWithDigitalProduct(['digital_delivery_channels' => ['sms']]);

        $response = $this->postJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/order", [
            'customer_name' => 'Karim', 'customer_phone' => '01712345678',
            'customer_address' => 'Dhaka',
            'payment_method' => 'bkash',
            'items' => [['enabled' => true, 'product_id' => $product->id, 'quantity' => 1]],
        ]);

        $response->assertCreated();
    }

    // ── End-to-end: wallet approval → delivery created ──────────────────

    public function test_wallet_approval_creates_digital_delivery_and_dispatches_notifications(): void
    {
        $this->mockDispatchAsSent();
        if (! User::where('role', 'admin')->exists()) {
            User::factory()->create(['role' => 'admin']);
        }
        [$owner, , $product] = $this->shopWithDigitalProduct();
        $this->enableBkash($owner);

        $orderResp = $this->postJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer/order", [
            'customer_name' => 'Karim', 'customer_phone' => '01712345678',
            'customer_address' => 'Dhaka',
            'customer_email' => 'karim@example.com',
            'payment_method' => 'bkash',
            'items' => [['enabled' => true, 'product_id' => $product->id, 'quantity' => 1]],
        ]);
        $orderResp->assertCreated();
        $order = Order::findOrFail($orderResp->json('data.order_id'));

        $claimResp = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/orders/{$order->id}/online-payment/wallet-claim",
            [
                'token' => $order->public_token,
                'provider' => 'bkash',
                'sender_number' => '01712345678',
                'customer_trx_id' => 'TRX' . uniqid(),
            ]
        );
        $claimResp->assertCreated();
        // Customer must be told to wait, not shown a download link yet.
        $this->assertStringContainsString('যাচাই', $claimResp->json('message'));

        $this->assertDatabaseCount('digital_deliveries', 0);

        $claim = OrderOnlinePayment::where('order_id', $order->id)->firstOrFail();
        Sanctum::actingAs($owner);
        $this->postJson("/api/online-payments/{$claim->id}/verify", ['approve' => true, 'amount' => $order->total])
            ->assertOk();

        $order->refresh();
        $this->assertSame('confirmed', $order->status);

        $delivery = DigitalDelivery::where('order_id', $order->id)->firstOrFail();
        $this->assertSame(DigitalDelivery::TYPE_HOSTED_FILE, $delivery->delivery_type);
        $this->assertNotEmpty($delivery->download_token);
        $this->assertSame(5, $delivery->max_downloads); // default policy
        $this->assertEqualsCanonicalizing(['sms', 'email'], $delivery->delivered_via);
    }

    // ── Public download flow ────────────────────────────────────────────

    private function makeDelivery(array $overrides = []): DigitalDelivery
    {
        if (! User::where('role', 'admin')->exists()) {
            User::factory()->create(['role' => 'admin']);
        }

        $package = SubscriptionPackage::create(['name' => 'T', 'slug' => 'p-' . uniqid(), 'price' => 0, 'duration_days' => 30]);
        $owner = User::factory()->create(['subscription_package_id' => $package->id]);
        $product = Product::create([
            'user_id' => $owner->id, 'name' => 'E-Book', 'sku' => 'EB-' . uniqid(),
            'selling_price' => 500, 'status' => 'active',
            'product_type' => Product::TYPE_DIGITAL,
            'digital_delivery_type' => Product::DIGITAL_DELIVERY_HOSTED_FILE,
            'digital_file_path' => 'digital-products/x/book.pdf',
            'digital_file_name' => 'book.pdf',
        ]);
        Storage::disk('local')->put($product->digital_file_path, 'PDF-CONTENT');

        $order = Order::create([
            'user_id' => $owner->id, 'order_number' => 'ORD-TEST-' . uniqid(),
            'customer_name' => 'Karim', 'customer_phone' => '01712345678', 'customer_email' => 'k@example.com',
            'status' => 'confirmed', 'payment_method' => 'bkash', 'payment_status' => 'paid',
            'subtotal' => 500, 'total' => 500,
        ]);
        $item = $order->items()->create([
            'product_id' => $product->id, 'product_name' => $product->name,
            'quantity' => 1, 'regular_price' => 500, 'unit_price' => 500, 'total' => 500,
        ]);

        return DigitalDelivery::create(array_merge([
            'order_id' => $order->id, 'order_item_id' => $item->id, 'product_id' => $product->id,
            'user_id' => $owner->id, 'customer_phone' => '01712345678', 'customer_email' => 'k@example.com',
            'delivery_type' => DigitalDelivery::TYPE_HOSTED_FILE,
            'download_token' => 'tok_' . uniqid(),
            'max_downloads' => 5, 'expires_at' => now()->addDay(),
            'status' => DigitalDelivery::STATUS_DELIVERED,
        ], $overrides));
    }

    public function test_show_endpoint_reports_otp_required_for_hosted_file(): void
    {
        $delivery = $this->makeDelivery();

        $this->getJson("/api/public/digital-deliveries/{$delivery->download_token}")
            ->assertOk()
            ->assertJsonPath('data.otp_required', true)
            ->assertJsonPath('data.otp_verified', false)
            ->assertJsonPath('data.can_download', false);
    }

    public function test_wrong_token_returns_404(): void
    {
        $this->getJson('/api/public/digital-deliveries/does-not-exist')->assertStatus(404);
    }

    public function test_download_blocked_until_otp_verified(): void
    {
        $delivery = $this->makeDelivery();

        $this->getJson("/api/public/digital-deliveries/{$delivery->download_token}/download")
            ->assertStatus(410);
    }

    public function test_send_and_verify_otp_then_download_succeeds(): void
    {
        $this->mockDispatchAsSent();
        $delivery = $this->makeDelivery();

        $this->postJson("/api/public/digital-deliveries/{$delivery->download_token}/send-otp")->assertOk();
        $delivery->refresh();
        $this->assertNotNull($delivery->otp_code);

        $this->postJson("/api/public/digital-deliveries/{$delivery->download_token}/verify-otp", ['otp_code' => 'wrong'])
            ->assertStatus(422);

        $this->postJson("/api/public/digital-deliveries/{$delivery->download_token}/verify-otp", ['otp_code' => $delivery->otp_code])
            ->assertOk();

        $this->getJson("/api/public/digital-deliveries/{$delivery->download_token}/download")
            ->assertOk()
            ->assertHeader('content-disposition');

        $delivery->refresh();
        $this->assertSame(1, $delivery->download_count);
    }

    public function test_download_count_exhaustion_blocks_further_downloads(): void
    {
        $delivery = $this->makeDelivery(['otp_verified_at' => now(), 'max_downloads' => 1, 'download_count' => 1]);

        $this->getJson("/api/public/digital-deliveries/{$delivery->download_token}/download")
            ->assertStatus(410);
    }

    public function test_expired_delivery_blocks_download(): void
    {
        $delivery = $this->makeDelivery(['otp_verified_at' => now(), 'expires_at' => now()->subHour()]);

        $this->getJson("/api/public/digital-deliveries/{$delivery->download_token}/download")
            ->assertStatus(410);
    }

    public function test_external_url_delivery_skips_otp(): void
    {
        $delivery = $this->makeDelivery([
            'delivery_type' => DigitalDelivery::TYPE_EXTERNAL_URL,
            'external_url' => 'https://example.com/my-file.zip',
        ]);

        $this->getJson("/api/public/digital-deliveries/{$delivery->download_token}")
            ->assertJsonPath('data.otp_required', false)
            ->assertJsonPath('data.can_download', true);

        $response = $this->get("/api/public/digital-deliveries/{$delivery->download_token}/download");
        $response->assertRedirect('https://example.com/my-file.zip');
    }
}
