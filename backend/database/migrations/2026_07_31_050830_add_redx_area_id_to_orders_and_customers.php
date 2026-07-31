<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedInteger('redx_area_id')->nullable()->after('pathao_area_id');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->unsignedInteger('redx_area_id')->nullable()->after('pathao_area_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('redx_area_id');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('redx_area_id');
        });
    }
};
