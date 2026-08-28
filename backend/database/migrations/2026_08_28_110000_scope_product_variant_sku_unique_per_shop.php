<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * product_variants.sku carried a GLOBAL unique constraint — one seller's SKU
 * ("SKU-001") could block every other seller from ever using the same
 * string, even though SKUs are seller-chosen and only ever need to be
 * unique within one shop (pre_launch_polish_context.md §ক). Same class of
 * bug as products/landing_pages.slug and orders.order_number before their
 * own per-shop-scoping fixes.
 *
 * A soft-deleted variant's SKU must still be reusable (app-level validation
 * already does Rule::unique(...)->whereNull('deleted_at') in
 * ProductVariantController) — a plain composite unique(user_id, sku) would
 * regress that, so this uses a partial index exactly like
 * 2026_08_15_030000_scope_users_email_unique_to_live_rows.php did for the
 * identical soft-delete-vs-unique-constraint conflict.
 *
 * product_variants had no user_id of its own (only product_id) — added
 * here, denormalized from products.user_id, so the composite index has
 * something to scope by. Checked production for existing cross-shop SKU
 * collisions before applying (0 found).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('product_id')->constrained()->cascadeOnDelete();
        });

        DB::statement('
            UPDATE product_variants
            SET user_id = products.user_id
            FROM products
            WHERE products.id = product_variants.product_id
        ');

        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable(false)->change();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_sku_unique');
        }
        DB::statement('DROP INDEX IF EXISTS product_variants_sku_unique');
        DB::statement('CREATE UNIQUE INDEX product_variants_user_id_sku_unique ON product_variants (user_id, sku) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS product_variants_user_id_sku_unique');
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE product_variants ADD CONSTRAINT product_variants_sku_unique UNIQUE (sku)');
        } else {
            DB::statement('CREATE UNIQUE INDEX product_variants_sku_unique ON product_variants (sku)');
        }

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
