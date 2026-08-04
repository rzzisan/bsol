<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_facebook_settings', function (Blueprint $table) {
            $table->string('login_config_id')->nullable()->after('app_id');
        });
    }

    public function down(): void
    {
        Schema::table('platform_facebook_settings', function (Blueprint $table) {
            $table->dropColumn('login_config_id');
        });
    }
};
