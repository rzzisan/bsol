<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_page_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 180);
            $table->json('theme_settings')->nullable();
            $table->json('content')->nullable();
            $table->json('seo_meta')->nullable();
            $table->text('custom_css')->nullable();
            $table->json('products')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['landing_page_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_revisions');
    }
};
