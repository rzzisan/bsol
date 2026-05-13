<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landing_templates', function (Blueprint $table) {
            $table->string('layout_profile', 120)->nullable()->after('category');
            $table->string('editor_mode', 20)->default('flex')->after('layout_profile');

            $table->index('layout_profile');
            $table->index('editor_mode');
        });

        Schema::table('landing_pages', function (Blueprint $table) {
            $table->string('renderer_version', 60)->nullable()->after('content_json');
            $table->json('validation_snapshot_json')->nullable()->after('renderer_version');
        });
    }

    public function down(): void
    {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->dropColumn(['renderer_version', 'validation_snapshot_json']);
        });

        Schema::table('landing_templates', function (Blueprint $table) {
            $table->dropIndex(['layout_profile']);
            $table->dropIndex(['editor_mode']);
            $table->dropColumn(['layout_profile', 'editor_mode']);
        });
    }
};
