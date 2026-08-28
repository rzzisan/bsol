<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_ai_support_settings', function (Blueprint $table) {
            // Which ai_provider_credentials row actually answers tickets/chat
            // right now — support_ticketing_ai_context.md.
            $table->string('provider')->default('anthropic')->after('is_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('platform_ai_support_settings', function (Blueprint $table) {
            $table->dropColumn('provider');
        });
    }
};
