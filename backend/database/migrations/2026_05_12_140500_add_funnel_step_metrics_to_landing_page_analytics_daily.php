<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landing_page_analytics_daily', function (Blueprint $table) {
            if (! Schema::hasColumn('landing_page_analytics_daily', 'order_bumps_accepted')) {
                $table->unsignedInteger('order_bumps_accepted')->default(0)->after('checkout_starts');
            }

            if (! Schema::hasColumn('landing_page_analytics_daily', 'upsells_accepted')) {
                $table->unsignedInteger('upsells_accepted')->default(0)->after('order_bumps_accepted');
            }
        });
    }

    public function down(): void
    {
        Schema::table('landing_page_analytics_daily', function (Blueprint $table) {
            if (Schema::hasColumn('landing_page_analytics_daily', 'upsells_accepted')) {
                $table->dropColumn('upsells_accepted');
            }

            if (Schema::hasColumn('landing_page_analytics_daily', 'order_bumps_accepted')) {
                $table->dropColumn('order_bumps_accepted');
            }
        });
    }
};
