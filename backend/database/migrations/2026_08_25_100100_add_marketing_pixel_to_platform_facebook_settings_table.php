<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BSOL's own Pixel/CAPI credentials for its acquisition funnel
 * (platform_marketing_tracking_context.md) — deliberately on this same
 * single-row settings model rather than a new table, same reasoning
 * `facebook_pixel_settings` documents for the per-seller case: a Pixel/CAPI
 * token comes from Meta Events Manager, not the Page-connect OAuth flow
 * app_id/app_secret already stored here, but it's still "the platform's
 * own Meta configuration, admin-editable, env-fallback" — exactly this
 * model's existing job.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_facebook_settings', function (Blueprint $table) {
            $table->string('marketing_pixel_id')->nullable()->after('webhook_verify_token');
            $table->text('marketing_capi_access_token')->nullable()->after('marketing_pixel_id'); // encrypted cast
            $table->string('marketing_test_event_code')->nullable()->after('marketing_capi_access_token');
        });
    }

    public function down(): void
    {
        Schema::table('platform_facebook_settings', function (Blueprint $table) {
            $table->dropColumn(['marketing_pixel_id', 'marketing_capi_access_token', 'marketing_test_event_code']);
        });
    }
};
