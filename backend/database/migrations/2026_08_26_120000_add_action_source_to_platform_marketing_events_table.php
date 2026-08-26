<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Meta requires `action_source` to be accurate per event, not a hardcoded
 * constant — offline/backend-triggered events (Subscribe, fired from admin
 * approval or a payment webhook with no live browser request behind it)
 * must not claim `website` without the client_user_agent that value
 * requires (developers.facebook.com Conversions API best practices).
 * platform_marketing_tracking_context.md §2.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_marketing_events', function (Blueprint $table) {
            $table->string('action_source', 20)->default('website')->after('event_id');
        });
    }

    public function down(): void
    {
        Schema::table('platform_marketing_events', function (Blueprint $table) {
            $table->dropColumn('action_source');
        });
    }
};
