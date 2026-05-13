<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_page_conversion_tracking', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->enum('event_type', ['page_view', 'cta_click', 'checkout_start', 'order_bump_view', 'order_bump_accept', 'upsell_view', 'upsell_accept', 'thank_you_view', 'order_complete'])->default('page_view');
            $table->string('session_id', 120)->nullable();
            $table->string('visitor_id', 120)->nullable();
            $table->string('source', 60)->nullable();
            $table->string('device', 30)->nullable();
            $table->string('country', 2)->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamp('tracked_at');
            $table->timestamps();

            $table->index(['landing_page_id', 'event_type']);
            $table->index('session_id');
            $table->index('tracked_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_conversion_tracking');
    }
};
