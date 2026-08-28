<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * pre_launch_polish_context.md §ঞ / facebook_integration_context.md §10 —
 * App Review came back partial (5/8 approved, 3 rejected on screencast
 * grounds, resubmission pending on the user's own screen-recording). Until
 * the 3 rejected permissions (pages_manage_metadata/engagement/messaging —
 * the ones lead capture actually needs) are approved, Meta's Development
 * Mode means no seller outside the app's own admin/developer/tester roles
 * can use this feature at all. This flag lets an admin flip on the
 * seller-facing "not fully available yet" notice now, and turn it off the
 * moment approval lands — no redeploy needed either way.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_facebook_settings', function (Blueprint $table) {
            $table->boolean('app_review_approved')->default(false)->after('login_config_id');
        });
    }

    public function down(): void
    {
        Schema::table('platform_facebook_settings', function (Blueprint $table) {
            $table->dropColumn('app_review_approved');
        });
    }
};
