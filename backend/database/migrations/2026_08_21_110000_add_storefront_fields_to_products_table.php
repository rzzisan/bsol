<?php

use App\Models\Product;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * S1 (public catalog) + S2 (product-detail fields) of
 * seller_storefront_context.md, folded into one migration since it's the
 * same table — see §14 "as-built" for the rationale.
 *
 * `slug` powers /product/{slug} (S6). Unlike ProductCategory's app-level-only
 * uniqueness, this gets a real DB constraint (mirrors landing_pages'
 * per-shop unique(user_id, slug), 2026_08_14_040000) since a public URL
 * collision here would silently serve the wrong seller's product.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('slug', 200)->nullable()->after('sku');
            $table->boolean('show_in_storefront')->default(true)->after('digital_require_otp');
            $table->jsonb('features')->nullable()->after('show_in_storefront');
            $table->jsonb('specifications')->nullable()->after('features');
            $table->text('seo_content')->nullable()->after('specifications');
            $table->text('warranty_override')->nullable()->after('seo_content');
            $table->text('delivery_override')->nullable()->after('warranty_override');
            $table->boolean('is_featured')->default(false)->after('delivery_override');
        });

        $this->backfillSlugs();

        Schema::table('products', function (Blueprint $table) {
            $table->unique(['user_id', 'slug']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'slug']);
            $table->dropColumn([
                'slug', 'show_in_storefront', 'features', 'specifications',
                'seo_content', 'warranty_override', 'delivery_override', 'is_featured',
            ]);
        });
    }

    /**
     * Small dataset today (low double digits in production) — a plain PHP
     * loop scoped per shop (owner+staff, same as ProductController's own
     * SKU-uniqueness scoping) is simpler and safer here than a raw-SQL
     * slugify, and mirrors ProductCategoryController::uniqueSlug()'s
     * counter-suffix approach.
     */
    private function backfillSlugs(): void
    {
        Product::withTrashed()->whereNull('slug')->orderBy('id')->each(function (Product $product) {
            $shopUserIds = optional($product->user)->shopUserIds() ?? [$product->user_id];

            $base = Str::slug($product->name) ?: 'product';
            $slug = $base;
            $counter = 1;

            while (
                Product::withTrashed()
                    ->whereIn('user_id', $shopUserIds)
                    ->where('slug', $slug)
                    ->where('id', '!=', $product->id)
                    ->exists()
            ) {
                $counter++;
                $slug = $base . '-' . $counter;
            }

            $product->forceFill(['slug' => $slug])->saveQuietly();
        });
    }
};
