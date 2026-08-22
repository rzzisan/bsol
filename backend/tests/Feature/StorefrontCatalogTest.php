<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ShopProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * S1 of seller_storefront_context.md — public catalog API (categories,
 * products list, product detail), host-resolved like the landing-page
 * public endpoints (LandingPageSubdomainTest is the sibling of this file).
 */
class StorefrontCatalogTest extends TestCase
{
    use RefreshDatabase;

    private function apex(): string
    {
        return config('app.subdomain_apex');
    }

    private function seller(string $subdomain, string $shopName = 'Shop'): User
    {
        $user = User::factory()->create();

        ShopProfile::create([
            'user_id' => $user->id,
            'shop_name' => $shopName,
            'phone' => '01711223344',
            'address' => 'Dhaka',
            'subdomain' => $subdomain,
            'subdomain_status' => 'active',
        ]);

        return $user;
    }

    private function product(User $owner, array $attrs = []): Product
    {
        return Product::create(array_merge([
            'user_id' => $owner->id,
            'name' => 'Test Product',
            'sku' => 'SKU-' . uniqid(),
            'slug' => 'test-product-' . uniqid(),
            'description' => 'A description.',
            'regular_price' => 1000,
            'discount' => 0,
            'discount_type' => 'amount',
            'selling_price' => 1000,
            'cost_price' => 400, // must never leak publicly
            'stock' => 10,
            'track_stock' => true,
            'status' => 'active',
            'show_in_storefront' => true,
        ], $attrs));
    }

    public function test_categories_scoped_to_host_and_active_only(): void
    {
        $a = $this->seller('shopa');
        $b = $this->seller('shopb');

        ProductCategory::create(['user_id' => $a->id, 'name' => 'Visible', 'slug' => 'visible', 'is_active' => true]);
        ProductCategory::create(['user_id' => $a->id, 'name' => 'Hidden', 'slug' => 'hidden', 'is_active' => false]);
        ProductCategory::create(['user_id' => $b->id, 'name' => 'Other Shop', 'slug' => 'other-shop', 'is_active' => true]);

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/categories")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.slug', 'visible');
    }

    public function test_products_list_excludes_inactive_and_hidden_and_other_shops(): void
    {
        $a = $this->seller('shopa');
        $b = $this->seller('shopb');

        $visible = $this->product($a, ['name' => 'Visible Product']);
        $this->product($a, ['name' => 'Inactive', 'status' => 'inactive']);
        $this->product($a, ['name' => 'Excluded', 'show_in_storefront' => false]);
        $this->product($b, ['name' => 'Other Shop Product']);

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/products")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visible->id);
    }

    public function test_products_list_filters_by_category_and_search_and_sorts_by_price(): void
    {
        $a = $this->seller('shopa');
        $cat = ProductCategory::create(['user_id' => $a->id, 'name' => 'Oil', 'slug' => 'oil', 'is_active' => true]);

        $cheap = $this->product($a, ['name' => 'Cheap Oil', 'category_id' => $cat->id, 'selling_price' => 100]);
        $costly = $this->product($a, ['name' => 'Costly Oil', 'category_id' => $cat->id, 'selling_price' => 900]);
        $this->product($a, ['name' => 'Unrelated Item']);

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/products?category=oil&sort=price_asc")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $cheap->id)
            ->assertJsonPath('data.1.id', $costly->id);

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/products?q=Costly")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $costly->id);
    }

    /**
     * The regression this test exists for: digital_product_context.md's own
     * leak (Product had no $hidden, a public endpoint dumped the whole
     * model). This endpoint is allowlist-built, not model-dump-built, but
     * the test still asserts the negative directly rather than trusting
     * the implementation approach alone.
     */
    public function test_product_detail_never_leaks_internal_fields(): void
    {
        $a = $this->seller('shopa');
        $product = $this->product($a, [
            'name' => 'Leak Check',
            'digital_external_url' => null,
        ]);

        $response = $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/products/{$product->slug}")
            ->assertOk()
            ->assertJsonPath('data.id', $product->id)
            ->assertJsonPath('data.name', 'Leak Check');

        $json = $response->json('data');

        foreach (['cost_price', 'user_id', 'source', 'source_ref', 'platform_api_key_id', 'digital_file_path', 'digital_external_url', 'digital_file_mime_type', 'track_stock', 'low_stock_alert'] as $field) {
            $this->assertArrayNotHasKey($field, $json, "field '{$field}' must not appear in the public product response");
        }

        $this->assertSame(['average' => 0, 'count' => 0], $json['rating']);
        $this->assertIsArray($json['related_products']);
    }

    public function test_product_detail_resolves_warranty_and_delivery_from_shop_default_when_no_override(): void
    {
        $a = $this->seller('shopa');

        \App\Models\StorefrontSetting::create([
            'user_id' => $a->id,
            'warranty_policy_text' => 'Shop-wide 1 year warranty.',
            'delivery_policy_text' => 'Shop-wide 48-72h delivery.',
        ]);

        $product = $this->product($a, ['warranty_override' => null, 'delivery_override' => null]);
        $overridden = $this->product($a, ['warranty_override' => 'This item: no warranty.']);

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/products/{$product->slug}")
            ->assertOk()
            ->assertJsonPath('data.warranty_text', 'Shop-wide 1 year warranty.')
            ->assertJsonPath('data.delivery_text', 'Shop-wide 48-72h delivery.');

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/products/{$overridden->slug}")
            ->assertOk()
            ->assertJsonPath('data.warranty_text', 'This item: no warranty.');
    }

    public function test_unknown_subdomain_returns_404_for_every_catalog_endpoint(): void
    {
        $apex = $this->apex();

        $this->getJson("https://nosuchshop.{$apex}/api/public/storefront/categories")->assertNotFound();
        $this->getJson("https://nosuchshop.{$apex}/api/public/storefront/products")->assertNotFound();
        $this->getJson("https://nosuchshop.{$apex}/api/public/storefront/products/anything")->assertNotFound();
        $this->getJson("https://nosuchshop.{$apex}/api/public/storefront/home")->assertNotFound();
    }

    public function test_home_bundles_shop_and_featured_data(): void
    {
        $a = $this->seller('shopa', 'Shop A');
        $cat = ProductCategory::create(['user_id' => $a->id, 'name' => 'Oil', 'slug' => 'oil', 'is_active' => true]);

        \App\Models\StorefrontSetting::create([
            'user_id' => $a->id,
            'featured_category_ids' => [$cat->id],
        ]);

        $featured = $this->product($a, ['name' => 'Featured Item', 'is_featured' => true]);
        $this->product($a, ['name' => 'Not Featured']);

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/home")
            ->assertOk()
            ->assertJsonPath('data.shop_name', 'Shop A')
            ->assertJsonPath('data.phone', '01711223344')
            // No StorefrontSetting.whatsapp_number was set -> falls back to
            // the shop phone (§7 of seller_storefront_context.md).
            ->assertJsonPath('data.whatsapp_number', '01711223344')
            // No connected FacebookPageConnection -> hidden regardless of
            // the show_messenger_button toggle's default.
            ->assertJsonPath('data.show_messenger_button', false)
            ->assertJsonPath('data.messenger_page_id', null)
            ->assertJsonCount(1, 'data.featured_categories')
            ->assertJsonPath('data.featured_categories.0.slug', 'oil')
            ->assertJsonCount(1, 'data.featured_products')
            ->assertJsonPath('data.featured_products.0.id', $featured->id)
            // No theme_template set -> defaults to 'standard'; no shipping
            // rates configured -> platform fallback defaults (70/120).
            ->assertJsonPath('data.theme_template', 'standard')
            ->assertJsonPath('data.shipping_charge_inside_dhaka', '70.00')
            ->assertJsonPath('data.shipping_charge_outside_dhaka', '120.00')
            // No nav colors configured -> platform fallback defaults.
            ->assertJsonPath('data.nav_bg_color', '#111827')
            ->assertJsonPath('data.nav_text_color', '#ffffff')
            // No thumbnail uploaded -> null (storefront falls back to the
            // letter-circle).
            ->assertJsonPath('data.featured_categories.0.thumbnail_url', null);
    }

    public function test_home_reflects_configured_nav_colors_and_category_thumbnail(): void
    {
        $a = $this->seller('shopc', 'Shop C');
        $cat = ProductCategory::create([
            'user_id' => $a->id, 'name' => 'Oil', 'slug' => 'oil', 'is_active' => true,
            'thumbnail_url' => 'https://example.com/oil-thumb.jpg',
        ]);
        \App\Models\StorefrontSetting::create([
            'user_id' => $a->id,
            'featured_category_ids' => [$cat->id],
            'nav_bg_color' => '#0f2e28',
            'nav_text_color' => '#f0fdf4',
        ]);

        $this->getJson("https://shopc.{$this->apex()}/api/public/storefront/home")
            ->assertOk()
            ->assertJsonPath('data.nav_bg_color', '#0f2e28')
            ->assertJsonPath('data.nav_text_color', '#f0fdf4')
            ->assertJsonPath('data.featured_categories.0.thumbnail_url', 'https://example.com/oil-thumb.jpg');
    }

    public function test_home_reflects_configured_theme_template_and_shipping_charges(): void
    {
        $a = $this->seller('shopb', 'Shop B');
        \App\Models\StorefrontSetting::create([
            'user_id' => $a->id,
            'theme_template' => 'caresolution',
            'shipping_charge_inside_dhaka' => 90,
            'shipping_charge_outside_dhaka' => 160,
        ]);

        $this->getJson("https://shopb.{$this->apex()}/api/public/storefront/home")
            ->assertOk()
            ->assertJsonPath('data.theme_template', 'caresolution')
            ->assertJsonPath('data.shipping_charge_inside_dhaka', '90.00')
            ->assertJsonPath('data.shipping_charge_outside_dhaka', '160.00');
    }

    public function test_sitemap_data_lists_categories_products_and_published_landing_pages_scoped_to_shop(): void
    {
        $a = $this->seller('shopa');
        $b = $this->seller('shopb');

        ProductCategory::create(['user_id' => $a->id, 'name' => 'Oil', 'slug' => 'oil', 'is_active' => true]);
        ProductCategory::create(['user_id' => $a->id, 'name' => 'Hidden', 'slug' => 'hidden', 'is_active' => false]);
        $this->product($a, ['name' => 'Visible']);
        $this->product($a, ['name' => 'Hidden Product', 'show_in_storefront' => false]);
        $this->product($b, ['name' => 'Other Shop Product']);

        \App\Models\LandingPage::create([
            'user_id' => $a->id, 'title' => 'Live', 'slug' => 'live',
            'status' => 'published', 'published_at' => now(), 'content' => [],
        ]);
        \App\Models\LandingPage::create([
            'user_id' => $a->id, 'title' => 'Draft', 'slug' => 'draft',
            'status' => 'draft', 'content' => [],
        ]);

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/sitemap-data")
            ->assertOk()
            ->assertJsonCount(1, 'data.categories')
            ->assertJsonPath('data.categories.0.slug', 'oil')
            // Only the show_in_storefront=true, same-shop product counts —
            // hidden and cross-shop products are excluded.
            ->assertJsonCount(1, 'data.products')
            ->assertJsonCount(1, 'data.landing_pages')
            ->assertJsonPath('data.landing_pages.0.slug', 'live');
    }
}
