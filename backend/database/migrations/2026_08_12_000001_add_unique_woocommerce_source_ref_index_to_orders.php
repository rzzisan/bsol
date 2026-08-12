<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Guards against double-synced orders on a WooCommerce webhook race —
     * scoped to only source='woocommerce' rows, so it never touches existing
     * manual/facebook_inbox orders (many of which share NULL source_ref).
     * See bsol_history_and_new_context.md §5.
     */
    public function up(): void
    {
        DB::statement(
            "CREATE UNIQUE INDEX orders_woocommerce_source_ref_unique ON orders (user_id, source_ref) WHERE source = 'woocommerce'"
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS orders_woocommerce_source_ref_unique');
    }
};
