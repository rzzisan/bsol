<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * product_variants.sku uniqueness is now scoped per shop, not global —
 * pre_launch_polish_context.md §ক / migration
 * 2026_08_28_110000_scope_product_variant_sku_unique_per_shop.
 */
class ProductVariantSkuScopingTest extends TestCase
{
    use RefreshDatabase;

    public function test_two_different_sellers_can_use_the_same_sku(): void
    {
        $sellerA = User::factory()->create(['role' => 'user']);
        $sellerB = User::factory()->create(['role' => 'user']);
        $productA = Product::factory()->create(['user_id' => $sellerA->id]);
        $productB = Product::factory()->create(['user_id' => $sellerB->id]);

        $this->actingAs($sellerA)
            ->postJson("/api/products/{$productA->id}/variants", [
                'sku' => 'SKU-SHARED', 'regular_price' => 500,
            ])
            ->assertCreated();

        $this->actingAs($sellerB)
            ->postJson("/api/products/{$productB->id}/variants", [
                'sku' => 'SKU-SHARED', 'regular_price' => 500,
            ])
            ->assertCreated();

        $this->assertSame(2, ProductVariant::where('sku', 'SKU-SHARED')->count());
    }

    public function test_the_same_seller_still_cannot_reuse_a_sku_across_their_own_products(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        $productA = Product::factory()->create(['user_id' => $seller->id]);
        $productB = Product::factory()->create(['user_id' => $seller->id]);

        $this->actingAs($seller)
            ->postJson("/api/products/{$productA->id}/variants", [
                'sku' => 'SKU-DUP', 'regular_price' => 500,
            ])
            ->assertCreated();

        $this->actingAs($seller)
            ->postJson("/api/products/{$productB->id}/variants", [
                'sku' => 'SKU-DUP', 'regular_price' => 500,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('sku');
    }

    public function test_new_variants_are_stamped_with_the_products_owner(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        $product = Product::factory()->create(['user_id' => $seller->id]);

        $this->actingAs($seller)
            ->postJson("/api/products/{$product->id}/variants", [
                'sku' => 'SKU-OWNED', 'regular_price' => 500,
            ])
            ->assertCreated();

        $variant = ProductVariant::where('sku', 'SKU-OWNED')->sole();
        $this->assertSame($seller->id, $variant->user_id);
    }

    public function test_bulk_auto_generate_respects_per_shop_sku_scoping(): void
    {
        $sellerA = User::factory()->create(['role' => 'user']);
        $sellerB = User::factory()->create(['role' => 'user']);
        $productA = Product::factory()->create(['user_id' => $sellerA->id, 'name' => 'Shirt']);
        $productB = Product::factory()->create(['user_id' => $sellerB->id, 'name' => 'Shirt']);

        $color = $productA->options()->create(['name' => 'Color', 'position' => 0]);
        $color->values()->create(['value' => 'Red', 'position' => 0]);

        $colorB = $productB->options()->create(['name' => 'Color', 'position' => 0]);
        $colorB->values()->create(['value' => 'Red', 'position' => 0]);

        // Same product name + same option value on both shops means the
        // auto-generated SKU (PREFIX-RED) is identical for both — this must
        // not cause shop B's generation to skip it as "already taken".
        $this->actingAs($sellerA)
            ->postJson("/api/products/{$productA->id}/variants/generate", ['default_price' => 500])
            ->assertOk()
            ->assertJsonPath('data.created', 1);

        $this->actingAs($sellerB)
            ->postJson("/api/products/{$productB->id}/variants/generate", ['default_price' => 500])
            ->assertOk()
            ->assertJsonPath('data.created', 1);
    }
}
