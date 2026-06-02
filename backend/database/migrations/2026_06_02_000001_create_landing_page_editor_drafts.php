<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('landing_page_editor_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            
            // Editor state - GrapesJS components JSON
            $table->longText('components_json')->nullable();
            
            // Editor styles - GrapesJS CSS
            $table->longText('styles_json')->nullable();
            
            // HTML output
            $table->longText('html_output')->nullable();
            
            // CSS output
            $table->longText('css_output')->nullable();
            
            // Metadata
            $table->json('metadata')->nullable();
            $table->timestamp('last_edited_at')->nullable();
            
            $table->timestamps();
            
            // Indexes
            $table->unique(['landing_page_id', 'user_id']);
            $table->index('user_id');
            $table->index('last_edited_at');
        });
    }
    
    public function down(): void {
        Schema::dropIfExists('landing_page_editor_drafts');
    }
};
