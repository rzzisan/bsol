<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 16 — allow a seller to connect more than one WooCommerce site.
 * platform_api_keys previously had unique('user_id'), so a second
 * "connect" always overwrote the first row instead of adding one — same
 * problem facebook_page_connections had, same fix (see
 * 2026_08_08_114702_allow_multiple_facebook_page_connections_per_user.php):
 * drop the per-user cap, add a plain index for the now-common "list this
 * seller's connections" query, and add (user_id, domain) uniqueness so
 * reconnecting the same domain updates its existing row instead of
 * creating a duplicate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_api_keys', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
            $table->index('user_id');
            $table->unique(['user_id', 'domain']);
        });
    }

    public function down(): void
    {
        Schema::table('platform_api_keys', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'domain']);
            $table->dropIndex(['user_id']);
            $table->unique('user_id');
        });
    }
};
