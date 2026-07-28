<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('phone_otp_verifications', function (Blueprint $table) {
            if (!Schema::hasColumn('phone_otp_verifications', 'order_id')) {
                $table->unsignedBigInteger('order_id')->nullable()->after('id');
                $table->index('order_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('phone_otp_verifications', function (Blueprint $table) {
            if (Schema::hasColumn('phone_otp_verifications', 'order_id')) {
                $table->dropIndex(['order_id']);
                $table->dropColumn('order_id');
            }
        });
    }
};
