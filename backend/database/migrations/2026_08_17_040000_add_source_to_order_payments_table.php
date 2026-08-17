<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Distinguishes a seller-typed manual collection entry (default, unchanged
 * behavior) from one created automatically once a customer's online-payment
 * claim/session was verified/completed. CollectionHistoryController's
 * manual branch reads this column instead of a hardcoded 'manual' literal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_payments', function (Blueprint $table) {
            $table->string('source', 20)->default('manual')->after('user_id'); // manual | online_wallet | online_gateway
        });
    }

    public function down(): void
    {
        Schema::table('order_payments', function (Blueprint $table) {
            $table->dropColumn('source');
        });
    }
};
