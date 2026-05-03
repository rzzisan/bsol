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
        Schema::table('courier_settings', function (Blueprint $table) {
            $table->string('pathao_username')->nullable()->after('pathao_client_secret');
            $table->string('pathao_password')->nullable()->after('pathao_username');
            $table->text('pathao_access_token')->nullable()->after('pathao_password');
            $table->text('pathao_refresh_token')->nullable()->after('pathao_access_token');
            $table->timestamp('pathao_token_expires_at')->nullable()->after('pathao_refresh_token');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courier_settings', function (Blueprint $table) {
            $table->dropColumn(['pathao_username', 'pathao_password', 'pathao_access_token', 'pathao_refresh_token', 'pathao_token_expires_at']);
        });
    }
};
