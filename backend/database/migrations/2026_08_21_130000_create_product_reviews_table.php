<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * S7 of seller_storefront_context.md §5.3/§12 — open submission (no order-
 * verification required), moderation gate (is_approved, default false).
 * order_id is a placeholder for a future "Verified Purchase" badge — never
 * auto-populated in S7, always null; see §11 decision #3.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // Denormalized shop owner id (Pattern B-style scoping on a
            // Pattern A resource) so the moderation list/count queries don't
            // need a join through products for every request.
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name', 150);
            $table->string('customer_phone', 20)->nullable();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->boolean('is_approved')->default(false);
            $table->timestamps();

            $table->index(['product_id', 'is_approved']);
            $table->index(['user_id', 'is_approved']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_reviews');
    }
};
