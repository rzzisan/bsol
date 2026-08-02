<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facebook_leads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facebook_page_connection_id')->constrained()->cascadeOnDelete();
            $table->string('channel'); // comment | message
            $table->string('fb_event_id');
            $table->string('sender_fb_id')->nullable();
            $table->string('sender_name')->nullable();
            $table->text('message')->nullable();
            $table->string('post_id')->nullable();
            $table->string('thread_id')->nullable();
            $table->string('detected_phone')->nullable();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('new'); // new | converted | ignored
            $table->boolean('is_read')->default(false);
            $table->json('raw_payload')->nullable();
            $table->timestamp('received_at');
            $table->timestamps();

            $table->unique(['channel', 'fb_event_id']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facebook_leads');
    }
};
