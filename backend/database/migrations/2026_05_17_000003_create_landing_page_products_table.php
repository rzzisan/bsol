<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_page_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('title_override', 180)->nullable();
            $table->string('subtitle', 220)->nullable();
            $table->string('badge_text', 80)->nullable();
            $table->decimal('price_override', 12, 2)->nullable();
            $table->unsignedInteger('default_qty')->default(1);
            $table->boolean('selected_by_default')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['landing_page_id', 'product_id']);
            $table->index(['landing_page_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_products');
    }
};
