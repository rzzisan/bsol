<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Single-row settings table, same pattern as platform_facebook_settings —
        // one admin-editable kill switch + cost cap for the whole AI agent.
        Schema::create('platform_ai_support_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_enabled')->default(false);
            $table->string('model')->default('claude-opus-5');
            $table->string('effort')->default('medium'); // low | medium | high | xhigh | max
            $table->unsignedInteger('max_ai_replies_per_day')->nullable();
            $table->unsignedInteger('daily_reply_count')->default(0);
            $table->date('daily_reply_count_reset_at')->nullable();
            $table->text('system_prompt_extra')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_ai_support_settings');
    }
};
