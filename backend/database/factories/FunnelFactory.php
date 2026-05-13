<?php

namespace Database\Factories;

use App\Models\Funnel;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class FunnelFactory extends Factory
{
    protected $model = Funnel::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => $this->faker->words(3, true),
            'slug' => $this->faker->unique()->slug(),
            'status' => 'draft',
            'theme_tokens_json' => [
                'primary_color' => '#007bff',
                'secondary_color' => '#6c757d',
                'accent_color' => '#28a745',
            ],
            'settings_json' => [
                'enable_analytics' => true,
            ],
        ];
    }

    public function published(): Factory
    {
        return $this->state([
            'status' => 'published',
            'published_at' => now(),
        ]);
    }

    public function archived(): Factory
    {
        return $this->state([
            'status' => 'archived',
        ]);
    }
}
