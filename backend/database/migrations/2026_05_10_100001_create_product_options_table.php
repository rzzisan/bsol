<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);           // "Color", "Size", "Storage"
            $table->string('display_name', 100)->nullable(); // localized label
            $table->enum('type', ['select', 'color_swatch', 'image_swatch', 'text'])->default('select');
            $table->integer('position')->default(0);
            $table->boolean('is_required')->default(true);
            $table->timestamps();

            $table->index(['product_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_options');
    }
};
