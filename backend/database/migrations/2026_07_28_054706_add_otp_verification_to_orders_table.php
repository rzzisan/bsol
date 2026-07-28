<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'otp_required')) {
                $table->boolean('otp_required')->default(false)->after('public_token');
            }
            if (!Schema::hasColumn('orders', 'otp_verified_at')) {
                $table->timestamp('otp_verified_at')->nullable()->after('otp_required');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'otp_verified_at')) {
                $table->dropColumn('otp_verified_at');
            }
            if (Schema::hasColumn('orders', 'otp_required')) {
                $table->dropColumn('otp_required');
            }
        });
    }
};
