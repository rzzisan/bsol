<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CareSolution template follow-up (seller_storefront_context.md §24 addendum):
 * per-category thumbnail (Featured Categories grid, falls back to the
 * existing letter-circle when unset) + configurable nav-bar bg/text color
 * for the category row.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_categories', function (Blueprint $table) {
            $table->string('thumbnail_url')->nullable()->after('description');
            $table->string('thumbnail_path')->nullable()->after('thumbnail_url');
        });

        Schema::table('storefront_settings', function (Blueprint $table) {
            $table->string('nav_bg_color', 20)->nullable()->after('theme_primary_color');
            $table->string('nav_text_color', 20)->nullable()->after('nav_bg_color');
        });
    }

    public function down(): void
    {
        Schema::table('product_categories', function (Blueprint $table) {
            $table->dropColumn(['thumbnail_url', 'thumbnail_path']);
        });

        Schema::table('storefront_settings', function (Blueprint $table) {
            $table->dropColumn(['nav_bg_color', 'nav_text_color']);
        });
    }
};
