<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pre-existing bug this fixes: support_messages.sender_id was NOT NULL,
     * but AiSupportAgentService::respondToConversation() has always written
     * AI replies with sender_id = null (there's no user row for the AI) —
     * matching support_ticket_messages.sender_id, which was correctly made
     * nullable from its very first migration. Every AI reply attempted in
     * the live-chat widget itself would have thrown a DB exception; this
     * path just hadn't actually been exercised in production yet (only the
     * ticket surface had). Caught by TicketFromChatTest.php.
     */
    public function up(): void
    {
        Schema::table('support_messages', function (Blueprint $table) {
            $table->foreignId('sender_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('support_messages', function (Blueprint $table) {
            $table->foreignId('sender_id')->nullable(false)->change();
        });
    }
};
