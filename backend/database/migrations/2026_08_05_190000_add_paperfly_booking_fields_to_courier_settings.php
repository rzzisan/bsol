<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courier_settings', function (Blueprint $table) {
            // paperfly_username/paperfly_password (existing) are the merchant-panel
            // login — also doubles as HTTP Basic Auth for the booking API. These two
            // are additionally required for booking: `paperflykey` is a static header
            // issued per merchant from the Developer Guide page, and store_name is a
            // free-text store identifier configured in the merchant panel (Paperfly
            // has no store-management API to create/list one, unlike Pathao/RedX/CarryBee).
            // `text` (not varchar) to match the width every other encrypted-cast
            // credential column needed — see 2026_08_02_074114_widen_courier_settings_secret_columns_for_encryption.php.
            $table->text('paperfly_api_key')->nullable()->after('paperfly_password');
            $table->string('paperfly_store_name')->nullable()->after('paperfly_api_key');
        });
    }

    public function down(): void
    {
        Schema::table('courier_settings', function (Blueprint $table) {
            $table->dropColumn(['paperfly_api_key', 'paperfly_store_name']);
        });
    }
};
