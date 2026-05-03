<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create("pathao_locations", function (Blueprint $table) {
            $table->id();
            $table->string("type", 10);
            $table->unsignedInteger("external_id");
            $table->string("name", 150);
            $table->unsignedInteger("parent_id")->nullable();
            $table->timestamp("cached_at")->useCurrent();

            $table->unique(["type", "external_id"]);
            $table->index(["type", "parent_id"]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists("pathao_locations");
    }
};