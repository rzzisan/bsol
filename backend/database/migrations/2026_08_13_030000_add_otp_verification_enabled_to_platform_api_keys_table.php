<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-connection toggle for checkout OTP verification on WooCommerce
 * orders — the WooCommerce equivalent of a landing page's own
 * `content.settings.otp_verification_enabled`. See Phase 9 in
 * wordpress_connect_context.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_api_keys', function (Blueprint $table) {
            $table->boolean('otp_verification_enabled')->default(false)->after('webhook_secret');
        });
    }

    public function down(): void
    {
        Schema::table('platform_api_keys', function (Blueprint $table) {
            $table->dropColumn('otp_verification_enabled');
        });
    }
};
