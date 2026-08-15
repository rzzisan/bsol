<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every tracking event BSOL accepts — ingest log, idempotency guard and
 * audit trail in one table (tracking_capi_context.md §4.2).
 *
 * The unique(user_id, event_name, event_id) index is the load-bearing part.
 * Meta matches a browser event to its server counterpart on
 * event_name + event_id, so a duplicate ingest that slipped through to Meta
 * would be counted twice (§3.2). The index makes a repeat ingest fail at the
 * database rather than relying on every call site to remember to check.
 *
 * Raw PII is never stored — user_data_hashed holds sha256 digests only
 * (TrackingUserDataBuilder produces them). That is a privacy decision and a
 * storage one: this is the table most likely to become the largest in the
 * database, which is also why rows older than 90 days are purged.
 *
 * Rows dropped for quota are deliberately NOT written here. Recording them
 * would fill the table exactly when the point of the quota was to keep the
 * cost down; tracking_usage_daily.dropped_count carries that number instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracking_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Null until the dispatcher fans the event out (§11.1): quota is
            // counted per accepted event, not per destination, so one row
            // carries one ingest regardless of how many pixels receive it.
            $table->foreignId('tracking_destination_id')->nullable()->constrained()->nullOnDelete();
            // Which connected WooCommerce site / landing page / order it came from.
            $table->foreignId('platform_api_key_id')->nullable()->constrained('platform_api_keys')->nullOnDelete();
            $table->foreignId('landing_page_id')->nullable()->constrained('landing_pages')->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();

            $table->string('event_name', 50);
            $table->string('event_id', 100);
            $table->timestamp('event_time');
            $table->string('action_source', 20)->default('website'); // 'website' | 'system_generated'
            $table->text('event_source_url')->nullable();
            $table->jsonb('custom_data')->nullable();
            $table->jsonb('user_data_hashed')->nullable(); // sha256 digests + raw fbp/fbc/ip/ua only
            $table->string('status', 20)->default('queued'); // queued | sent | failed | duplicate
            $table->smallInteger('attempts')->default(0);
            $table->smallInteger('response_code')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'event_name', 'event_id']);
            $table->index(['user_id', 'created_at']); // event log, newest first
            $table->index(['user_id', 'status']);     // retry sweeps + failure counts
            $table->index('order_id');                // order detail shows its own events
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracking_events');
    }
};
