<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sticker Template feature (feature_roadmap_context.md / courier_waybill_context.md
 * §6) — one row per shop owner (Pattern B, owner-only) holding which
 * template prints by default when no per-courier override matches.
 * See sticker_courier_templates for the per-courier overrides.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sticker_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('default_template_key', 50)->default('classic');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sticker_settings');
    }
};
