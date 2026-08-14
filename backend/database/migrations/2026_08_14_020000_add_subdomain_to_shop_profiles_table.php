<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-seller subdomain (custom_domain_context.md §5.1) — the label only
 * ('zareen'), never the full host, so the apex can change without rewriting
 * every row. Pattern B (owner-only): shop_profiles already has one row per
 * shop owner, so the seller's subdomain naturally belongs here rather than
 * in a table of its own.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shop_profiles', function (Blueprint $table) {
            $table->string('subdomain', 63)->nullable()->unique()->after('user_id');
            $table->string('subdomain_status', 20)->default('none')->after('subdomain');
            $table->timestamp('subdomain_set_at')->nullable()->after('subdomain_status');
        });
    }

    public function down(): void
    {
        Schema::table('shop_profiles', function (Blueprint $table) {
            $table->dropUnique(['subdomain']);
            $table->dropColumn(['subdomain', 'subdomain_status', 'subdomain_set_at']);
        });
    }
};
