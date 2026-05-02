<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('courier_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->string('default_courier', 30)->default('steadfast');
            // Steadfast (Packzy)
            $table->string('steadfast_api_key')->nullable();
            $table->string('steadfast_secret_key')->nullable();
            // Pathao
            $table->string('pathao_client_id')->nullable();
            $table->string('pathao_client_secret')->nullable();
            $table->string('pathao_store_id')->nullable();
            // RedX
            $table->string('redx_api_key')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('courier_settings');
    }
};
