<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Orders placed by customers (landing page / storefront) while the shop
 * owner's subscription is expired are stored but hidden from the seller
 * until renewal — see subscription_billing_context.md §13. NULL = a
 * normal, visible order.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('held_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['held_at']);
            $table->dropColumn('held_at');
        });
    }
};
