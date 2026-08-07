<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_conversations', function (Blueprint $table) {
            $table->id();
            // One persistent thread per seller — the whole admin team (shared
            // "super admin" support pool, see CONTEXT.md §25) reads/replies here.
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('status')->default('open'); // open | closed
            $table->timestamp('last_message_at')->nullable();
            $table->string('last_message_preview', 255)->nullable();
            $table->string('last_message_sender_type')->nullable(); // user | admin
            $table->unsignedInteger('user_unread_count')->default(0);
            $table->unsignedInteger('admin_unread_count')->default(0);
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'last_message_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_conversations');
    }
};
