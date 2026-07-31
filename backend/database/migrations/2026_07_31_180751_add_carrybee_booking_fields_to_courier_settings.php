<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courier_settings', function (Blueprint $table) {
            // carrybee_phone/carrybee_password (existing) are the scraped merchant-panel
            // login used only by the fraud checker. These are the official REST API
            // credentials (Client-ID / Client-Secret / Client-Context headers) used for
            // booking, distinct per environment.
            $table->string('carrybee_client_id')->nullable()->after('carrybee_password');
            $table->string('carrybee_client_secret')->nullable()->after('carrybee_client_id');
            $table->string('carrybee_client_context')->nullable()->after('carrybee_client_secret');
            $table->string('carrybee_environment', 20)->default('production')->after('carrybee_client_context');
            $table->string('carrybee_store_id')->nullable()->after('carrybee_environment');
        });
    }

    public function down(): void
    {
        Schema::table('courier_settings', function (Blueprint $table) {
            $table->dropColumn([
                'carrybee_client_id', 'carrybee_client_secret', 'carrybee_client_context',
                'carrybee_environment', 'carrybee_store_id',
            ]);
        });
    }
};
