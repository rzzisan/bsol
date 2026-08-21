<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * S0 of seller_storefront_context.md — one row per shop owner (Pattern B,
 * owner-only, mirrors ShopProfile/DigitalProductSetting). homepage_mode
 * decides what a bare `/` on the seller's subdomain renders: the storefront
 * home, or a landing page the seller picked — see §4/§5.1.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storefront_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();

            $table->string('homepage_mode', 20)->default('storefront'); // storefront | landing_page
            $table->foreignId('homepage_landing_page_id')->nullable()
                ->constrained('landing_pages')->nullOnDelete();

            $table->string('theme_primary_color', 7)->nullable();
            $table->jsonb('banner_images')->nullable();
            $table->jsonb('featured_category_ids')->nullable();
            $table->text('about_text')->nullable();
            $table->string('about_image_url')->nullable();
            $table->jsonb('partner_logos')->nullable();

            $table->string('whatsapp_number')->nullable();
            $table->boolean('show_call_button')->default(true);
            $table->boolean('show_whatsapp_button')->default(true);
            $table->boolean('show_messenger_button')->default(true);

            $table->text('warranty_policy_text')->nullable();
            $table->text('delivery_policy_text')->nullable();

            $table->boolean('is_active')->default(true);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storefront_settings');
    }
};
