<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('subject', 255);
            $table->string('category')->default('other'); // billing | order | product | technical | account | other
            $table->string('priority')->default('medium'); // low | medium | high | urgent
            $table->string('status')->default('open'); // open | pending | resolved | closed
            $table->foreignId('assigned_admin_id')->nullable()->constrained('users')->nullOnDelete();
            // Flips false the moment a human takes over — the AI-reply job checks
            // this before ever calling the API (support_ticketing_ai_context.md).
            $table->boolean('ai_handled')->default(true);
            $table->boolean('escalated')->default(false);
            $table->text('escalation_reason')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->string('last_message_preview', 255)->nullable();
            $table->string('last_message_sender_type')->nullable(); // user | admin | ai
            $table->unsignedInteger('user_unread_count')->default(0);
            $table->unsignedInteger('admin_unread_count')->default(0);
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'last_message_at']);
            $table->index('user_id');
            $table->index('assigned_admin_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_tickets');
    }
};
