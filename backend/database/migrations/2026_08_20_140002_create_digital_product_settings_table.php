<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-controlled global policy for hosted digital files — exact clone of
 * product_media_settings' shape/pattern (single "latest active" row, admin
 * writes, sellers only read). See digital_product_context.md §2.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('digital_product_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // Conservative default — this VPS has ~21G free and only local
            // disk (no S3 configured yet). See digital_product_context.md §6.
            $table->unsignedInteger('max_file_size_mb')->default(200);
            $table->jsonb('allowed_extensions')->nullable();
            $table->unsignedInteger('download_link_expiry_hours')->default(168);
            $table->unsignedInteger('max_downloads_per_purchase')->default(5);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('digital_product_settings');
    }
};
