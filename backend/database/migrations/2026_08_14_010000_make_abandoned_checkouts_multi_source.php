<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 17 — abandoned_checkouts was landing-page-only (landing_page_id
 * NOT NULL). Widens it to also carry WooCommerce-sourced rows, tagged with
 * which connected site they came from (platform_api_key_id, same shape as
 * orders.platform_api_key_id / products.platform_api_key_id from Phase 16).
 * Existing landing-page rows are untouched — source defaults to
 * 'landing_page' and landing_page_id stays populated for all of them.
 */
return new class extends Migration
{
    public function up(): void
    {
        // doctrine/dbal isn't installed in this project, so Blueprint::change()
        // isn't available — raw ALTER for the nullability flip, matching the
        // convention already used for courier_settings' column-type widening.
        DB::statement('ALTER TABLE abandoned_checkouts ALTER COLUMN landing_page_id DROP NOT NULL');

        Schema::table('abandoned_checkouts', function (Blueprint $table) {
            $table->string('source', 20)->default('landing_page')->after('landing_page_id');
            $table->foreignId('platform_api_key_id')->nullable()->after('source')
                ->constrained('platform_api_keys')->nullOnDelete();
        });

        // Every existing row is a landing-page row already (this table had
        // no other source until now) — explicit for clarity, matches the
        // column default.
        DB::table('abandoned_checkouts')->update(['source' => 'landing_page']);

        // landing_page_id is NULL for every WooCommerce row, so the existing
        // unique(['landing_page_id','session_token']) never engages for them
        // (Postgres treats each NULL as distinct) — this partial index is
        // the WooCommerce-side equivalent, scoped by site instead.
        DB::statement(
            "CREATE UNIQUE INDEX abandoned_checkouts_woocommerce_session_unique
             ON abandoned_checkouts (platform_api_key_id, session_token) WHERE source = 'woocommerce'"
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS abandoned_checkouts_woocommerce_session_unique');

        Schema::table('abandoned_checkouts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('platform_api_key_id');
            $table->dropColumn('source');
        });

        DB::statement('ALTER TABLE abandoned_checkouts ALTER COLUMN landing_page_id SET NOT NULL');
    }
};
