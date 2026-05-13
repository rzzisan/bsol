<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\LandingPageAnalyticsDaily;
use App\Models\LandingPageConversionTracking;
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

    public function test_locked_preview_returns_totals_snapshot_and_warnings(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $template = LandingTemplate::create([
            'code' => 'naturiva_package_upsell',
            'name_bn' => 'Naturiva',
            'name_en' => 'Naturiva',
            'layout_profile' => 'naturiva_exact_clone_locked',
            'editor_mode' => 'locked',
            'default_schema_json' => ['layout_profile' => 'naturiva_exact_clone_locked'],
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $page = LandingPage::create([
            'user_id' => $seller->id,
            'template_id' => $template->id,
            'title' => 'Locked Preview Page',
            'slug' => 'locked-preview-page',
            'status' => 'draft',
            'content_json' => [
                'layout_profile' => 'naturiva_exact_clone_locked',
                'hero' => ['title' => 'Test', 'subtitle' => 'Test', 'disclaimer' => ''],
                'proof' => ['video_url' => '', 'review_images' => []],
                'offer_strip' => ['cta_label' => 'অর্ডার', 'package_highlights' => []],
                'contact' => ['call_numbers' => ['01712345678'], 'whatsapp_numbers' => []],
                'checkout' => [
                    'section_title' => 'Checkout',
                    'packages' => [
                        ['id' => 'p1', 'title' => 'P1', 'price' => 1800, 'is_default' => true],
                        ['id' => 'p2', 'title' => 'P2', 'price' => 1000, 'is_default' => false],
                    ],
                    'shipping_options' => [
                        ['id' => 's1', 'label' => 'ঢাকা', 'fee' => 50, 'is_default' => true],
                        ['id' => 's2', 'label' => 'বাহিরে', 'fee' => 100, 'is_default' => false],
                    ],
                    'upsell' => [
                        'enabled' => true,
                        'price' => 999,
                    ],
                    'cod_confirmation_text' => '',
                    'submit_label' => 'Confirm Order',
                ],
                'bottom_cta' => ['text' => 'Call', 'phone' => ''],
                'policy' => ['privacy_url' => 'https://example.com/privacy', 'terms_url' => 'https://example.com/terms'],
                'theme' => ['primary' => '#0b7a2a', 'accent' => '#ff6a00', 'button_text' => '#fff'],
            ],
        ]);

        $token = $seller->createToken('test-suite')->plainTextToken;

        $this->getJson('/api/landing/pages/'.$page->id.'/preview', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('data.totals_snapshot.package_price', 1800)
            ->assertJsonPath('data.totals_snapshot.shipping_fee', 50)
            ->assertJsonPath('data.totals_snapshot.upsell_price', 999)
            ->assertJsonPath('data.totals_snapshot.total', 2849)
            ->assertJsonStructure([
                'data' => [
                    'validation_warnings',
                ],
            ]);
    }

    public function test_locked_template_rejects_invalid_phone_and_missing_policy_on_store(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $template = LandingTemplate::create([
            'code' => 'naturiva_package_upsell',
            'name_bn' => 'Naturiva',
            'name_en' => 'Naturiva',
            'layout_profile' => 'naturiva_exact_clone_locked',
            'editor_mode' => 'locked',
            'default_schema_json' => ['layout_profile' => 'naturiva_exact_clone_locked'],
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $token = $seller->createToken('test-suite')->plainTextToken;

        $payload = [
            'template_id' => $template->id,
            'title' => 'Invalid Locked Content',
            'content_json' => [
                'layout_profile' => 'naturiva_exact_clone_locked',
                'hero' => ['title' => 'Test', 'subtitle' => 'Test', 'disclaimer' => ''],
                'proof' => ['video_url' => '', 'review_images' => []],
                'offer_strip' => ['cta_label' => 'অর্ডার', 'package_highlights' => []],
                'contact' => ['call_numbers' => ['12345'], 'whatsapp_numbers' => []],
                'checkout' => [
                    'section_title' => 'Checkout',
                    'packages' => [
                        ['id' => 'p1', 'title' => 'P1', 'price' => 1800, 'is_default' => true],
                        ['id' => 'p2', 'title' => 'P2', 'price' => 1000, 'is_default' => false],
                    ],
                    'shipping_options' => [
                        ['id' => 's1', 'label' => 'ঢাকা', 'fee' => 50, 'is_default' => true],
                    ],
                    'upsell' => [
                        'enabled' => true,
                        'price' => 999,
                    ],
                    'cod_confirmation_text' => 'ok',
                    'submit_label' => 'Confirm Order',
                ],
                'bottom_cta' => ['text' => 'Call', 'phone' => ''],
                'policy' => ['privacy_url' => '', 'terms_url' => ''],
                'theme' => ['primary' => '#0b7a2a', 'accent' => '#ff6a00', 'button_text' => '#fff'],
            ],
        ];

        $this->postJson('/api/landing/pages', $payload, [
            'Authorization' => 'Bearer '.$token,
        ])->assertStatus(422);
    }

    public function test_public_tracking_endpoints_update_daily_metrics(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $template = LandingTemplate::create([
            'code' => 'tracking_template',
            'name_bn' => 'Tracking',
            'name_en' => 'Tracking',
            'default_schema_json' => ['sections' => []],
            'is_active' => true,
            'sort_order' => 1,
        ]);

        LandingPage::create([
            'user_id' => $seller->id,
            'template_id' => $template->id,
            'title' => 'Tracking Landing',
            'slug' => 'tracking-landing',
            'status' => 'published',
            'public_url' => '/store/tracking-landing',
            'content_json' => [
                'sections' => [],
                'policy' => [
                    'privacy_url' => 'https://example.com/privacy',
                    'terms_url' => 'https://example.com/terms',
                ],
            ],
        ]);

        $this->postJson('/api/landing/track/view', [
            'slug' => 'tracking-landing',
            'session_id' => 'sess-test-1',
            'visitor_id' => 'visitor-test-1',
            'source' => 'facebook_ads',
            'device' => 'mobile',
            'country' => 'BD',
        ])->assertOk();

        $this->postJson('/api/landing/track/cta', [
            'slug' => 'tracking-landing',
            'session_id' => 'sess-test-1',
            'visitor_id' => 'visitor-test-1',
            'source' => 'facebook_ads',
            'device' => 'mobile',
            'country' => 'BD',
        ])->assertOk();

        $this->postJson('/api/landing/track/checkout-start', [
            'slug' => 'tracking-landing',
            'session_id' => 'sess-test-1',
            'visitor_id' => 'visitor-test-1',
            'source' => 'facebook_ads',
            'device' => 'mobile',
            'country' => 'BD',
        ])->assertOk();

        $this->postJson('/api/landing/track/order-bump', [
            'slug' => 'tracking-landing',
            'session_id' => 'sess-test-1',
            'visitor_id' => 'visitor-test-1',
            'source' => 'facebook_ads',
            'device' => 'mobile',
            'country' => 'BD',
        ])->assertOk();

        $this->postJson('/api/landing/track/upsell', [
            'slug' => 'tracking-landing',
            'session_id' => 'sess-test-1',
            'visitor_id' => 'visitor-test-1',
            'source' => 'facebook_ads',
            'device' => 'mobile',
            'country' => 'BD',
        ])->assertOk();

        $this->postJson('/api/landing/track/order-complete', [
            'slug' => 'tracking-landing',
            'revenue' => 1200,
            'session_id' => 'sess-test-1',
            'visitor_id' => 'visitor-test-1',
            'source' => 'facebook_ads',
            'device' => 'mobile',
            'country' => 'BD',
        ])->assertOk();

        $row = LandingPageAnalyticsDaily::query()->first();
        $this->assertNotNull($row);
        $this->assertSame(1, (int) $row->total_views);
        $this->assertSame(1, (int) $row->cta_clicks);
        $this->assertSame(1, (int) $row->checkout_starts);
        $this->assertSame(1, (int) $row->order_bumps_accepted);
        $this->assertSame(1, (int) $row->upsells_accepted);
        $this->assertSame(1, (int) $row->orders_completed);
        $this->assertSame(1200.0, (float) $row->revenue);

        $this->assertDatabaseHas('landing_page_conversion_tracking', [
            'landing_page_id' => $row->landing_page_id,
            'event_type' => 'order_complete',
            'session_id' => 'sess-test-1',
            'visitor_id' => 'visitor-test-1',
            'source' => 'facebook_ads',
            'device' => 'mobile',
            'country' => 'BD',
        ]);

        $this->assertSame(6, LandingPageConversionTracking::query()->count());
    }

    public function test_authenticated_analytics_supports_date_range_and_trend_payload(): void
    {
        $seller = User::factory()->create(['role' => 'user']);

        $template = LandingTemplate::create([
            'code' => 'analytics_range_template',
            'name_bn' => 'Analytics Range',
            'name_en' => 'Analytics Range',
            'default_schema_json' => ['sections' => []],
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $page = LandingPage::create([
            'user_id' => $seller->id,
            'template_id' => $template->id,
            'title' => 'Analytics Range Landing',
            'slug' => 'analytics-range-landing',
            'status' => 'published',
            'public_url' => '/store/analytics-range-landing',
            'content_json' => ['sections' => []],
        ]);

        $outsideDate = now()->subDays(10)->toDateString();
        $insideDateA = now()->subDays(3)->toDateString();
        $insideDateB = now()->subDay()->toDateString();

        LandingPageAnalyticsDaily::create([
            'landing_page_id' => $page->id,
            'view_date' => $outsideDate,
            'total_views' => 100,
            'unique_visitors' => 90,
            'cta_clicks' => 50,
            'checkout_starts' => 40,
            'order_bumps_accepted' => 10,
            'upsells_accepted' => 8,
            'orders_completed' => 20,
            'revenue' => 20000,
        ]);

        LandingPageAnalyticsDaily::create([
            'landing_page_id' => $page->id,
            'view_date' => $insideDateA,
            'total_views' => 10,
            'unique_visitors' => 9,
            'cta_clicks' => 5,
            'checkout_starts' => 4,
            'order_bumps_accepted' => 1,
            'upsells_accepted' => 1,
            'orders_completed' => 2,
            'revenue' => 2000,
        ]);

        LandingPageAnalyticsDaily::create([
            'landing_page_id' => $page->id,
            'view_date' => $insideDateB,
            'total_views' => 12,
            'unique_visitors' => 11,
            'cta_clicks' => 6,
            'checkout_starts' => 5,
            'order_bumps_accepted' => 2,
            'upsells_accepted' => 1,
            'orders_completed' => 3,
            'revenue' => 3000,
        ]);

        LandingPageConversionTracking::create([
            'landing_page_id' => $page->id,
            'event_type' => 'page_view',
            'session_id' => 'sess-range-1',
            'visitor_id' => 'visitor-range-1',
            'source' => 'facebook',
            'device' => 'mobile',
            'country' => 'BD',
            'tracked_at' => now()->subDays(3),
        ]);

        LandingPageConversionTracking::create([
            'landing_page_id' => $page->id,
            'event_type' => 'checkout_start',
            'session_id' => 'sess-range-2',
            'visitor_id' => 'visitor-range-2',
            'source' => 'google',
            'device' => 'desktop',
            'country' => 'BD',
            'tracked_at' => now()->subDay(),
        ]);

        LandingPageConversionTracking::create([
            'landing_page_id' => $page->id,
            'event_type' => 'order_complete',
            'session_id' => 'sess-range-3',
            'visitor_id' => 'visitor-range-3',
            'source' => 'legacy',
            'device' => 'tablet',
            'country' => 'BD',
            'tracked_at' => now()->subDays(12),
        ]);

        $token = $seller->createToken('test-suite')->plainTextToken;

        $response = $this->getJson('/api/landing/pages/'.$page->id.'/analytics?range=7d', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $response
            ->assertJsonPath('data.range.range', '7d')
            ->assertJsonPath('data.summary.total_views', 22)
            ->assertJsonPath('data.summary.orders_completed', 5)
            ->assertJsonCount(2, 'data.rows')
            ->assertJsonCount(7, 'data.trend');

        $sourceKeys = collect($response->json('data.attribution.sources', []))
            ->pluck('key')
            ->all();

        $this->assertContains('facebook', $sourceKeys);
        $this->assertContains('google', $sourceKeys);
    }
}
