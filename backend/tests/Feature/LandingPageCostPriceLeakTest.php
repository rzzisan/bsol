<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Models\ProductVariant;
use App\Models\ShopProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * cost_price is the seller's internal margin — ProductVariantFormatter (used
 * by the authenticated merchant dashboard, ProductVariantController) includes
 * it, but the unauthenticated landing-page endpoints must never leak it.
 * Mirrors the digital-file-path leak regression in DigitalProductTest.
 */
class LandingPageCostPriceLeakTest extends TestCase
{
    use RefreshDatabase;

    private function apex(): string
    {
        return config('app.subdomain_apex');
    }

    /** @return array{0: LandingPage, 1: Product, 2: ProductVariant} */
    private function shopWithVariant(): array
    {
        $owner = User::factory()->create();

        ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => 'shopa', 'subdomain_status' => 'active',
        ]);

        $page = LandingPage::create([
            'user_id' => $owner->id, 'title' => 'Offer', 'slug' => 'offer',
            'status' => 'published', 'published_at' => now(), 'content' => [],
        ]);

        $product = Product::create([
            'user_id' => $owner->id, 'name' => 'T-Shirt', 'sku' => 'TS-' . uniqid(),
            'selling_price' => 500, 'cost_price' => 275.50, 'stock' => 10,
            'track_stock' => true, 'status' => 'active',
        ]);

        $option = ProductOption::create([
            'product_id' => $product->id, 'name' => 'Size', 'type' => 'select',
        ]);
        $optionValue = ProductOptionValue::create([
            'product_option_id' => $option->id, 'value' => 'M',
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id, 'sku' => 'TS-M-' . uniqid(),
            'regular_price' => 500, 'discount' => 0, 'discount_type' => 'amount',
            'cost_price' => 199.99, 'stock_qty' => 5, 'low_stock_threshold' => 2,
            'is_active' => true,
        ]);
        $variant->optionValues()->attach($optionValue->id);

        LandingPageProduct::create([
            'landing_page_id' => $page->id, 'product_id' => $product->id,
            'product_variant_id' => $variant->id, 'sort_order' => 0,
        ]);

        return [$page, $product, $variant];
    }

    public function test_public_variant_resolve_does_not_leak_cost_price(): void
    {
        [, $product, $variant] = $this->shopWithVariant();
        $optionValueId = $variant->optionValues()->first()->id;

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/products/{$product->id}/variants/resolve",
            ['option_value_ids' => [$optionValueId]]
        );

        $response->assertOk();
        $this->assertArrayNotHasKey('cost_price', $response->json('data'));
        $this->assertStringNotContainsString('199.99', $response->getContent());
    }

    public function test_public_landing_page_show_does_not_leak_cost_price(): void
    {
        $this->shopWithVariant();

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/landing-pages/offer");

        $response->assertOk();
        $landingProduct = collect($response->json('data.products'))->first();
        $this->assertArrayNotHasKey('cost_price', $landingProduct['product']);
        // LandingPageProduct::variant() currently has no explicit foreign
        // key, so it queries the (non-existent) "variant_id" column instead
        // of "product_variant_id" and always resolves null — a separate,
        // pre-existing bug (flagged separately) that means the pinned
        // variant never actually serializes here today. Assert defensively
        // anyway so this stays caught the moment that relation is fixed.
        if (is_array($landingProduct['variant'] ?? null)) {
            $this->assertArrayNotHasKey('cost_price', $landingProduct['variant']);
        }
        $body = $response->getContent();
        $this->assertStringNotContainsString('275.5', $body);
        $this->assertStringNotContainsString('199.99', $body);
    }

    /**
     * Options are product-level attribute definitions (Size/Color) with no
     * pricing fields at all — confirms this endpoint has no equivalent leak.
     */
    public function test_public_product_options_endpoint_has_no_price_fields(): void
    {
        [, $product] = $this->shopWithVariant();

        $response = $this->getJson(
            "https://shopa.{$this->apex()}/api/public/landing-pages/offer/products/{$product->id}/options"
        );

        $response->assertOk();
        $this->assertStringNotContainsString('cost_price', $response->getContent());
    }
}
