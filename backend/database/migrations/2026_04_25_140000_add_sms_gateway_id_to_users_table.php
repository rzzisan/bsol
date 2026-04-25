<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('sms_gateway_id')
                ->nullable()
                ->after('subscription_package_id')
                ->constrained('sms_gateways')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['sms_gateway_id']);
            $table->dropColumn('sms_gateway_id');
        });
    }
};
