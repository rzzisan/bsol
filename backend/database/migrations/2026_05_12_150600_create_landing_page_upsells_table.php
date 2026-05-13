<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_page_upsells', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->decimal('offer_price', 12, 2);
            $table->enum('type', ['one_click', 'downsell'])->default('one_click');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['landing_page_id', 'product_id'], 'landing_page_upsell_unique');
            $table->index(['landing_page_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_upsells');
    }
};
