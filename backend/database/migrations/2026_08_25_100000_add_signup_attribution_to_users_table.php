<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * First-touch ad-attribution captured at signup — platform_marketing_tracking_context.md.
 * Distinct from tracking_capi_context.md's `tracking_events`/`TrackingDestination`,
 * which is per-seller storefront tracking; this is BSOL's own acquisition
 * funnel (who saw an ad, who registered, who later paid).
 *
 * Written once by OtpController::verifyRegistrationOtp() from the OTP
 * flow's pending_data (never updated afterward — first touch, not last
 * touch) and read back by SubscriptionActivationService::activate() so a
 * payment approved weeks after signup still attributes to the original ad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('signup_utm_source')->nullable()->after('subscription_ends_at');
            $table->string('signup_utm_medium')->nullable()->after('signup_utm_source');
            $table->string('signup_utm_campaign')->nullable()->after('signup_utm_medium');
            $table->string('signup_utm_content')->nullable()->after('signup_utm_campaign');
            $table->string('signup_utm_term')->nullable()->after('signup_utm_content');
            $table->string('signup_fbp')->nullable()->after('signup_utm_term');
            $table->string('signup_fbc')->nullable()->after('signup_fbp');
            $table->string('signup_landing_path')->nullable()->after('signup_fbc');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'signup_utm_source', 'signup_utm_medium', 'signup_utm_campaign',
                'signup_utm_content', 'signup_utm_term', 'signup_fbp', 'signup_fbc',
                'signup_landing_path',
            ]);
        });
    }
};
