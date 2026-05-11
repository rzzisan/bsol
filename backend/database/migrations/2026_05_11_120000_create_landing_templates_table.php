<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_templates', function (Blueprint $table) {
            $table->id();
            $table->string('code', 120)->unique();
            $table->string('name_bn', 180);
            $table->string('name_en', 180);
            $table->text('description_bn')->nullable();
            $table->text('description_en')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->string('category', 60)->default('general');
            $table->json('default_schema_json');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_templates');
    }
};
