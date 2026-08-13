<?php

namespace Tests\Feature;

use App\Jobs\PushWooCommerceStockJob;
use App\Models\PlatformApiKey;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Phase 7 — inbound stock push-back (BSOL -> WooCommerce). Covers the
 * dispatch conditions (Product::booted()/ProductVariant::booted()) and the
 * job's own execution (WooCommerceStockPushService HTTP call). QUEUE_CONNECTION
 * is `sync` in phpunit.xml, so dispatched jobs run inline unless Queue::fake()
 * is active — tests split accordingly.
 */
class WooCommerceStockPushTest extends TestCase
{
    use RefreshDatabase;

    private function connectedMerchant(array $overrides = []): array
    {
        $user = User::factory()->create();
        $rawKey = PlatformApiKey::generateRawKey();

        $apiKey = PlatformApiKey::create(array_merge([
            'user_id'    => $user->id,
            'platform'   => 'woocommerce',
            'domain'     => 'myshop.com',
            'key_hash'   => PlatformApiKey::hashKey($rawKey),
            'key_prefix' => substr($rawKey, 0, 12),
            'webhook_secret' => 'test-webhook-secret',
            'status'     => 'connected',
        ], $overrides));

        return [$user, $apiKey, $rawKey];
    }

    private function wcProduct(User $user, array $overrides = []): Product
    {
        return Product::create(array_merge([
            'user_id'      => $user->id,
            'name'         => 'Cotton T-Shirt',
            'sku'          => 'TSHIRT-001',
            'source'       => 'woocommerce',
            'source_ref'   => 'wc-p-1',
            'selling_price'=> 500,
            'cost_price'   => 300,
            'stock'        => 20,
            'track_stock'  => true,
            'status'       => 'active',
            'has_variants' => false,
        ], $overrides));
    }

    // ── Dispatch conditions ─────────────────────────────────────────────

    public function test_stock_change_on_woocommerce_product_dispatches_push_job(): void
    {
        Queue::fake();
        [$user] = $this->connectedMerchant();
        $product = $this->wcProduct($user);

        $product->update(['stock' => 5]);

        Queue::assertPushed(PushWooCommerceStockJob::class);
    }

    public function test_non_stock_field_change_does_not_dispatch(): void
    {
        [$user] = $this->connectedMerchant();
        $product = $this->wcProduct($user);

        // Creation itself counts as a "change" on every fillable attribute
        // (including stock) — fake the queue only *after* creating, so
        // this test isolates the one thing it's actually checking.
        Queue::fake();
        $product->update(['name' => 'Renamed Shirt']);

        Queue::assertNotPushed(PushWooCommerceStockJob::class);
    }

    public function test_manual_product_stock_change_does_not_dispatch(): void
    {
        Queue::fake();
        [$user] = $this->connectedMerchant();
        $product = $this->wcProduct($user, ['source' => 'manual', 'source_ref' => null]);

        $product->update(['stock' => 5]);

        Queue::assertNotPushed(PushWooCommerceStockJob::class);
    }

    public function test_variable_parent_stock_change_does_not_dispatch(): void
    {
        Queue::fake();
        [$user] = $this->connectedMerchant();
        $product = $this->wcProduct($user, ['has_variants' => true, 'stock' => 0]);

        $product->update(['stock' => 1]);

        Queue::assertNotPushed(PushWooCommerceStockJob::class);
    }

    public function test_variant_stock_change_dispatches_push_job(): void
    {
        Queue::fake();
        [$user] = $this->connectedMerchant();
        $product = $this->wcProduct($user, ['has_variants' => true, 'stock' => 0]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'TSHIRT-001-M',
            'source' => 'woocommerce',
            'source_ref' => 'wc-v-1',
            'regular_price' => 500,
            'stock_qty' => 5,
        ]);

        $variant->update(['stock_qty' => 2]);

        Queue::assertPushed(PushWooCommerceStockJob::class);
    }

    public function test_connect_product_sync_does_not_echo_a_push_job_back(): void
    {
        Queue::fake();
        [$user, , $rawKey] = $this->connectedMerchant();

        $this->postJson('/api/connect/v1/products/sync', [
            'wc_product_id'  => 'wc-p-echo',
            'name'           => 'Echo Test',
            'sku'            => 'ECHO-001',
            'description'    => 'A test product.',
            'regular_price'  => 500,
            'stock_quantity' => 10,
            'manage_stock'   => true,
            'status'         => 'active',
            'type'           => 'simple',
        ], ['X-API-KEY' => $rawKey, 'X-Client-Domain' => 'myshop.com'])->assertOk();

        Queue::assertNotPushed(PushWooCommerceStockJob::class);
    }

    // ── Job execution ───────────────────────────────────────────────────

    public function test_job_pushes_stock_to_wordpress_over_http(): void
    {
        Http::fake(['*/wp-json/bsol-connect/v1/stock-update' => Http::response(['success' => true], 200)]);
        [$user, , ] = $this->connectedMerchant();
        $product = $this->wcProduct($user);

        PushWooCommerceStockJob::dispatchSync('product', $product->id);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://myshop.com/wp-json/bsol-connect/v1/stock-update'
                && $request->hasHeader('X-BSOL-Webhook-Secret', 'test-webhook-secret')
                && $request['wc_id'] === 'wc-p-1'
                && $request['stock_quantity'] === 20;
        });
    }

    public function test_job_no_ops_silently_when_shop_is_disconnected(): void
    {
        Http::fake();
        [$user] = $this->connectedMerchant(['status' => 'revoked']);
        $product = $this->wcProduct($user);

        PushWooCommerceStockJob::dispatchSync('product', $product->id);

        Http::assertNothingSent();
    }
}
