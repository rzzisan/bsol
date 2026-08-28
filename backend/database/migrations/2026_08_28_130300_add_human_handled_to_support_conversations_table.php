<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_conversations', function (Blueprint $table) {
            // Mirrors support_tickets.ai_handled for the live-chat surface — once
            // an admin has ever replied in this thread, the AI stops auto-replying
            // (support_ticketing_ai_context.md).
            $table->boolean('human_handled')->default(false)->after('admin_unread_count');
        });
    }

    public function down(): void
    {
        Schema::table('support_conversations', function (Blueprint $table) {
            $table->dropColumn('human_handled');
        });
    }
};
