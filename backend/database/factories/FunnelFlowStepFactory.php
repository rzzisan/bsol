<?php

namespace Database\Factories;

use App\Models\FunnelFlow;
use App\Models\FunnelFlowStep;
use App\Models\LandingPage;
use Illuminate\Database\Eloquent\Factories\Factory;

class FunnelFlowStepFactory extends Factory
{
    protected $model = FunnelFlowStep::class;

    public function definition(): array
    {
        $stepTypes = ['landing', 'checkout', 'order_bump', 'upsell', 'thank_you'];

        return [
            'funnel_flow_id' => FunnelFlow::factory(),
            'step_type' => $this->faker->randomElement($stepTypes),
            'step_order' => $this->faker->numberBetween(1, 5),
            'landing_page_id' => LandingPage::factory(),
            'slug' => $this->faker->slug(),
            'is_enabled' => true,
            'settings_json' => [
                'auto_forward_on_cta' => false,
            ],
        ];
    }

    public function disabled(): Factory
    {
        return $this->state([
            'is_enabled' => false,
        ]);
    }

    public function landing(): Factory
    {
        return $this->state([
            'step_type' => 'landing',
        ]);
    }

    public function checkout(): Factory
    {
        return $this->state([
            'step_type' => 'checkout',
        ]);
    }

    public function thankYou(): Factory
    {
        return $this->state([
            'step_type' => 'thank_you',
        ]);
    }
}
