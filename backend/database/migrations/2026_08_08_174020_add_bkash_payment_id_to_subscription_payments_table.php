<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Correlates a bKash Tokenized Checkout "Create Payment" response back to
 * its subscription_payments row when bKash redirects the browser to our
 * public callback (no Sanctum token available on that hop — this id is
 * the only way to find the row). trx_id (existing column) stays null for
 * gateway payments until Execute Payment succeeds, then holds bKash's
 * real transaction id, same as the manual-entry flow.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->string('bkash_payment_id', 60)->nullable()->unique()->after('payment_method');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->dropColumn('bkash_payment_id');
        });
    }
};
