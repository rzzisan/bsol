<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Storefront add-on — subscription_billing_context.md §9.2-D / §9.6 step 4.
 * Binary, co-terminous with the main subscription cycle (not its own
 * independent duration, unlike order_credit): a seller whose package
 * doesn't include `feature_flags.storefront` can unlock it separately,
 * valid until `storefront_addon_until`. Lives on `users` alongside the
 * other subscription-lifecycle columns (subscription_ends_at etc.) since
 * it's billing state, not a storefront *setting* (storefront_settings
 * table is presentation config, a different concern).
 *
 * "Co-terminous" is enforced by SubscriptionActivationService::activate()
 * extending this to match subscription_ends_at on every renewal/upgrade —
 * but only while it's still active (not null and not yet expired); a
 * lapsed add-on is never silently revived by an unrelated renewal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('storefront_addon_until')->nullable()->after('subscription_ends_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('storefront_addon_until');
        });
    }
};
