<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The amount actually communicated to the courier for COD collection can
 * differ from order->total (partial COD, advance already paid, etc — the
 * booking form's COD field is editable, see CourierController::book()).
 * Without storing that value separately, the waybill/label PDF and QR code
 * had no way to know it and always fell back to the full order total,
 * printing the wrong collection amount on the physical sticker.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('courier_cod_amount', 10, 2)->nullable()->after('courier_charge');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('courier_cod_amount');
        });
    }
};
