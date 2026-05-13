<?php

namespace Database\Factories;

use App\Models\LandingTemplate;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LandingTemplateFactory extends Factory
{
    protected $model = LandingTemplate::class;

    public function definition(): array
    {
        $name = $this->faker->words(2, true);
        return [
            'code' => $this->faker->unique()->slug(),
            'name_bn' => $name,
            'name_en' => $name,
            'description_bn' => $this->faker->sentence(10),
            'description_en' => $this->faker->sentence(10),
            'thumbnail_url' => $this->faker->imageUrl(),
            'category' => $this->faker->randomElement(['education', 'story', 'package', 'general']),
            'default_schema_json' => [
                'sections' => [
                    [
                        'type' => 'hero',
                        'title' => 'Welcome',
                    ],
                ],
            ],
            'is_active' => true,
            'sort_order' => $this->faker->numberBetween(1, 10),
            'created_by' => User::factory(),
        ];
    }

    public function inactive(): Factory
    {
        return $this->state([
            'is_active' => false,
        ]);
    }
}
