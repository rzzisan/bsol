<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Seller-controlled toggles for whether the shop's own mobile number/address
 * are printed on the courier waybill sticker (FROM/sender block) — some
 * sellers don't want their personal number exposed to the recipient.
 * Defaults true to match the sticker's existing behavior for shops that
 * never touch this setting.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shop_profiles', function (Blueprint $table) {
            $table->boolean('show_phone_on_sticker')->default(true)->after('address');
            $table->boolean('show_address_on_sticker')->default(true)->after('show_phone_on_sticker');
        });
    }

    public function down(): void
    {
        Schema::table('shop_profiles', function (Blueprint $table) {
            $table->dropColumn(['show_phone_on_sticker', 'show_address_on_sticker']);
        });
    }
};
