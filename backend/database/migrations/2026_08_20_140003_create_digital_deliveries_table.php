<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per digital order-item, created the moment the order transitions
 * to 'confirmed' (i.e. payment actually recorded — either an automated
 * gateway callback or a seller-approved wallet claim, both funnel through
 * OrderStatusService::transition(), see digital_product_context.md §4).
 *
 * Anti-piracy (hosted_file only, digital_product_context.md §7): the link
 * itself carries a long random token, but the first time it's opened the
 * customer must also verify an OTP sent to their own phone/email — so a
 * shared link alone doesn't let a third party download. external_url
 * deliveries skip the OTP step entirely (it's not our file to protect).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('digital_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained('order_items')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();

            $table->string('delivery_type', 20); // 'hosted_file' | 'external_url'
            $table->text('external_url')->nullable();

            $table->string('download_token', 64)->unique();

            // OTP gate — hosted_file only, null/unused for external_url.
            $table->string('otp_code', 10)->nullable();
            $table->string('otp_channel', 10)->nullable(); // 'sms' | 'email'
            $table->timestamp('otp_sent_at')->nullable();
            $table->timestamp('otp_verified_at')->nullable();
            $table->unsignedTinyInteger('otp_attempts')->default(0);
            $table->unsignedTinyInteger('otp_resend_count')->default(0);
            $table->timestamp('otp_next_resend_at')->nullable();
            $table->timestamp('otp_blocked_until')->nullable();

            $table->unsignedInteger('download_count')->default(0);
            $table->unsignedInteger('max_downloads');
            $table->timestamp('expires_at');

            $table->jsonb('delivered_via')->nullable(); // e.g. ['email','sms']
            $table->timestamp('last_downloaded_at')->nullable();
            $table->string('last_download_ip', 45)->nullable();

            $table->string('status', 20)->default('pending'); // pending|delivered|expired|revoked

            $table->timestamps();

            // One delivery row per order item — OrderStatusService can
            // transition through 'confirmed' more than once in edge cases
            // (see DigitalDeliveryService::deliverForOrder), this makes the
            // creation step idempotent via firstOrCreate.
            $table->unique('order_item_id');
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('digital_deliveries');
    }
};
