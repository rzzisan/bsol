<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\ShopProfile;
use App\Models\SubscriptionPackage;
use App\Models\User;
use App\Support\LandingContentValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LandingContentValidationTest extends TestCase
{
    use RefreshDatabase;

    private LandingPage $page;

    protected function setUp(): void
    {
        parent::setUp();

        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0, 'duration_days' => 30, 'is_active' => true,
        ]);
        $owner = User::factory()->create(['subscription_package_id' => $package->id]);
        ShopProfile::create([
            'user_id' => $owner->id, 'shop_name' => 'Shop', 'phone' => '01711223344',
            'address' => 'Dhaka', 'subdomain' => 'val-' . uniqid(), 'subdomain_status' => 'active',
        ]);
        $this->page = LandingPage::create(['user_id' => $owner->id, 'title' => 'Offer', 'slug' => 'offer', 'status' => 'draft']);
        Sanctum::actingAs($owner);
    }

    private function save(array $content, array $theme = []): \Illuminate\Testing\TestResponse
    {
        return $this->putJson("/api/landing/pages/{$this->page->id}", array_filter([
            'title' => 'Offer',
            'content' => $content,
            'theme_settings' => $theme ?: null,
        ]));
    }

    public function test_a_normal_page_saves(): void
    {
        $this->save([
            'hero' => ['headline' => 'Hi', 'background_image_url' => 'https://cdn.example.com/a.jpg'],
            'button_blocks' => [
                ['id' => 'b1', 'text' => 'Call', 'url' => 'tel:01711223344'],
                ['id' => 'b2', 'text' => 'Go', 'url' => '#checkout', 'block_style' => ['bg_color' => '#ffeecc']],
            ],
            'image_text_blocks' => [['id' => 'i1', 'image_url' => '/storage/landing/x.png', 'cta_url' => 'https://example.com/p']],
            'galleries' => [['id' => 'g1', 'images' => [['url' => 'https://cdn.example.com/1.jpg'], ['url' => '']]]],
            'notice_bar' => ['enabled' => true, 'text' => 'Sale', 'url' => 'mailto:a@b.com', 'bg_color' => '#f00'],
            'layout_order' => [['type' => 'hero', 'id' => 'hero'], ['type' => 'button_blocks', 'id' => 'b1']],
        ], ['primary_color' => '#1f7a6b', 'font_family' => 'Hind Siliguri'])->assertOk();
    }

    public function test_script_links_are_rejected(): void
    {
        $this->save(['button_blocks' => [['id' => 'b1', 'url' => 'javascript:alert(1)']]])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['content.button_blocks.0.url'])
            ->assertJsonPath('errors', fn ($errors) => str_starts_with($errors['content.button_blocks.0.url'][0], 'Button 1:'));

        $this->save(['notice_bar' => ['url' => '//evil.example.com']])->assertJsonValidationErrors(['content.notice_bar.url']);
        $this->save(['image_text_blocks' => [['cta_url' => 'data:text/html,hi']]])->assertJsonValidationErrors(['content.image_text_blocks.0.cta_url']);
    }

    public function test_image_urls_that_could_break_css_are_rejected(): void
    {
        $this->save(['hero' => ['background_image_url' => 'https://x.com/a.jpg) no-repeat; background:url(https://evil']])
            ->assertJsonValidationErrors(['content.hero.background_image_url']);
        $this->save(['carousel_images' => [['images' => [['url' => 'javascript:alert(1)']]]]])
            ->assertJsonValidationErrors(['content.carousel_images.0.images.0.url']);
    }

    public function test_colors_must_be_hex(): void
    {
        $this->save([], ['primary_color' => 'red;} body{display:none'])->assertJsonValidationErrors(['theme_settings.primary_color']);
        $this->save(['features' => [['id' => 'f1', 'block_style' => ['text_color' => 'url(x)']]]])
            ->assertJsonValidationErrors(['content.features.0.block_style.text_color']);
    }

    public function test_block_lists_and_order_must_be_well_formed(): void
    {
        $this->save(['faq' => ['q' => 'not a list']])->assertJsonValidationErrors(['content.faq']);
        $this->save(['faq' => array_fill(0, LandingContentValidator::MAX_ITEMS_PER_BLOCK + 1, ['q' => 'x'])])->assertJsonValidationErrors(['content.faq']);
        $this->save(['layout_order' => [['type' => 'faq']]])->assertJsonValidationErrors(['content.layout_order']);
    }

    public function test_oversized_content_is_rejected(): void
    {
        $this->save(['html_sections' => [['html' => str_repeat('a', LandingContentValidator::MAX_CONTENT_BYTES)]]])
            ->assertJsonValidationErrors(['content']);
    }

    public function test_rejected_save_leaves_the_page_unchanged(): void
    {
        $this->save(['button_blocks' => [['url' => 'javascript:x']]])->assertStatus(422);
        $this->assertNull($this->page->fresh()->content);
    }
}
