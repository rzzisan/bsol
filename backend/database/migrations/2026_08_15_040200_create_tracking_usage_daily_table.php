<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The durable record of a seller's daily tracking usage
 * (tracking_capi_context.md §4.3). Redis holds the hot counter that the
 * admission decision reads; this table is what the quota meter, the
 * upgrade prompt and any future billing read, so the history survives Redis
 * being flushed or lost.
 *
 * The day boundary is Asia/Dhaka, not UTC — "today's limit" has to mean what
 * the seller's day means (§5.1). TrackingQuotaService owns that conversion;
 * the column is a plain date so nothing here has to know about it.
 *
 * overage_count is separate from accepted_count on purpose (§11.2): P0
 * events (Purchase, OrderDelivered, ...) are never dropped, so they can push
 * a seller past their limit. Folding those into accepted_count would show a
 * meter reading past 100% while nothing was actually being blocked, which
 * reads as a bug. Kept apart, the meter stays honest and the overage is
 * still visible as an upgrade signal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracking_usage_daily', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->unsignedInteger('accepted_count')->default(0); // counted against the quota
            $table->unsignedInteger('dropped_count')->default(0);  // refused because the quota was spent
            $table->unsignedInteger('overage_count')->default(0);  // P0 admitted beyond the limit
            $table->unsignedInteger('sent_count')->default(0);     // Meta accepted it (set from T2)
            $table->unsignedInteger('failed_count')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracking_usage_daily');
    }
};
