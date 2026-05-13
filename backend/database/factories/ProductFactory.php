<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => $this->faker->words(3, true),
            'description' => $this->faker->paragraph(),
            'regular_price' => $this->faker->randomFloat(2, 99, 9999),
            'selling_price' => $this->faker->randomFloat(2, 99, 9999),
            'status' => 'active',
        ];
    }

    public function inactive(): Factory
    {
        return $this->state([
            'status' => 'inactive',
        ]);
    }
}
