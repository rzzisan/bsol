<?php

namespace Tests\Feature;

use App\Models\ProductCategory;
use App\Models\StorefrontSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * S0 (homepage_mode) + S5 (banner/partner-logo/about-image uploads) of
 * seller_storefront_context.md — Settings → Storefront, Pattern B owner-only.
 */
class StorefrontSettingTest extends TestCase
{
    use RefreshDatabase;

    /**
     * NOT Storage::fake('public') — this environment has a stale
     * root-owned directory under storage/framework/testing/disks/public
     * (the same pre-existing issue baseline-documented for
     * ProductMediaApiTest) that Storage::fake()'s cleanup step can't
     * delete. Pointing the 'public' disk at a fresh, uniquely-named
     * scratch directory sidesteps it without touching that directory at
     * all, while still exercising the real disk driver.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $root = storage_path('framework/testing/disks/public-storefront-' . uniqid());
        config(['filesystems.disks.public.root' => $root]);
        (new \Illuminate\Filesystem\Filesystem())->makeDirectory($root, 0755, true);
    }

    private function owner(): User
    {
        return User::factory()->create();
    }

    public function test_owner_can_update_theme_and_policy_text(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/storefront-settings', [
            'homepage_mode' => 'storefront',
            'theme_primary_color' => '#ff6600',
            'about_text' => 'We sell fresh oil.',
            'warranty_policy_text' => '1 year warranty.',
            'delivery_policy_text' => '48-72h delivery.',
            'whatsapp_number' => '01711223344',
            'show_call_button' => true,
            'show_whatsapp_button' => true,
            'show_messenger_button' => false,
        ])->assertOk()
            ->assertJsonPath('data.theme_primary_color', '#ff6600')
            ->assertJsonPath('data.about_text', 'We sell fresh oil.')
            ->assertJsonPath('data.show_messenger_button', false);
    }

    public function test_banner_upload_and_remove(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $upload = $this->postJson('/api/storefront-settings/banners', [
            'image' => UploadedFile::fake()->image('banner.jpg'),
            'link_url' => 'https://example.com/sale',
        ])->assertOk();

        $banners = $upload->json('data.banner_images');
        $this->assertCount(1, $banners);
        $this->assertSame('https://example.com/sale', $banners[0]['link_url']);

        $settings = StorefrontSetting::where('user_id', $owner->id)->first();
        $this->assertTrue(Storage::disk('public')->exists($settings->banner_images[0]['image_path']));

        $removed = $this->deleteJson('/api/storefront-settings/banners/0')->assertOk();
        $this->assertCount(0, $removed->json('data.banner_images'));
    }

    public function test_banner_accepts_a_relative_product_link(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $upload = $this->postJson('/api/storefront-settings/banners', [
            'image' => UploadedFile::fake()->image('banner.jpg'),
            'link_url' => '/product/some-product',
        ])->assertOk();

        $this->assertSame('/product/some-product', $upload->json('data.banner_images.0.link_url'));
    }

    public function test_banner_rejects_a_malformed_link(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $this->postJson('/api/storefront-settings/banners', [
            'image' => UploadedFile::fake()->image('banner.jpg'),
            'link_url' => 'not a url and not relative',
        ])->assertStatus(422);
    }

    public function test_partner_logo_upload_and_remove(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $this->postJson('/api/storefront-settings/partner-logos', [
            'image' => UploadedFile::fake()->image('brand.png'),
        ])->assertOk()->assertJsonCount(1, 'data.partner_logos');

        $this->deleteJson('/api/storefront-settings/partner-logos/0')
            ->assertOk()->assertJsonCount(0, 'data.partner_logos');
    }

    public function test_about_image_upload_replace_and_remove_deletes_old_file(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $first = $this->postJson('/api/storefront-settings/about-image', [
            'image' => UploadedFile::fake()->image('about1.jpg'),
        ])->assertOk();

        $settings = StorefrontSetting::where('user_id', $owner->id)->first();
        $firstPath = $settings->about_image_path;
        $this->assertTrue(Storage::disk('public')->exists($firstPath));

        // Replacing deletes the old file, not just overwrites the DB row.
        $this->postJson('/api/storefront-settings/about-image', [
            'image' => UploadedFile::fake()->image('about2.jpg'),
        ])->assertOk();
        $this->assertFalse(Storage::disk('public')->exists($firstPath));

        $this->deleteJson('/api/storefront-settings/about-image')
            ->assertOk()
            ->assertJsonPath('data.about_image_url', null);
    }

    public function test_generic_update_does_not_accept_banner_images_or_about_image_url(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $this->postJson('/api/storefront-settings/banners', [
            'image' => UploadedFile::fake()->image('banner.jpg'),
        ]);

        // A naive round-trip (GET data, PUT it back) must not silently
        // desync image_path — banner_images/about_image_url simply aren't
        // validated fields on update(), so they pass through untouched.
        $res = $this->putJson('/api/storefront-settings', [
            'homepage_mode' => 'storefront',
            'banner_images' => [],
            'about_image_url' => 'https://evil.example.com/x.jpg',
        ])->assertOk();

        $this->assertCount(1, $res->json('data.banner_images'));
        $this->assertNull($res->json('data.about_image_url'));
    }

    public function test_landing_page_homepage_mode_requires_a_published_page_owned_by_the_shop(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/storefront-settings', [
            'homepage_mode' => 'landing_page',
        ])->assertStatus(422);

        $draft = \App\Models\LandingPage::create([
            'user_id' => $owner->id,
            'title' => 'Draft',
            'slug' => 'draft',
            'status' => 'draft',
            'content' => [],
        ]);

        $this->putJson('/api/storefront-settings', [
            'homepage_mode' => 'landing_page',
            'homepage_landing_page_id' => $draft->id,
        ])->assertStatus(422);

        $published = \App\Models\LandingPage::create([
            'user_id' => $owner->id,
            'title' => 'Live',
            'slug' => 'live',
            'status' => 'published',
            'published_at' => now(),
            'content' => [],
        ]);

        $this->putJson('/api/storefront-settings', [
            'homepage_mode' => 'landing_page',
            'homepage_landing_page_id' => $published->id,
        ])->assertOk()->assertJsonPath('data.homepage_landing_page_id', $published->id);
    }

    public function test_owner_can_set_theme_template_and_shipping_charges(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/storefront-settings', [
            'homepage_mode' => 'storefront',
            'theme_template' => 'caresolution',
            'shipping_charge_inside_dhaka' => 80,
            'shipping_charge_outside_dhaka' => 150,
        ])->assertOk()
            ->assertJsonPath('data.theme_template', 'caresolution')
            ->assertJsonPath('data.shipping_charge_inside_dhaka', '80.00')
            ->assertJsonPath('data.shipping_charge_outside_dhaka', '150.00');
    }

    public function test_owner_can_set_nav_bar_colors(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/storefront-settings', [
            'homepage_mode' => 'storefront',
            'nav_bg_color' => '#123456',
            'nav_text_color' => '#fedcba',
        ])->assertOk()
            ->assertJsonPath('data.nav_bg_color', '#123456')
            ->assertJsonPath('data.nav_text_color', '#fedcba');
    }

    public function test_theme_template_rejects_unknown_value(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/storefront-settings', [
            'homepage_mode' => 'storefront',
            'theme_template' => 'not-a-real-template',
        ])->assertStatus(422);
    }

    public function test_staff_cannot_manage_storefront_settings(): void
    {
        $owner = $this->owner();
        $staff = User::factory()->create(['owner_id' => $owner->id]);
        Sanctum::actingAs($staff);

        $this->getJson('/api/storefront-settings')->assertStatus(403);
    }
}
