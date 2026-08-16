<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Persists the Meta browser/click identifiers on the order itself
 * (tracking_capi_context.md §11.4 — event match quality). Both are raw
 * pass-through values, never PII, never hashed — same RAW classification
 * TrackingUserDataBuilder already gives them.
 *
 * Why persist at all instead of only ever reading live request cookies:
 * order-flow events (OrderConfirmed/Shipped/Delivered/Returned/Canceled)
 * fire from OrderStatusService::transition() potentially days after
 * checkout, with no browser request behind them — the only way those
 * events can ever carry fbp/fbc is if the order captured them at creation
 * time and kept them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('fbp', 255)->nullable()->after('otp_verified_at');
            $table->string('fbc', 255)->nullable()->after('fbp');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['fbp', 'fbc']);
        });
    }
};
