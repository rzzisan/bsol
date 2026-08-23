<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Distinguishes what an order's quota_consumed_at actually consumed —
 * 'plan' (counts against subscriptionPackage.max_orders) or
 * 'addon_credit' (covered by the order-credit wallet, §9.2-B). Without
 * this, OrderStatusService's monthly-count query couldn't tell the two
 * apart: an addon-covered order must NOT keep counting against the plan's
 * own quota in later months, or add-on credits would be worthless (every
 * order ever covered by a credit would permanently inflate the plan-quota
 * count). Null for an unlimited plan (nothing was actually consumed
 * against anything).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('quota_source', 20)->nullable()->after('quota_consumed_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('quota_source');
        });
    }
};
