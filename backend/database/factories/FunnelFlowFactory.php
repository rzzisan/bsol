<?php

namespace Database\Factories;

use App\Models\Funnel;
use App\Models\FunnelFlow;
use Illuminate\Database\Eloquent\Factories\Factory;

class FunnelFlowFactory extends Factory
{
    protected $model = FunnelFlow::class;

    public function definition(): array
    {
        return [
            'funnel_id' => Funnel::factory(),
            'name' => 'Default Flow v' . $this->faker->numberBetween(1, 5),
            'version' => $this->faker->numberBetween(1, 3),
            'is_active' => true,
        ];
    }

    public function inactive(): Factory
    {
        return $this->state([
            'is_active' => false,
        ]);
    }
}
