<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bug found while live-verifying Bulk/CSV order import: Order::generateOrderNumber()
 * scopes its sequence per shop (whereIn user_id), but `order_number` carried a
 * GLOBAL unique constraint — so any two different shops' first order of the
 * same calendar day both compute "ORD-{date}-0001" and the second INSERT
 * fails with a 500 (SQLSTATE 23505), independent of bulk import (it hits
 * OrderController::store()/StorefrontOrderService/LandingPageOrderService/
 * ConnectOrderController equally — this is a shared helper).
 *
 * `order_number` is a human-readable per-shop reference (not a public lookup
 * key — that's the separate globally-unique `public_token`), so it only ever
 * needs to be unique within one shop. Same pattern already used for
 * products.slug and landing_pages.slug (both unique(['user_id', 'slug'])) —
 * see 2026_08_14_040000_scope_landing_page_slugs_per_seller.php. Verified
 * safe: every `where('order_number', ...)` in the codebase already sits
 * inside a shop-scoped query (grep-checked), so no cross-shop lookup relies
 * on the global constraint.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique('orders_order_number_unique');
            $table->unique(['user_id', 'order_number']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'order_number']);
            $table->unique('order_number');
        });
    }
};
