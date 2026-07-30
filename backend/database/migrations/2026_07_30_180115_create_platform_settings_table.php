<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();

            // Small attribution line shown at the bottom of every merchant's
            // public landing page (we're a SaaS provider, not the seller of
            // record — this plus the terms link is our liability disclaimer).
            $table->string('credit_text_bn', 500)->nullable();
            $table->string('credit_text_en', 500)->nullable();
            $table->string('terms_link_label_bn', 150)->nullable();
            $table->string('terms_link_label_en', 150)->nullable();

            // Public /terms page content.
            $table->string('terms_title_bn', 200)->nullable();
            $table->string('terms_title_en', 200)->nullable();
            $table->json('terms_content_bn')->nullable();
            $table->json('terms_content_en')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
    }
};
