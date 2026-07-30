<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courier_settings', function (Blueprint $table) {
            $table->string('redx_phone')->nullable()->after('redx_api_key');
            $table->string('redx_password')->nullable()->after('redx_phone');

            $table->string('carrybee_phone')->nullable()->after('redx_password');
            $table->string('carrybee_password')->nullable()->after('carrybee_phone');

            $table->string('paperfly_username')->nullable()->after('carrybee_password');
            $table->string('paperfly_password')->nullable()->after('paperfly_username');
        });
    }

    public function down(): void
    {
        Schema::table('courier_settings', function (Blueprint $table) {
            $table->dropColumn([
                'redx_phone', 'redx_password',
                'carrybee_phone', 'carrybee_password',
                'paperfly_username', 'paperfly_password',
            ]);
        });
    }
};
