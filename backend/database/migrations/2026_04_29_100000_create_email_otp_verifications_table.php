<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_otp_verifications', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->string('email', 255);
            $table->string('otp_code', 10);
            $table->string('verification_token', 64)->unique()->nullable(); // For link-based verification
            $table->string('purpose', 50)->default('registration'); // registration, email_change
            $table->json('pending_data')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->unsignedTinyInteger('resend_count')->default(0);
            $table->timestamp('last_sent_at')->nullable();
            $table->timestamp('next_resend_at')->nullable();
            $table->timestamp('blocked_until')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index('email');
            $table->index(['email', 'blocked_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_otp_verifications');
    }
};
