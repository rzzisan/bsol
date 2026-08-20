<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Auto-recharge settings live directly on the wallet row (sms_credits is
 * already exactly one row per user, App\Models\SmsCredit::walletFor()) —
 * no separate settings table needed. See auto_top_up_context.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sms_credits', function (Blueprint $table) {
            $table->boolean('auto_recharge_enabled')->default(false)->after('balance');
            $table->unsignedInteger('auto_recharge_threshold')->default(0)->after('auto_recharge_enabled');
            $table->unsignedInteger('auto_recharge_credits')->default(0)->after('auto_recharge_threshold')
                ->comment('How many credits to buy per auto top-up');
            $table->unsignedTinyInteger('auto_recharge_failure_count')->default(0)->after('auto_recharge_credits');
            $table->timestamp('auto_recharge_last_attempted_at')->nullable()->after('auto_recharge_failure_count');
        });
    }

    public function down(): void
    {
        Schema::table('sms_credits', function (Blueprint $table) {
            $table->dropColumn([
                'auto_recharge_enabled',
                'auto_recharge_threshold',
                'auto_recharge_credits',
                'auto_recharge_failure_count',
                'auto_recharge_last_attempted_at',
            ]);
        });
    }
};
