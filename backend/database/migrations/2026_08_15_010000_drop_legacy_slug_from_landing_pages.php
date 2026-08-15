<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Drops the platform-domain landing-page URL.
 *
 * legacy_slug existed to keep bsol.<apex>/lp/{slug} alive for pages that
 * predated subdomains. Those pages turned out to be test data, and every
 * shop that still has published pages now has its own subdomain, so nothing
 * real depends on the old address — landing pages live only on the seller's
 * own host from here on (custom_domain_context.md §14).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->dropUnique(['legacy_slug']);
            $table->dropColumn('legacy_slug');
        });
    }

    public function down(): void
    {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->string('legacy_slug', 200)->nullable()->unique()->after('slug');
        });

        // Deliberately not repopulated: the old URLs are gone for good, and
        // guessing which slug used to own one would be worse than leaving it
        // empty.
    }
};
