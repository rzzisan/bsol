<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Storefront design templates (theme_template) + the real Inside/Outside
 * Dhaka shipping-charge feature the "caresolution" template's cart page
 * needs — see seller_storefront_context.md's theme-templates addendum.
 * shipping_charge_* stay nullable; StorefrontCatalogController::home()
 * applies fallback defaults (70/120) when a seller hasn't set them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storefront_settings', function (Blueprint $table) {
            $table->string('theme_template', 20)->default('standard')->after('homepage_landing_page_id'); // standard | caresolution
            $table->decimal('shipping_charge_inside_dhaka', 10, 2)->nullable()->after('delivery_policy_text');
            $table->decimal('shipping_charge_outside_dhaka', 10, 2)->nullable()->after('shipping_charge_inside_dhaka');
        });
    }

    public function down(): void
    {
        Schema::table('storefront_settings', function (Blueprint $table) {
            $table->dropColumn(['theme_template', 'shipping_charge_inside_dhaka', 'shipping_charge_outside_dhaka']);
        });
    }
};
