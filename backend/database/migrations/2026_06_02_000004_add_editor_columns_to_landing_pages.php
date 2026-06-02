<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('landing_pages', function (Blueprint $table) {
            // Add these columns if they don't exist
            if (!Schema::hasColumn('landing_pages', 'editor_state')) {
                $table->json('editor_state')->nullable()->after('content');
            }
            if (!Schema::hasColumn('landing_pages', 'last_editor_save')) {
                $table->timestamp('last_editor_save')->nullable()->after('published_at');
            }
        });
    }
    
    public function down(): void {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->dropColumn(['editor_state', 'last_editor_save']);
        });
    }
};
