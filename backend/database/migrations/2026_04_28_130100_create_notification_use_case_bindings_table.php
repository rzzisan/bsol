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
        Schema::create('notification_use_case_bindings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('use_case_key');
            $table->foreignId('sms_template_id')->nullable()->constrained('notification_templates')->nullOnDelete();
            $table->foreignId('email_template_id')->nullable()->constrained('notification_templates')->nullOnDelete();
            $table->enum('priority_channel', ['sms', 'email', 'both'])->default('both');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'use_case_key']);
            $table->index(['user_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notification_use_case_bindings');
    }
};
