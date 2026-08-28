<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * AccountingService's three auto-ledger updateOrCreate() calls
     * (onOrderCreated/onOrderDelivered/onCourierChargeUpdated) all key on
     * this exact 5-column shape but had no DB-level uniqueness backing
     * that — a concurrent status change + retry (or a courier-status-sync
     * race, courier_status_sync_context.md) could updateOrCreate() the same
     * logical row twice and end up with two, one stale. Postgres treats
     * NULL as distinct per-row in a unique index, so manual transactions
     * (reference_type/reference_id both null) are unaffected — only
     * order-referencing rows get deduped, which is exactly what
     * AccountingService's key already assumes.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->unique(
                ['user_id', 'reference_type', 'reference_id', 'type', 'category'],
                'transactions_dedup_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropUnique('transactions_dedup_unique');
        });
    }
};
