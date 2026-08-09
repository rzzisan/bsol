<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets the platform switch between bKash's two incompatible API products
 * using the SAME 4 credential fields (app_key/app_secret/username/password)
 * already on this table — they just get pointed at a different base URL /
 * endpoint shape depending on which product bKash actually issued:
 *
 * - "tokenized" — Tokenized Checkout (v1.2.0-beta), tokenized.pay.bka.sh,
 *   full-page redirect flow (BkashPaymentGatewayClient, original §16.4 build)
 * - "pgw"       — classic Checkout API ("PGW"), checkout.pay.bka.sh,
 *   bKash-hosted JS widget flow (BkashPgwPaymentGatewayClient)
 *
 * See SAAS_MODULE_CONTEXT.md §18 for the incident that led to this: the
 * business's real merchant credentials turned out to be issued for the old
 * PGW product, not Tokenized Checkout, and the two are not interchangeable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_billing_settings', function (Blueprint $table) {
            $table->string('bkash_api_type')->default('tokenized')->after('bkash_sandbox');
        });
    }

    public function down(): void
    {
        Schema::table('platform_billing_settings', function (Blueprint $table) {
            $table->dropColumn('bkash_api_type');
        });
    }
};
