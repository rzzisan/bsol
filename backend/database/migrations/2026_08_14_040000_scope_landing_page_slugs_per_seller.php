<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Landing pages move to per-seller subdomains, so a slug only has to be
 * unique within one shop: two sellers may both have /offer because they are
 * on different hosts (custom_domain_context.md §11.9, decided 2026-08-14).
 *
 * legacy_slug preserves the old platform-domain URL. Every page that exists
 * today is reachable at bsol.<apex>/lp/{slug}, and those links are live —
 * at the time of writing the published pages carry 212 visits and 23 real
 * orders between them, so they cannot be allowed to 404. The column is
 * backfilled once, stays globally unique, and is never written again: new
 * pages live only on their seller's subdomain, which keeps /lp/{slug}
 * unambiguous forever without constraining new slugs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->string('legacy_slug', 200)->nullable()->unique()->after('slug');
        });

        // Every existing slug is globally unique (the constraint dropped
        // below guaranteed it), so this backfill cannot collide.
        DB::statement('UPDATE landing_pages SET legacy_slug = slug');

        Schema::table('landing_pages', function (Blueprint $table) {
            $table->dropUnique('landing_pages_slug_unique');
            $table->unique(['user_id', 'slug']);
        });
    }

    public function down(): void
    {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'slug']);
        });

        // Only restorable while slugs are still globally unique; if two
        // sellers have taken the same slug since, this will fail loudly
        // rather than silently drop one of them.
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->unique('slug');
            $table->dropUnique(['legacy_slug']);
            $table->dropColumn('legacy_slug');
        });
    }
};
