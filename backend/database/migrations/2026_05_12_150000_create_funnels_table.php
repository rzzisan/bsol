<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('funnels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 220);
            $table->string('slug', 220)->unique();
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->json('theme_tokens_json')->nullable();
            $table->json('settings_json')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('slug');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('funnels');
    }
};
