<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registration_settings', function (Blueprint $table) {
            $table->id();
            $table->string('default_user_status', 20)->default('pending');
            $table->foreignId('default_subscription_package_id')
                ->nullable()
                ->constrained('subscription_packages')
                ->nullOnDelete();
            $table->timestamps();
        });

        DB::table('registration_settings')->insert([
            'default_user_status' => 'pending',
            'default_subscription_package_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('registration_settings');
    }
};
