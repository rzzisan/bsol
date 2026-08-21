<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * S5 of seller_storefront_context.md — internal storage path for
 * about_image_url, mirrors ShopProfile.logo_path/logo_url so the file can
 * actually be deleted on replace/remove, not just the DB column cleared.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storefront_settings', function (Blueprint $table) {
            $table->string('about_image_path')->nullable()->after('about_image_url');
        });
    }

    public function down(): void
    {
        Schema::table('storefront_settings', function (Blueprint $table) {
            $table->dropColumn('about_image_path');
        });
    }
};
