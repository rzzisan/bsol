<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table("orders", function (Blueprint $table) {
            $table->string("customer_area", 120)->nullable()->after("customer_thana");
            $table->unsignedInteger("pathao_city_id")->nullable()->after("customer_area");
            $table->unsignedInteger("pathao_zone_id")->nullable()->after("pathao_city_id");
            $table->unsignedInteger("pathao_area_id")->nullable()->after("pathao_zone_id");
        });

        Schema::table("customers", function (Blueprint $table) {
            $table->string("area", 120)->nullable()->after("thana");
            $table->unsignedInteger("pathao_city_id")->nullable()->after("area");
            $table->unsignedInteger("pathao_zone_id")->nullable()->after("pathao_city_id");
            $table->unsignedInteger("pathao_area_id")->nullable()->after("pathao_zone_id");
        });
    }

    public function down(): void
    {
        Schema::table("orders", function (Blueprint $table) {
            $table->dropColumn(["customer_area", "pathao_city_id", "pathao_zone_id", "pathao_area_id"]);
        });
        Schema::table("customers", function (Blueprint $table) {
            $table->dropColumn(["area", "pathao_city_id", "pathao_zone_id", "pathao_area_id"]);
        });
    }
};