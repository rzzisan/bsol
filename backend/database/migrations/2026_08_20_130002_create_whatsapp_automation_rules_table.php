<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Parallels sms_automation_rules, but references an already Meta-approved
 * WhatsApp message template by name instead of a free-form template_text
 * — WhatsApp rejects free text sent outside the 24h customer-session
 * window, which order-status automation always is. variable_mapping is
 * an ordered array of our known placeholder keys (same vocabulary
 * SmsAutomationService::renderTemplate() uses) mapped positionally onto
 * the template's {{1}}, {{2}}, ... slots. See whatsapp_context.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_automation_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('trigger_event', 60);
            $table->string('template_name', 120);
            $table->string('language_code', 10)->default('en_US');
            $table->json('variable_mapping')->nullable();
            $table->unsignedInteger('delay_minutes')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'trigger_event']);
            $table->index(['user_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_automation_rules');
    }
};
