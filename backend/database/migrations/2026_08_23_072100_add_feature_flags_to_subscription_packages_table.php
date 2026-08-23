<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `subscription_packages.features` is a display-only bullet list already
 * (admin-typed strings rendered verbatim on the pricing card, see
 * subscription/page.tsx:719 — `<span>{f}</span>`, no lookup table).
 * Reusing it as an enforcement key=>bool map would let editing marketing
 * copy silently flip access, and every existing production package
 * (Trial/Free Trial/Starter/Growth/Business) already holds unrelated
 * strings ("fraud_check", "sms_automation"...) that don't match the new
 * gate keys — so this is a deliberately separate column, not a repurpose.
 * See subscription_billing_context.md §9.2-E / §9.3.
 *
 * Every *existing* package is explicitly grandfathered to
 * {storefront: true, facebook: true} here so this migration cannot lock any
 * currently-active seller out of a feature they already use — default-deny
 * only applies to future keys added later.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->json('feature_flags')->nullable()->after('features');
        });

        DB::table('subscription_packages')->update([
            'feature_flags' => json_encode(['storefront' => true, 'facebook' => true]),
        ]);
    }

    public function down(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->dropColumn('feature_flags');
        });
    }
};
