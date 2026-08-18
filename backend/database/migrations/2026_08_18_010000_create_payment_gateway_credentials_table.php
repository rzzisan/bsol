<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase B/C — per-seller merchant-gateway credentials (SSLCommerz, AamarPay,
 * ZiniPay, ShurjoPay, EPS, bKash Merchant, Nagad Merchant). A normalized
 * one-row-per-provider table instead of more {provider}_* columns bolted
 * onto payment_gateway_settings — each provider's credential shape is too
 * different (store_id+password vs a single API key vs an RSA keypair) for
 * a fixed column set to stay sane across seven providers. See
 * online_payment_context.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_gateway_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 30); // sslcommerz | aamarpay | zinipay | shurjopay | eps | bkash_merchant | nagad_merchant
            $table->boolean('enabled')->default(false);
            $table->boolean('is_live')->default(false);
            $table->text('credentials')->nullable(); // encrypted:array cast — provider-specific JSON blob
            $table->timestamps();

            $table->unique(['user_id', 'provider']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_gateway_credentials');
    }
};
