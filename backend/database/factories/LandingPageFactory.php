<?php

namespace Database\Factories;

use App\Models\LandingPage;
use App\Models\LandingTemplate;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LandingPageFactory extends Factory
{
    protected $model = LandingPage::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'template_id' => LandingTemplate::factory(),
            'title' => $this->faker->words(4, true),
            'slug' => $this->faker->unique()->slug(),
            'status' => 'draft',
            'public_url' => null,
            'meta_title' => $this->faker->sentence(5),
            'meta_description' => $this->faker->sentence(10),
            'theme_tokens_json' => [
                'primary_color' => '#007bff',
                'font_family' => 'Inter, sans-serif',
            ],
            'content_json' => [
                'sections' => [],
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
