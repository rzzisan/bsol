<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 16 — tags every WooCommerce-sourced order/product with which
 * connected site it came from. Needed because the previous
 * (user_id, source_ref) uniqueness assumed a seller had at most one
 * WooCommerce site — two real sites both number their own orders/products
 * 1, 2, 3, ... from scratch, so without this a second connected site's
 * data would collide with (and silently overwrite) the first site's.
 *
 * Backfill runs before reindexing, and is unambiguous: at migration time
 * every existing platform_api_keys row is still 1-per-user (the previous
 * migration in this same phase only just lifted that constraint, and no
 * seller could have created a second row before this deploy), so every
 * existing source='woocommerce' row can be safely matched to its seller's
 * sole key.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('platform_api_key_id')->nullable()->after('source_ref')
                ->constrained('platform_api_keys')->nullOnDelete();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('platform_api_key_id')->nullable()->after('source_ref')
                ->constrained('platform_api_keys')->nullOnDelete();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "UPDATE orders o SET platform_api_key_id = pak.id
                 FROM platform_api_keys pak
                 WHERE o.source = 'woocommerce' AND pak.user_id = o.user_id"
            );
            DB::statement(
                "UPDATE products p SET platform_api_key_id = pak.id
                 FROM platform_api_keys pak
                 WHERE p.source = 'woocommerce' AND pak.user_id = p.user_id"
            );
        }

        DB::statement('DROP INDEX IF EXISTS orders_woocommerce_source_ref_unique');
        DB::statement(
            "CREATE UNIQUE INDEX orders_woocommerce_source_ref_unique
             ON orders (user_id, platform_api_key_id, source_ref) WHERE source = 'woocommerce'"
        );

        DB::statement('DROP INDEX IF EXISTS products_woocommerce_source_ref_unique');
        DB::statement(
            "CREATE UNIQUE INDEX products_woocommerce_source_ref_unique
             ON products (user_id, platform_api_key_id, source_ref) WHERE source = 'woocommerce'"
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS orders_woocommerce_source_ref_unique');
        DB::statement(
            "CREATE UNIQUE INDEX orders_woocommerce_source_ref_unique
             ON orders (user_id, source_ref) WHERE source = 'woocommerce'"
        );

        DB::statement('DROP INDEX IF EXISTS products_woocommerce_source_ref_unique');
        DB::statement(
            "CREATE UNIQUE INDEX products_woocommerce_source_ref_unique
             ON products (user_id, source_ref) WHERE source = 'woocommerce'"
        );

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('platform_api_key_id');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('platform_api_key_id');
        });
    }
};
