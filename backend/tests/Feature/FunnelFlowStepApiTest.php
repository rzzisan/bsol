<?php

namespace Tests\Feature;

use App\Models\Funnel;
use App\Models\FunnelFlow;
use App\Models\FunnelFlowStep;
use App\Models\LandingPage;
use App\Models\LandingTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FunnelFlowStepApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_cannot_create_duplicate_core_step_types(): void
    {
        [$seller, $funnel, $flow, $landingPage1, $landingPage2] = $this->seedBaseFlow();

        $token = $seller->createToken('test-suite')->plainTextToken;

        $this->postJson("/api/funnels/{$funnel->id}/flows/{$flow->id}/steps", [
            'step_type' => 'landing',
            'landing_page_id' => $landingPage2->id,
            'slug' => 'landing-2',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertStatus(422);
    }

    public function test_cannot_add_upsell_without_checkout_step(): void
    {
        $seller = User::factory()->create(['role' => 'seller']);
        $template = LandingTemplate::factory()->create();

        $funnel = Funnel::factory()->create([
            'user_id' => $seller->id,
        ]);

        $flow = FunnelFlow::factory()->create([
            'funnel_id' => $funnel->id,
            'is_active' => true,
        ]);

        $landingPage = LandingPage::factory()->create([
            'user_id' => $seller->id,
            'template_id' => $template->id,
        ]);

        FunnelFlowStep::create([
            'funnel_flow_id' => $flow->id,
            'step_type' => 'landing',
            'step_order' => 1,
            'landing_page_id' => $landingPage->id,
            'slug' => 'landing',
            'is_enabled' => true,
        ]);

        $token = $seller->createToken('test-suite')->plainTextToken;

        $this->postJson("/api/funnels/{$funnel->id}/flows/{$flow->id}/steps", [
            'step_type' => 'upsell',
            'landing_page_id' => $landingPage->id,
            'slug' => 'upsell',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertStatus(422);
    }

    public function test_step_transition_must_reference_same_flow_step(): void
    {
        [$seller, $funnel, $flow, $landingPage1] = $this->seedBaseFlow();

        $token = $seller->createToken('test-suite')->plainTextToken;
        $step = $flow->steps()->first();

        $this->putJson("/api/funnels/{$funnel->id}/flows/{$flow->id}/steps/{$step->id}", [
            'settings_json' => [
                'next_step_on_success' => 999999,
            ],
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertStatus(422);
    }

    public function test_reorder_requires_all_steps_in_payload(): void
    {
        [$seller, $funnel, $flow, $landingPage1, $landingPage2] = $this->seedBaseFlow();

        $checkoutStep = FunnelFlowStep::create([
            'funnel_flow_id' => $flow->id,
            'step_type' => 'checkout',
            'step_order' => 2,
            'landing_page_id' => $landingPage2->id,
            'slug' => 'checkout',
            'is_enabled' => true,
        ]);

        $token = $seller->createToken('test-suite')->plainTextToken;
        $landingStep = $flow->steps()->where('step_type', 'landing')->first();

        $this->putJson("/api/funnels/{$funnel->id}/flows/{$flow->id}/steps/reorder", [
            'steps' => [
                ['id' => $landingStep->id, 'order' => 1],
            ],
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertStatus(422);
    }

    private function seedBaseFlow(): array
    {
        $seller = User::factory()->create(['role' => 'seller']);
        $template = LandingTemplate::factory()->create();

        $funnel = Funnel::factory()->create([
            'user_id' => $seller->id,
        ]);

        $flow = FunnelFlow::factory()->create([
            'funnel_id' => $funnel->id,
            'is_active' => true,
        ]);

        $landingPage1 = LandingPage::factory()->create([
            'user_id' => $seller->id,
            'template_id' => $template->id,
        ]);

        $landingPage2 = LandingPage::factory()->create([
            'user_id' => $seller->id,
            'template_id' => $template->id,
        ]);

        FunnelFlowStep::create([
            'funnel_flow_id' => $flow->id,
            'step_type' => 'landing',
            'step_order' => 1,
            'landing_page_id' => $landingPage1->id,
            'slug' => 'landing',
            'is_enabled' => true,
        ]);

        return [$seller, $funnel, $flow, $landingPage1, $landingPage2];
    }
}
