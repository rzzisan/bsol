<?php

namespace Tests\Feature;

use App\Models\Funnel;
use App\Models\FunnelFlow;
use App\Models\FunnelFlowStep;
use App\Models\LandingPage;
use App\Models\LandingPageBlock;
use App\Models\LandingPageOrderBump;
use App\Models\LandingPageStep;
use App\Models\LandingPageUpsell;
use App\Models\LandingPageConversionTracking;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FunnelModuleTest extends TestCase
{
    use RefreshDatabase;

    protected User $seller;
    protected Funnel $funnel;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seller = User::factory()->create(['role' => 'seller']);
        $this->product = Product::factory()->create(['user_id' => $this->seller->id]);
        $this->funnel = Funnel::factory()
            ->for($this->seller, 'user')
            ->create();
    }

    public function test_funnel_can_be_created(): void
    {
        $this->assertDatabaseHas('funnels', [
            'id' => $this->funnel->id,
            'user_id' => $this->seller->id,
            'status' => 'draft',
        ]);
    }

    public function test_funnel_has_required_fields(): void
    {
        $this->assertNotNull($this->funnel->name);
        $this->assertNotNull($this->funnel->slug);
        $this->assertIsArray($this->funnel->theme_tokens_json);
        $this->assertIsArray($this->funnel->settings_json);
    }

    public function test_funnel_belongs_to_user(): void
    {
        $this->assertTrue($this->funnel->user()->exists());
        $this->assertEquals($this->seller->id, $this->funnel->user->id);
    }

    public function test_funnel_can_have_flows(): void
    {
        $flow = FunnelFlow::factory()
            ->for($this->funnel)
            ->create();

        $this->assertTrue($this->funnel->flows()->exists());
        $this->assertEquals(1, $this->funnel->flows()->count());
        $this->assertEquals($flow->id, $this->funnel->flows()->first()->id);
    }

    public function test_funnel_flow_has_steps(): void
    {
        $flow = FunnelFlow::factory()
            ->for($this->funnel)
            ->create();

        $step = FunnelFlowStep::factory()
            ->for($flow, 'funnelFlow')
            ->create();

        $this->assertTrue($flow->steps()->exists());
        $this->assertEquals(1, $flow->steps()->count());
        $this->assertEquals($step->id, $flow->steps()->first()->id);
    }

    public function test_funnel_flow_step_types_are_validated(): void
    {
        $flow = FunnelFlow::factory()
            ->for($this->funnel)
            ->create();

        $validTypes = ['landing', 'checkout', 'order_bump', 'upsell', 'thank_you'];

        foreach ($validTypes as $index => $type) {
            $step = FunnelFlowStep::create([
                'funnel_flow_id' => $flow->id,
                'step_type' => $type,
                'step_order' => $index + 1,
                'is_enabled' => true,
            ]);

            $this->assertDatabaseHas('funnel_flow_steps', [
                'id' => $step->id,
                'step_type' => $type,
            ]);
        }
    }

    public function test_landing_page_can_have_blocks(): void
    {
        $landingPage = LandingPage::factory()
            ->for($this->seller, 'user')
            ->create();

        $block = LandingPageBlock::create([
            'landing_page_id' => $landingPage->id,
            'block_key' => 'hero-section-1',
            'block_type' => 'hero',
            'sort_order' => 1,
            'settings_json' => ['title' => 'Welcome'],
        ]);

        $this->assertTrue($landingPage->blocks()->exists());
        $this->assertEquals(1, $landingPage->blocks()->count());
        $this->assertEquals($block->id, $landingPage->blocks()->first()->id);
    }

    public function test_landing_page_blocks_support_nesting(): void
    {
        $landingPage = LandingPage::factory()
            ->for($this->seller, 'user')
            ->create();

        $parentBlock = LandingPageBlock::create([
            'landing_page_id' => $landingPage->id,
            'block_key' => 'section-1',
            'block_type' => 'section',
            'sort_order' => 1,
        ]);

        $childBlock = LandingPageBlock::create([
            'landing_page_id' => $landingPage->id,
            'block_key' => 'child-1',
            'block_type' => 'text',
            'parent_block_id' => $parentBlock->id,
            'sort_order' => 1,
        ]);

        $this->assertTrue($parentBlock->childBlocks()->exists());
        $this->assertEquals(1, $parentBlock->childBlocks()->count());
        $this->assertEquals($childBlock->id, $parentBlock->childBlocks()->first()->id);
    }

    public function test_landing_page_can_have_steps(): void
    {
        $landingPage = LandingPage::factory()
            ->for($this->seller, 'user')
            ->create();

        $step = LandingPageStep::create([
            'landing_page_id' => $landingPage->id,
            'step_type' => 'landing',
            'step_order' => 1,
        ]);

        $this->assertTrue($landingPage->steps()->exists());
        $this->assertEquals(1, $landingPage->steps()->count());
        $this->assertEquals($step->id, $landingPage->steps()->first()->id);
    }

    public function test_landing_page_can_have_order_bumps(): void
    {
        $landingPage = LandingPage::factory()
            ->for($this->seller, 'user')
            ->create();

        $bump = LandingPageOrderBump::create([
            'landing_page_id' => $landingPage->id,
            'product_id' => $this->product->id,
            'title' => 'Special Add-on',
            'bump_price' => 299.99,
            'is_active' => true,
        ]);

        $this->assertTrue($landingPage->orderBumps()->exists());
        $this->assertEquals(1, $landingPage->orderBumps()->count());
        $this->assertEquals($bump->id, $landingPage->orderBumps()->first()->id);
    }

    public function test_landing_page_can_have_upsells(): void
    {
        $landingPage = LandingPage::factory()
            ->for($this->seller, 'user')
            ->create();

        $upsell = LandingPageUpsell::create([
            'landing_page_id' => $landingPage->id,
            'product_id' => $this->product->id,
            'title' => 'Premium Bundle',
            'offer_price' => 599.99,
            'type' => 'one_click',
            'is_active' => true,
        ]);

        $this->assertTrue($landingPage->upsells()->exists());
        $this->assertEquals(1, $landingPage->upsells()->count());
        $this->assertEquals($upsell->id, $landingPage->upsells()->first()->id);
    }

    public function test_landing_page_can_track_conversions(): void
    {
        $landingPage = LandingPage::factory()
            ->for($this->seller, 'user')
            ->create();

        $tracking = LandingPageConversionTracking::create([
            'landing_page_id' => $landingPage->id,
            'event_type' => 'page_view',
            'session_id' => 'sess-12345',
            'visitor_id' => 'visitor-12345',
            'source' => 'organic',
            'device' => 'mobile',
            'tracked_at' => now(),
        ]);

        $this->assertTrue($landingPage->conversionTracking()->exists());
        $this->assertEquals(1, $landingPage->conversionTracking()->count());
        $this->assertEquals($tracking->id, $landingPage->conversionTracking()->first()->id);
    }

    public function test_conversion_tracking_event_types_are_valid(): void
    {
        $landingPage = LandingPage::factory()
            ->for($this->seller, 'user')
            ->create();

        $validEvents = [
            'page_view',
            'cta_click',
            'checkout_start',
            'order_bump_view',
            'order_bump_accept',
            'upsell_view',
            'upsell_accept',
            'thank_you_view',
            'order_complete',
        ];

        foreach ($validEvents as $event) {
            $tracking = LandingPageConversionTracking::create([
                'landing_page_id' => $landingPage->id,
                'event_type' => $event,
                'tracked_at' => now(),
            ]);

            $this->assertDatabaseHas('landing_page_conversion_tracking', [
                'id' => $tracking->id,
                'event_type' => $event,
            ]);
        }
    }

    public function test_order_bumps_only_show_active_items(): void
    {
        $landingPage = LandingPage::factory()
            ->for($this->seller, 'user')
            ->create();

        $product2 = Product::factory()->create(['user_id' => $this->seller->id]);

        $activeBump = LandingPageOrderBump::create([
            'landing_page_id' => $landingPage->id,
            'product_id' => $this->product->id,
            'title' => 'Active Bump',
            'bump_price' => 199.99,
            'is_active' => true,
        ]);

        $inactiveBump = LandingPageOrderBump::create([
            'landing_page_id' => $landingPage->id,
            'product_id' => $product2->id,
            'title' => 'Inactive Bump',
            'bump_price' => 199.99,
            'is_active' => false,
        ]);

        $this->assertEquals(1, $landingPage->orderBumps()->count());
        $this->assertEquals($activeBump->id, $landingPage->orderBumps()->first()->id);
    }

    public function test_funnel_slug_is_unique(): void
    {
        $funnel1 = Funnel::factory()
            ->for($this->seller, 'user')
            ->create(['slug' => 'unique-funnel']);

        $this->assertDatabaseHas('funnels', ['slug' => 'unique-funnel']);

        // Trying to create another with same slug should fail
        $this->expectException(\Illuminate\Database\QueryException::class);
        Funnel::create([
            'user_id' => $this->seller->id,
            'name' => 'Another Funnel',
            'slug' => 'unique-funnel',
            'status' => 'draft',
        ]);
    }

    public function test_block_key_is_unique_per_page(): void
    {
        $landingPage = LandingPage::factory()
            ->for($this->seller, 'user')
            ->create();

        LandingPageBlock::create([
            'landing_page_id' => $landingPage->id,
            'block_key' => 'unique-block',
            'block_type' => 'hero',
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);
        LandingPageBlock::create([
            'landing_page_id' => $landingPage->id,
            'block_key' => 'unique-block',
            'block_type' => 'text',
        ]);
    }

    public function test_funnel_relationships_cascade_on_delete(): void
    {
        $funnel = Funnel::factory()
            ->for($this->seller, 'user')
            ->create();

        $flow = FunnelFlow::factory()
            ->for($funnel)
            ->create();

        $step = FunnelFlowStep::factory()
            ->for($flow, 'funnelFlow')
            ->create();

        $funnelId = $funnel->id;
        $flowId = $flow->id;
        $stepId = $step->id;

        $funnel->delete();

        $this->assertDatabaseMissing('funnels', ['id' => $funnelId]);
        $this->assertDatabaseMissing('funnel_flows', ['id' => $flowId]);
        $this->assertDatabaseMissing('funnel_flow_steps', ['id' => $stepId]);
    }
}
