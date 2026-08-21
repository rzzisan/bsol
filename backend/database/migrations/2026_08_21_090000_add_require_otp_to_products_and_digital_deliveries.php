<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Makes the hosted_file OTP anti-piracy gate (digital_product_context.md §7,
 * §0ক-4) seller-configurable instead of mandatory — a seller whose SMS
 * gateway isn't set up (or who doesn't want the extra step) can turn it off.
 * Defaults to true (the original, more conservative behavior) for both new
 * products and any already-created pending deliveries.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('digital_require_otp')->default(true)->after('digital_delivery_channels');
        });

        Schema::table('digital_deliveries', function (Blueprint $table) {
            // Snapshotted at delivery-creation time (like max_downloads/
            // expires_at already are) so a later seller toggle doesn't
            // retroactively change an in-flight delivery's rules.
            $table->boolean('requires_otp')->default(true)->after('delivery_type');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('digital_require_otp');
        });

        Schema::table('digital_deliveries', function (Blueprint $table) {
            $table->dropColumn('requires_otp');
        });
    }
};
