<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('landing_page_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            
            // Version number (auto-increment per page)
            $table->unsignedInteger('version_number');
            
            // Content snapshot
            $table->longText('components_json');
            $table->longText('styles_json');
            
            // Version info
            $table->string('version_name')->nullable();
            $table->text('change_notes')->nullable();
            
            $table->timestamps();
            
            // Indexes
            $table->unique(['landing_page_id', 'version_number']);
            $table->index('created_by');
            $table->index('created_at');
        });
    }
    
    public function down(): void {
        Schema::dropIfExists('landing_page_versions');
    }
};
