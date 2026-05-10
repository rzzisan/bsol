<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('regular_price', 12, 2)->nullable()->after('quantity');
            $table->decimal('discount', 12, 2)->default(0)->after('regular_price');
            $table->string('discount_type', 20)->default('amount')->after('discount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['regular_price', 'discount', 'discount_type']);
        });
    }
};
