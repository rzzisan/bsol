<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BSOL's own acquisition-funnel events (CompleteRegistration, Subscribe) —
 * platform_marketing_tracking_context.md. The single-column analogue of
 * `tracking_events`, at a much smaller scale: no per-destination fan-out
 * (there is exactly one advertiser, the platform itself) and no quota, so
 * this carries only what dedup and debugging actually need.
 *
 * unique(event_id) is the load-bearing part, same reasoning as
 * tracking_events' unique index — event_name is folded into event_id itself
 * here (e.g. "reg_{token}", "sub_{payment_id}") rather than a compound key,
 * since each event_id is already unique to one event type by construction.
 *
 * Raw PII is never stored — user_data_hashed holds sha256 digests only
 * (TrackingUserDataBuilder, reused as-is from the seller-facing pipeline).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_marketing_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_name', 50);
            $table->string('event_id', 100)->unique();
            $table->jsonb('custom_data')->nullable();
            $table->jsonb('user_data_hashed')->nullable();
            $table->string('status', 20)->default('queued'); // queued | sent | failed
            $table->smallInteger('response_code')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['event_name', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_marketing_events');
    }
};
