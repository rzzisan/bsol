<?php

namespace Tests\Feature;

use App\Models\OrderItem;
use App\Models\PlatformApiKey;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConnectProductSyncTest extends TestCase
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

    private function simplePayload(string $wcProductId = 'wc-p-1'): array
    {
        return [
            'wc_product_id'  => $wcProductId,
            'name'           => 'Cotton T-Shirt',
            'sku'            => 'TSHIRT-001',
            'description'    => 'A shirt.',
            'regular_price'  => 500,
            'discount'       => 50,
            'stock_quantity' => 20,
            'manage_stock'   => true,
            'status'         => 'active',
            'image_url'      => 'https://example.com/shirt.jpg',
            'type'           => 'simple',
        ];
    }

    private function variablePayload(string $wcProductId = 'wc-p-2'): array
    {
        return [
            'wc_product_id' => $wcProductId,
            'name'          => 'Cotton T-Shirt (Variants)',
            'sku'           => 'TSHIRT-VAR',
            'description'   => 'A shirt with sizes.',
            'regular_price' => 500,
            'status'        => 'active',
            'type'          => 'variable',
            'variants'      => [
                ['wc_variation_id' => 'wc-v-1', 'sku' => 'TSHIRT-VAR-M', 'regular_price' => 500, 'stock_quantity' => 5],
                ['wc_variation_id' => 'wc-v-2', 'sku' => 'TSHIRT-VAR-L', 'regular_price' => 550, 'stock_quantity' => 3],
            ],
        ];
    }

    public function test_sync_creates_a_simple_product(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();

        $response = $this->postJson('/api/connect/v1/products/sync', $this->simplePayload(), $this->connectHeaders($rawKey));

        $response->assertOk()->assertJsonPath('data.variants_synced', 0);

        $this->assertDatabaseHas('products', [
            'user_id'    => $user->id,
            'sku'        => 'TSHIRT-001',
            'source'     => 'woocommerce',
            'source_ref' => 'wc-p-1',
            'stock'      => 20,
        ]);
    }

    public function test_sync_upserts_the_same_product_on_repeat_call(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/products/sync', $this->simplePayload(), $headers)->assertOk();
        $this->assertSame(1, Product::where('user_id', $user->id)->count());

        $updated = $this->simplePayload();
        $updated['stock_quantity'] = 5;

        $this->postJson('/api/connect/v1/products/sync', $updated, $headers)->assertOk();

        $this->assertSame(1, Product::where('user_id', $user->id)->count());
        $this->assertDatabaseHas('products', ['sku' => 'TSHIRT-001', 'stock' => 5]);
    }

    public function test_sync_creates_a_variable_product_with_variants(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();

        $response = $this->postJson('/api/connect/v1/products/sync', $this->variablePayload(), $this->connectHeaders($rawKey));

        $response->assertOk()->assertJsonPath('data.variants_synced', 2);

        $product = Product::where('user_id', $user->id)->where('source_ref', 'wc-p-2')->firstOrFail();
        $this->assertTrue((bool) $product->has_variants);
        $this->assertSame(2, ProductVariant::where('product_id', $product->id)->count());
        $this->assertDatabaseHas('product_variants', ['sku' => 'TSHIRT-VAR-M', 'stock_qty' => 5, 'source_ref' => 'wc-v-1']);
    }

    public function test_sync_upserts_variants_on_repeat_call_without_duplicating(): void
    {
        [, $rawKey] = $this->connectedMerchant();
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/products/sync', $this->variablePayload(), $headers)->assertOk();

        $updated = $this->variablePayload();
        $updated['variants'][0]['stock_quantity'] = 1;

        $this->postJson('/api/connect/v1/products/sync', $updated, $headers)->assertOk();

        $this->assertSame(2, ProductVariant::where('sku', 'like', 'TSHIRT-VAR-%')->count());
        $this->assertDatabaseHas('product_variants', ['sku' => 'TSHIRT-VAR-M', 'stock_qty' => 1]);
    }

    public function test_variant_sku_collision_is_skipped_with_a_warning_not_a_failure(): void
    {
        // product_variants.sku is unique across the whole install — two
        // different sellers' WooCommerce sites can legitimately generate
        // the same variant SKU.
        [, $keyA] = $this->connectedMerchant();
        $this->postJson('/api/connect/v1/products/sync', $this->variablePayload('wc-p-seller-a'), $this->connectHeaders($keyA))->assertOk();

        [, $keyB] = $this->connectedMerchant();
        $collidingPayload = $this->variablePayload('wc-p-seller-b');
        // variant[0] deliberately left colliding with seller A's "TSHIRT-VAR-M";
        // variant[1] renamed so only one of the two actually conflicts.
        $collidingPayload['variants'][1]['sku'] = 'TSHIRT-VAR-XL-UNIQUE';

        $response = $this->postJson('/api/connect/v1/products/sync', $collidingPayload, $this->connectHeaders($keyB));

        $response->assertOk()
            ->assertJsonPath('data.variants_synced', 1) // only the second (non-colliding) variant went through
            ->assertJsonCount(1, 'data.warnings');
    }

    public function test_order_sync_links_line_item_to_product_by_sku_once_it_exists(): void
    {
        [$user, $rawKey] = $this->connectedMerchant();
        $headers = $this->connectHeaders($rawKey);

        $this->postJson('/api/connect/v1/products/sync', $this->simplePayload(), $headers)->assertOk();
        $product = Product::where('user_id', $user->id)->where('sku', 'TSHIRT-001')->firstOrFail();

        $this->postJson('/api/connect/v1/orders/sync', [
            'wc_order_id'    => 'wc-order-1',
            'customer_phone' => '01755443322',
            'line_items'     => [
                ['name' => 'Cotton T-Shirt', 'quantity' => 1, 'total' => 500, 'sku' => 'TSHIRT-001'],
            ],
        ], $headers)->assertCreated();

        $item = OrderItem::where('sku', 'TSHIRT-001')->firstOrFail();
        $this->assertSame($product->id, $item->product_id);
        $this->assertNull($item->product_variant_id);
    }
}
