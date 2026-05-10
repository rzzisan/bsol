<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_option_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_option_id')->constrained()->cascadeOnDelete();
            $table->string('value', 100);         // "Red", "M", "128GB"
            $table->string('label', 100)->nullable(); // localized display label
            $table->string('color_hex', 7)->nullable();   // "#FF0000" for color swatches
            $table->string('image_url', 500)->nullable(); // for image swatches
            $table->integer('position')->default(0);
            $table->timestamps();

            $table->index(['product_option_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_option_values');
    }
};
