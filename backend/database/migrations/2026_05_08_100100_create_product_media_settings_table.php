<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_media_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('max_gallery_images')->default(8);
            $table->unsignedInteger('max_file_size_mb')->default(2);
            $table->jsonb('allowed_mime_types')->nullable();
            $table->unsignedInteger('min_width')->nullable();
            $table->unsignedInteger('min_height')->nullable();
            $table->unsignedInteger('max_width')->nullable();
            $table->unsignedInteger('max_height')->nullable();
            $table->boolean('thumbnail_required')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_media_settings');
    }
};
