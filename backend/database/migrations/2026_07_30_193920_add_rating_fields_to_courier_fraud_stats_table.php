<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courier_fraud_stats', function (Blueprint $table) {
            // Pathao's merchant dashboard now returns a customer rating label
            // (e.g. "excellent_customer") instead of raw delivery counts, unlike
            // the other couriers. data_type distinguishes the two response shapes.
            $table->string('data_type', 20)->default('delivery')->after('courier_name');
            $table->string('rating', 50)->nullable()->after('success_rate');
        });
    }

    public function down(): void
    {
        Schema::table('courier_fraud_stats', function (Blueprint $table) {
            $table->dropColumn(['data_type', 'rating']);
        });
    }
};
