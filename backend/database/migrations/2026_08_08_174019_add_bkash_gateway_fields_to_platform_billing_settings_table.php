<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * bKash Payment Gateway (Tokenized Checkout) merchant credentials — §16.4
 * in SAAS_MODULE_CONTEXT.md. Same singleton row as the manual bKash-number
 * instructions (platform_billing_settings), same DB→env resolution pattern
 * as PlatformFacebookSetting. Credentials are the platform's own bKash
 * merchant account (not per-seller) — this automates *our* subscription
 * billing, not customer checkout on sellers' landing pages.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_billing_settings', function (Blueprint $table) {
            $table->string('bkash_app_key')->nullable();
            $table->text('bkash_app_secret')->nullable(); // encrypted cast
            $table->string('bkash_username')->nullable();
            $table->text('bkash_password')->nullable(); // encrypted cast
            $table->boolean('bkash_sandbox')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('platform_billing_settings', function (Blueprint $table) {
            $table->dropColumn(['bkash_app_key', 'bkash_app_secret', 'bkash_username', 'bkash_password', 'bkash_sandbox']);
        });
    }
};
