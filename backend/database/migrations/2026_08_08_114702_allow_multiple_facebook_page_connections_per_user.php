<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Facebook §6 item 1 — allow a seller to connect more than one Facebook
 * Page. facebook_page_connections previously had unique('user_id'), so a
 * second "Connect Page" always overwrote the first row instead of adding
 * one. fb_page_id stays globally unique (a Page can only ever belong to
 * one BSOL seller), so this just drops the per-user cap and adds a plain
 * index for the now-common "list this seller's connections" query.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('facebook_page_connections', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('facebook_page_connections', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
            $table->unique('user_id');
        });
    }
};
