<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Landing page limit — subscription_billing_context.md §9.6 step 5
 * (simplified per user's direction, 2026-08-23: package-based total cap,
 * no add-on/auto-unpublish for now — that richer design in §9.2-C is
 * shelved). Same `null = unlimited` convention as max_orders/max_staff/
 * max_tracking_events_per_day (OrderController/StaffController/
 * TrackingQuotaService) — a flat total count cap (draft + published
 * together), checked once at LandingPageController::store(). Existing
 * sellers who already have more pages than a newly-set limit are never
 * retroactively touched — the cap only blocks *new* creation going
 * forward.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->unsignedInteger('max_landing_pages')->nullable()->after('max_orders');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->dropColumn('max_landing_pages');
        });
    }
};
