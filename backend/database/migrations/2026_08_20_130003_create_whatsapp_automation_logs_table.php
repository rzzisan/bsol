<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Parallels sms_automation_logs, including the same partial-unique-index
 * race-safety pattern (2026_08_02_073219_add_unique_active_claim_index_to_sms_automation_logs.php)
 * baked in from the start here rather than added later. See whatsapp_context.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_automation_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('rule_id')->nullable()->constrained('whatsapp_automation_rules')->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('trigger_event', 60);
            $table->string('customer_phone', 30)->nullable();
            $table->string('template_name', 120)->nullable();
            $table->json('rendered_params')->nullable();
            $table->string('status', 20)->default('queued'); // queued|sent|failed|skipped
            $table->string('error_message', 255)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status', 'created_at']);
            $table->index(['user_id', 'trigger_event']);
            $table->index(['order_id', 'created_at']);
        });

        DB::statement(
            'CREATE UNIQUE INDEX whatsapp_automation_logs_active_claim_unique '
            . 'ON whatsapp_automation_logs (rule_id, order_id, trigger_event) '
            . "WHERE status IN ('queued', 'sent')"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_automation_logs');
    }
};
