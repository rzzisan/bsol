<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Partial unique index: at most one "claimed or completed" dispatch
        // (queued/sent) may exist per (rule, order, trigger_event). This is
        // what actually closes the race — two concurrent status-change
        // requests for the same order can no longer both pass the
        // "already sent?" check and both send a real SMS, because only one
        // of them can win the insert that claims this slot. 'failed' and
        // 'skipped' rows are deliberately excluded so a legitimate retry
        // after a failure (e.g. insufficient credit at the time) isn't
        // permanently blocked.
        DB::statement(
            'CREATE UNIQUE INDEX sms_automation_logs_active_claim_unique '
            . 'ON sms_automation_logs (rule_id, order_id, trigger_event) '
            . "WHERE status IN ('queued', 'sent')"
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS sms_automation_logs_active_claim_unique');
    }
};
