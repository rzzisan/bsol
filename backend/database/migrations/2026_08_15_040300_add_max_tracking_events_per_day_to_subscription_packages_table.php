<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-package daily tracking event limit (tracking_capi_context.md §4.5) —
 * the same shape as max_orders / max_staff.
 *
 * Nullable with no default so every existing package keeps behaving as
 * unlimited until an admin sets a real number; 0 means tracking is off on
 * that package. Values live here rather than in code precisely so they can
 * be tuned from the admin packages UI once real traffic shows what the
 * tiers should be.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->unsignedInteger('max_tracking_events_per_day')->nullable()->after('max_staff');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->dropColumn('max_tracking_events_per_day');
        });
    }
};
