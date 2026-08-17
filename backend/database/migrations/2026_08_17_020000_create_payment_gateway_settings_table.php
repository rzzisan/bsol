<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per seller — customer-facing online payment channels this shop
 * accepts at checkout. Mirrors CourierSetting's shape (one row per user_id,
 * provider-prefixed columns, encrypted casts on secrets). See
 * online_payment_context.md.
 *
 * Phase A (this migration) ships the wallet_manual columns only —
 * bkash/nagad/rocket personal-number send-and-verify, no merchant account
 * needed. The sslcommerz and bkash_gateway prefixed columns are included now
 * (Phase B/C) so a later migration doesn't need to touch this table again;
 * they simply stay unused/disabled until those phases ship their gateway
 * clients.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_gateway_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();

            // Phase A — personal wallet, send & verify.
            $table->boolean('bkash_personal_enabled')->default(false);
            $table->string('bkash_personal_number', 20)->nullable();
            $table->boolean('nagad_personal_enabled')->default(false);
            $table->string('nagad_personal_number', 20)->nullable();
            $table->boolean('rocket_personal_enabled')->default(false);
            $table->string('rocket_personal_number', 20)->nullable();

            // Phase B — SSLCommerz merchant gateway.
            $table->boolean('sslcommerz_enabled')->default(false);
            $table->text('sslcommerz_store_id')->nullable();
            $table->text('sslcommerz_store_password')->nullable();
            $table->boolean('sslcommerz_is_live')->default(false);

            // Phase C — bKash merchant gateway (Tokenized or classic PGW).
            $table->boolean('bkash_gateway_enabled')->default(false);
            $table->string('bkash_gateway_api_type', 20)->nullable(); // tokenized | pgw
            $table->text('bkash_gateway_username')->nullable();
            $table->text('bkash_gateway_password')->nullable();
            $table->text('bkash_gateway_app_key')->nullable();
            $table->text('bkash_gateway_app_secret')->nullable();
            $table->boolean('bkash_gateway_is_live')->default(false);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_gateway_settings');
    }
};
