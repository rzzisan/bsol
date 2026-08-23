<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Order quota redesign (subscription_billing_context.md §9.2-A) — an order
 * no longer consumes the monthly plan quota at creation (every order can
 * always be placed as 'pending', no limit); it consumes exactly once, the
 * first time it leaves 'pending' for any other status (OrderStatusService::
 * transition() is the single choke point every status-change path already
 * funnels through — manual, bulk, courier sync, WooCommerce sync, payment
 * confirm). Nullable: never set = never left pending, or an unlimited plan
 * (see the service for why it's still stamped there too). No refund on
 * cancel/revert (§9.3 decision #4) — this column is never cleared once set.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('quota_consumed_at')->nullable()->after('status');
            $table->index(['user_id', 'quota_consumed_at']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'quota_consumed_at']);
            $table->dropColumn('quota_consumed_at');
        });
    }
};
