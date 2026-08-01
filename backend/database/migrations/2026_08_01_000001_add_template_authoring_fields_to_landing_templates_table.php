<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landing_templates', function (Blueprint $table) {
            $table->json('theme_settings')->nullable()->after('default_content');
            $table->foreignId('source_landing_page_id')->nullable()->after('created_by')
                ->constrained('landing_pages')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('landing_templates', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_landing_page_id');
            $table->dropColumn('theme_settings');
        });
    }
};
