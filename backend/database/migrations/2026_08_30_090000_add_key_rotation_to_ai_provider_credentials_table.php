<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_provider_credentials', function (Blueprint $table) {
            // Was one row per provider — now one row per key, so a provider
            // can hold several and AiProviderClientFactory rotates between
            // them on a rate-limited key instead of failing outright.
            // support_ticketing_ai_context.md §"multi-key rotation".
            $table->dropUnique(['provider']);
            $table->string('label')->nullable()->after('provider');
            $table->timestamp('rate_limited_until')->nullable()->after('default_model');
        });
    }

    public function down(): void
    {
        Schema::table('ai_provider_credentials', function (Blueprint $table) {
            $table->dropColumn(['label', 'rate_limited_until']);
            $table->unique('provider');
        });
    }
};
