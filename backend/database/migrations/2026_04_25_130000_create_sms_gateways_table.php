<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_gateways', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('provider', 60)->default('khudebarta');
            $table->string('endpoint_url')->nullable();
            $table->text('api_key')->nullable();
            $table->text('secret_key')->nullable();
            $table->string('sender_id', 120)->nullable();
            $table->boolean('is_active')->default(false);
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_gateways');
    }
};
