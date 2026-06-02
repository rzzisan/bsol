<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('landing_page_elements', function (Blueprint $table) {
            $table->id();
            $table->string('element_key', 100)->unique();
            $table->string('name_en', 180);
            $table->string('name_bn', 180)->nullable();
            $table->text('description')->nullable();
            
            // Element definition
            $table->longText('component_definition');
            $table->json('traits_definition')->nullable();
            
            // Category
            $table->string('category', 50);
            
            // Status
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            
            $table->timestamps();
            
            // Indexes
            $table->index(['category', 'is_active']);
            $table->index('sort_order');
        });
    }
    
    public function down(): void {
        Schema::dropIfExists('landing_page_elements');
    }
};
