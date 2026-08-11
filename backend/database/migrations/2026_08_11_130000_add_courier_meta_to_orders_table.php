<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extra booking-time metadata needed to render the Pathao-specific waybill
 * design (courier_waybill_context.md §5.1): parcel weight and the exact
 * moment the courier was booked, both of which the generic label never
 * needed to persist before now (weight was only ever passed transiently to
 * the provider's book() call; "order date" on the printed label means the
 * booking time, not order->created_at).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('courier_weight_kg', 6, 2)->nullable()->after('courier_cod_amount');
            $table->timestamp('courier_booked_at')->nullable()->after('courier_weight_kg');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['courier_weight_kg', 'courier_booked_at']);
        });
    }
};
