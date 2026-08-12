<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Guards against double-synced products/variants on a webhook race —
     * partial indexes scoped only to source='woocommerce' rows, same
     * pattern as orders_woocommerce_source_ref_unique (Phase 1). The
     * variant index is scoped by product_id (not user_id) — a WC
     * variation's WP post ID is only meaningful within its own
     * product/site, and product_id already pins it to the right seller.
     */
    public function up(): void
    {
        DB::statement(
            "CREATE UNIQUE INDEX products_woocommerce_source_ref_unique ON products (user_id, source_ref) WHERE source = 'woocommerce'"
        );
        DB::statement(
            "CREATE UNIQUE INDEX product_variants_woocommerce_source_ref_unique ON product_variants (product_id, source_ref) WHERE source = 'woocommerce'"
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS products_woocommerce_source_ref_unique');
        DB::statement('DROP INDEX IF EXISTS product_variants_woocommerce_source_ref_unique');
    }
};
