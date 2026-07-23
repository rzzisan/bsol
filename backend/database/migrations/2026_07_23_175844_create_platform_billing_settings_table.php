<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('platform_billing_settings', function (Blueprint $table) {
            $table->id();
            $table->string('bkash_number', 20)->nullable();
            $table->string('bkash_type', 20)->default('Personal');
            $table->timestamps();
        });

        DB::table('platform_billing_settings')->insert([
            'bkash_number' => null,
            'bkash_type' => 'Personal',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('platform_billing_settings');
    }
};
