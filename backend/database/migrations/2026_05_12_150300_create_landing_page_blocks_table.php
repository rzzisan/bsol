<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_page_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->string('block_key', 120)->unique();
            $table->string('block_type', 60);
            $table->foreignId('parent_block_id')->nullable()->constrained('landing_page_blocks')->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('locked')->default(false);
            $table->json('visibility_rules_json')->nullable();
            $table->json('settings_json')->nullable();
            $table->json('content_json')->nullable();
            $table->timestamps();

            $table->unique(['landing_page_id', 'block_key'], 'landing_page_block_unique');
            $table->index(['landing_page_id', 'parent_block_id']);
            $table->index('block_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_blocks');
    }
};
