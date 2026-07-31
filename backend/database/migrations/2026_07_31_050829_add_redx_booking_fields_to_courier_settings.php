<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courier_settings', function (Blueprint $table) {
            // redx_api_key already exists and is reused as the API-ACCESS-TOKEN.
            $table->string('redx_environment', 20)->default('production')->after('redx_api_key');
            $table->unsignedInteger('redx_pickup_store_id')->nullable()->after('redx_environment');
        });
    }

    public function down(): void
    {
        Schema::table('courier_settings', function (Blueprint $table) {
            $table->dropColumn(['redx_environment', 'redx_pickup_store_id']);
        });
    }
};
