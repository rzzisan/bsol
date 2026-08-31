<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platform-wide counterpart to payment_gateway_credentials (per-seller,
 * customer→seller checkout). This table is the admin's own credentials for
 * the SAME 7 providers (SSLCommerz, AamarPay, ZiniPay, ShurjoPay, EPS,
 * bKash Merchant, Nagad Merchant), used to collect seller→platform payments
 * (subscription renewal, SMS credit, order-credit add-on, storefront
 * add-on) — previously bKash-only via PlatformBillingSetting. One row per
 * provider (no user_id — this is a single-tenant admin setting, not
 * per-seller), so `provider` alone is unique. See online_payment_context.md §12.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_payment_gateway_credentials', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 30)->unique();
            $table->boolean('enabled')->default(false);
            $table->boolean('is_live')->default(false);
            $table->text('credentials')->nullable(); // encrypted:array cast, same as payment_gateway_credentials
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_payment_gateway_credentials');
    }
};
