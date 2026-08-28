<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * OrderController::store()'s variant lookup used to have no ownership
 * filter at all — an item naming only product_variant_id (no product_id)
 * skipped the product_id==variant.product_id cross-check entirely, so
 * another shop's variant (pricing/stock/SKU) could be pulled into an
 * order — pre_launch_polish_context.md §ক.
 */
class OrderStoreVariantScopingTest extends TestCase
{
    use RefreshDatabase;

    private function makeVariantFor(User $owner, array $overrides = []): ProductVariant
    {
        $product = Product::factory()->create(['user_id' => $owner->id]);

        return ProductVariant::create(array_merge([
            'product_id' => $product->id,
            'user_id' => $owner->id,
            'sku' => 'SKU-' . uniqid(),
            'regular_price' => 500,
            'selling_price' => 500,
            'stock_qty' => 10,
            'is_active' => true,
        ], $overrides));
    }

    private function orderPayload(?int $variantId, ?int $productId = null): array
    {
        return [
            'customer_phone' => '01712345678',
            'items' => [[
                'product_name' => 'Test item',
                'product_id' => $productId,
                'product_variant_id' => $variantId,
                'quantity' => 1,
                'unit_price' => 500,
            ]],
        ];
    }

    public function test_a_variant_id_from_another_shop_with_no_product_id_is_rejected(): void
    {
        $attacker = User::factory()->create(['role' => 'user']);
        $victim = User::factory()->create(['role' => 'user']);
        $victimVariant = $this->makeVariantFor($victim);

        $this->actingAs($attacker)
            ->postJson('/api/orders', $this->orderPayload($victimVariant->id))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');

        $this->assertSame(0, Order::where('user_id', $attacker->id)->count());
    }

    public function test_a_variant_id_from_another_shop_is_rejected_even_with_a_matching_product_id(): void
    {
        $attacker = User::factory()->create(['role' => 'user']);
        $victim = User::factory()->create(['role' => 'user']);
        $victimVariant = $this->makeVariantFor($victim);

        // Even if the attacker also passes the (victim's) product_id, the
        // variant lookup itself is scoped to the attacker's own shop now —
        // it's rejected before the product_id cross-check would even run.
        $this->actingAs($attacker)
            ->postJson('/api/orders', $this->orderPayload($victimVariant->id, $victimVariant->product_id))
            ->assertUnprocessable();
    }

    public function test_a_sellers_own_variant_still_works_normally(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        $variant = $this->makeVariantFor($seller);

        $this->actingAs($seller)
            ->postJson('/api/orders', $this->orderPayload($variant->id, $variant->product_id))
            ->assertCreated();

        $this->assertSame(1, Order::where('user_id', $seller->id)->count());
    }

    public function test_a_variant_belonging_to_a_different_product_than_stated_is_still_rejected(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        $variant = $this->makeVariantFor($seller);
        $otherProduct = Product::factory()->create(['user_id' => $seller->id]);

        $this->actingAs($seller)
            ->postJson('/api/orders', $this->orderPayload($variant->id, $otherProduct->id))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');
    }
}
