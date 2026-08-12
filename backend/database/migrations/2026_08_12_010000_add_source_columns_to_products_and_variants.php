<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * External-reference columns for connector-synced products/variants —
     * mirrors the `source`/`source_ref` pattern already on `orders`
     * (Phase 1). Neither table has one yet; SKU alone isn't a durable key
     * (sellers can rename it, and product_variants.sku is globally unique
     * across the whole install). See bsol_history_and_new_context.md §5.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('source', 30)->nullable()->after('sku');
            $table->string('source_ref', 255)->nullable()->after('source');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->string('source', 30)->nullable()->after('sku');
            $table->string('source_ref', 255)->nullable()->after('source');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['source', 'source_ref']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn(['source', 'source_ref']);
        });
    }
};
