<?php

namespace Database\Factories;

use App\Models\AdminAuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AdminAuditLog> */
class AdminAuditLogFactory extends Factory
{
    protected $model = AdminAuditLog::class;

    public function definition(): array
    {
        return [
            'admin_user_id' => User::factory()->state(['role' => 'admin']),
            'action' => $this->faker->randomElement(['admin.login', 'user.update', 'user.delete', 'package.update']),
            'target_type' => 'User',
            'target_id' => $this->faker->numberBetween(1, 1000),
            'meta' => [],
            'ip_address' => $this->faker->ipv4(),
        ];
    }
}
