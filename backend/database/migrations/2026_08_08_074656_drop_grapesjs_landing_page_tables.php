<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// These three tables were built for the old GrapesJS visual editor, which
// was fully removed from the codebase (commits 3adfb12, d5f5858, 2026-07-27).
// The current editor (block-based LandingPageBuilder) never reads/writes
// them — no model, controller, or route references them anymore. Verified
// no incoming FK references before dropping.
// (SAAS_MODULE_CONTEXT.md landing_page_context.md §15/§1)
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('landing_page_editor_drafts');
        Schema::dropIfExists('landing_page_versions');
        Schema::dropIfExists('landing_page_elements');
    }

    public function down(): void
    {
        Schema::create('landing_page_editor_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->longText('components_json')->nullable();
            $table->longText('styles_json')->nullable();
            $table->longText('html_output')->nullable();
            $table->longText('css_output')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('last_edited_at')->nullable();
            $table->timestamps();
            $table->unique(['landing_page_id', 'user_id']);
            $table->index('user_id');
            $table->index('last_edited_at');
        });

        Schema::create('landing_page_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->longText('components_json');
            $table->longText('styles_json');
            $table->string('version_name')->nullable();
            $table->text('change_notes')->nullable();
            $table->timestamps();
            $table->unique(['landing_page_id', 'version_number']);
            $table->index('created_by');
            $table->index('created_at');
        });

        Schema::create('landing_page_elements', function (Blueprint $table) {
            $table->id();
            $table->string('element_key', 100)->unique();
            $table->string('name_en', 180);
            $table->string('name_bn', 180)->nullable();
            $table->text('description')->nullable();
            $table->longText('component_definition');
            $table->json('traits_definition')->nullable();
            $table->string('category', 50);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['category', 'is_active']);
            $table->index('sort_order');
        });
    }
};
