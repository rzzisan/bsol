<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('phone_otp_activity_logs', function (Blueprint $table) {
            $table->id();
            $table->string('mobile', 20);
            $table->string('event_type', 50);
            $table->enum('status', ['sent', 'failed'])->default('sent');
            $table->string('provider', 100)->nullable();
            $table->text('message')->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['mobile', 'created_at']);
            $table->index(['event_type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phone_otp_activity_logs');
    }
};
