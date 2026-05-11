<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\LandingTemplate;
use App\Models\LandingTemplateAccessRule;
use App\Models\Order;
use App\Models\Product;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LandingPageApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_seller_only_sees_active_and_allowed_templates(): void
    {
        $package = SubscriptionPackage::create([
            'name' => 'Growth',
            'slug' => 'growth',
            'price' => 999,
            'duration_days' => 30,
        ]);

        $seller = User::factory()->create([
            'role' => 'user',
            'subscription_package_id' => $package->id,
        ]);

        $allowed = LandingTemplate::create([
            'code' => 'allowed_template',
            'name_bn' => 'Allowed',
            'name_en' => 'Allowed',
            'default_schema_json' => ['sections' => []],
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $disabled = LandingTemplate::create([
            'code' => 'disabled_template',
            'name_bn' => 'Disabled',
            'name_en' => 'Disabled',
            'default_schema_json' => ['sections' => []],
            'is_active' => false,
            'sort_order' => 2,
        ]);

        $blocked = LandingTemplate::create([
            'code' => 'blocked_template',
            'name_bn' => 'Blocked',
            'name_en' => 'Blocked',
            'default_schema_json' => ['sections' => []],
            'is_active' => true,
            'sort_order' => 3,
        ]);

        LandingTemplateAccessRule::create([
            'template_id' => $allowed->id,
            'package_id' => $package->id,
            'is_enabled' => true,
        ]);

        LandingTemplateAccessRule::create([
            'template_id' => $blocked->id,
            'package_id' => $package->id,
            'is_enabled' => false,
        ]);

        $token = $seller->createToken('test-suite')->plainTextToken;

        $this->getJson('/api/landing/templates/available', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'allowed_template');

        $this->assertDatabaseHas('landing_templates', ['id' => $disabled->id, 'is_active' => false]);
    }

    public function test_seller_cannot_create_landing_page_with_unavailable_template(): void
    {
        $package = SubscriptionPackage::create([
            'name' => 'Starter',
            'slug' => 'starter',
            'price' => 499,
            'duration_days' => 30,
        ]);

        $seller = User::factory()->create([
            'role' => 'user',
            'subscription_package_id' => $package->id,
        ]);

        $template = LandingTemplate::create([
            'code' => 'disabled_template',
            'name_bn' => 'Disabled',
            'name_en' => 'Disabled',
            'default_schema_json' => ['sections' => []],
            'is_active' => false,
            'sort_order' => 1,
        ]);

        $token = $seller->createToken('test-suite')->plainTextToken;

        $this->postJson('/api/landing/pages', [
            'template_id' => $template->id,
            'title' => 'Blocked Page',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertStatus(422);
    }

    public function test_seller_can_create_and_publish_landing_page(): void
    {
        $package = SubscriptionPackage::create([
            'name' => 'Pro',
            'slug' => 'pro',
            'price' => 1499,
            'duration_days' => 30,
        ]);

        $seller = User::factory()->create([
            'role' => 'user',
            'subscription_package_id' => $package->id,
        ]);

        $template = LandingTemplate::create([
            'code' => 'goofi_flashcard_offer',
            'name_bn' => 'Goofi',
            'name_en' => 'Goofi',
            'default_schema_json' => ['sections' => []],
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $product = Product::create([
            'user_id' => $seller->id,
            'name' => 'Flash Card',
            'sku' => 'FLASH-1',
            'description' => 'desc',
            'selling_price' => 300,
            'cost_price' => 150,
            'stock' => 25,
            'track_stock' => true,
            'status' => 'active',
        ]);

        $token = $seller->createToken('test-suite')->plainTextToken;

        $create = $this->postJson('/api/landing/pages', [
            'template_id' => $template->id,
            'title' => 'My Landing',
            'content_json' => [
                'sections' => [],
                'contact' => ['phone' => '01800000000'],
                'policy' => [
                    'privacy_url' => 'https://example.com/privacy',
                    'terms_url' => 'https://example.com/terms',
                ],
            ],
            'products' => [
                [
                    'product_id' => $product->id,
                    'default_qty' => 1,
                ],
            ],
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertCreated()->assertJsonPath('success', true);

        $pageId = $create->json('data.id');

        $this->putJson('/api/landing/pages/'.$pageId.'/publish', [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertJsonPath('data.status', 'published');

        $this->assertDatabaseHas('landing_pages', [
            'id' => $pageId,
            'status' => 'published',
        ]);
    }

    public function test_public_order_is_saved_with_landing_page_source(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $template = LandingTemplate::create([
            'code' => 'naturiva_package_upsell',
            'name_bn' => 'Naturiva',
            'name_en' => 'Naturiva',
            'default_schema_json' => ['sections' => []],
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $product = Product::create([
            'user_id' => $seller->id,
            'name' => 'Package Product',
            'sku' => 'PKG-1',
            'description' => 'desc',
            'selling_price' => 450,
            'cost_price' => 200,
            'stock' => 40,
            'track_stock' => true,
            'status' => 'active',
        ]);

        $page = LandingPage::create([
            'user_id' => $seller->id,
            'template_id' => $template->id,
            'title' => 'Public Landing',
            'slug' => 'public-landing',
            'status' => 'published',
            'public_url' => '/store/public-landing',
            'content_json' => [
                'sections' => [],
                'contact' => ['phone' => '01800000000'],
                'policy' => [
                    'privacy_url' => 'https://example.com/privacy',
                    'terms_url' => 'https://example.com/terms',
                ],
            ],
        ]);

        LandingPageProduct::create([
            'landing_page_id' => $page->id,
            'product_id' => $product->id,
            'default_qty' => 1,
            'display_order' => 0,
        ]);

        $this->postJson('/api/landing/public/public-landing/order', [
            'customer_name' => 'Public Buyer',
            'customer_phone' => '01700000000',
            'customer_address' => 'Dhaka',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('orders', [
            'user_id' => $seller->id,
            'source' => 'landing_page',
            'source_ref' => 'public-landing',
            'customer_phone' => '01700000000',
        ]);

        $order = Order::query()->where('source_ref', 'public-landing')->first();
        $this->assertNotNull($order);
        $this->assertSame('pending', $order->status);
    }
}
