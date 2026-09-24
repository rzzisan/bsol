<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Leads (abandoned checkouts) captured while the shop's subscription is
 * expired are stored but hidden until renewal — same idea as orders.held_at,
 * see subscription_billing_context.md §13. NULL = visible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('abandoned_checkouts', function (Blueprint $table) {
            $table->timestamp('held_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('abandoned_checkouts', function (Blueprint $table) {
            $table->dropIndex(['held_at']);
            $table->dropColumn('held_at');
        });
    }
};
