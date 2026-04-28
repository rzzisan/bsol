<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('phone_otp_verifications', function (Blueprint $table) {
            $table->unsignedTinyInteger('resend_count')->default(0)->after('attempts');
            $table->timestamp('last_sent_at')->nullable()->after('resend_count');
            $table->timestamp('next_resend_at')->nullable()->after('last_sent_at');
            $table->timestamp('blocked_until')->nullable()->after('next_resend_at');

            $table->index(['mobile', 'blocked_until']);
        });
    }

    public function down(): void
    {
        Schema::table('phone_otp_verifications', function (Blueprint $table) {
            $table->dropIndex(['mobile', 'blocked_until']);
            $table->dropColumn(['resend_count', 'last_sent_at', 'next_resend_at', 'blocked_until']);
        });
    }
};
