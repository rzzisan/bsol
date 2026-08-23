<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Super-admin-defined add-on SKUs (subscription_billing_context.md §9.2-B)
 * — a generic pair (this + addon_purchases) shared by every add-on type,
 * because the payment/approval/invoice plumbing is identical across types
 * (mirrors subscription_payments/sms_credit_purchases exactly); only
 * "what happens on approval" (AddonApplyService::apply()) differs per
 * type, kept as small per-type branches rather than per-type tables.
 *
 * `type` only ever contains 'order_credit' for now (app-level validation
 * restricts creation to it, AdminAddonPackageController) — 'landing_page',
 * 'storefront', 'tracking_boost' are reserved values for later steps
 * (§9.6), not yet creatable, so nothing can be sold that doesn't work yet.
 *
 * `quantity`: credit count for order_credit, daily-bonus for
 * tracking_boost, unused (always 1 unit) for landing_page/storefront.
 * `duration_days`: order_credit's own validity window (user's confirmed
 * design: single-balance wallet, refreshes to a fresh window on every
 * purchase — §9.3 decision #1); null for the co-terminous-with-main-plan
 * types (landing_page/storefront/tracking_boost, §9.2-C/D).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addon_packages', function (Blueprint $table) {
            $table->id();
            $table->string('type', 30);
            $table->string('name');
            $table->decimal('price', 10, 2);
            $table->unsignedInteger('quantity')->nullable();
            $table->unsignedInteger('duration_days')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['type', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addon_packages');
    }
};
