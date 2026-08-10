<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            // null = unlimited staff seats, 0 = staff feature disabled on this package.
            // Deliberately nullable/no-default so every existing package keeps its
            // current (unlimited) behavior until an admin sets a real limit.
            $table->unsignedInteger('max_staff')->nullable()->after('duration_days');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->dropColumn('max_staff');
        });
    }
};
