<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('phone_otp_verifications', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->string('mobile', 20);
            $table->string('otp_code', 10);
            $table->string('purpose', 50)->default('registration');
            $table->json('pending_data')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index('mobile');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phone_otp_verifications');
    }
};
