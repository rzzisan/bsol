<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Onboarding "Getting Started" checklist (production_audit_report_context.md
 * P1 / onboarding_checklist_context.md) — both columns are optional metadata,
 * no backfill needed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Demo products seeded by the getting-started checklist so a new
            // seller can see a filled-in Products page risk-free — always
            // status=inactive (never sellable/visible), see the checklist
            // controller. Kept separate from `source` (that column tracks
            // integration provenance: manual vs woocommerce, not this).
            $table->boolean('is_demo')->default(false)->after('status');
        });

        Schema::table('shop_profiles', function (Blueprint $table) {
            $table->timestamp('getting_started_dismissed_at')->nullable()->after('subdomain_set_at');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('is_demo');
        });

        Schema::table('shop_profiles', function (Blueprint $table) {
            $table->dropColumn('getting_started_dismissed_at');
        });
    }
};
