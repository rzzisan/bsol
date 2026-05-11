<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('template_id')->constrained('landing_templates')->restrictOnDelete();
            $table->string('title', 220);
            $table->string('slug', 220)->unique();
            $table->string('status', 20)->default('draft');
            $table->string('public_url')->nullable();
            $table->string('meta_title', 255)->nullable();
            $table->text('meta_description')->nullable();
            $table->json('theme_tokens_json')->nullable();
            $table->json('content_json')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('landing_page_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('custom_title', 255)->nullable();
            $table->decimal('custom_price', 12, 2)->nullable();
            $table->unsignedInteger('default_qty')->default(1);
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('is_featured')->default(false);
            $table->timestamps();

            $table->unique(['landing_page_id', 'product_id'], 'landing_page_product_unique');
        });

        Schema::create('landing_page_analytics_daily', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->date('view_date');
            $table->unsignedInteger('total_views')->default(0);
            $table->unsignedInteger('unique_visitors')->default(0);
            $table->unsignedInteger('cta_clicks')->default(0);
            $table->unsignedInteger('checkout_starts')->default(0);
            $table->unsignedInteger('orders_completed')->default(0);
            $table->decimal('revenue', 14, 2)->default(0);
            $table->timestamps();

            $table->unique(['landing_page_id', 'view_date'], 'landing_page_daily_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_analytics_daily');
        Schema::dropIfExists('landing_page_products');
        Schema::dropIfExists('landing_pages');
    }
};
