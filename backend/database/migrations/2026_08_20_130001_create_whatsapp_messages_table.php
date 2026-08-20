<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Parallels facebook_leads, but wa_id (customer's WhatsApp-registered
 * phone number) makes customer auto-linking exact instead of Facebook's
 * best-effort regex-in-message-text guess. Covers both inbound customer
 * messages and outbound sends (automation + manual replies) as one flat
 * event log, same shape convention as facebook_leads. Delivery-status
 * webhook events update the matching outbound row by wa_message_id
 * rather than creating new rows. See whatsapp_context.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('whatsapp_business_connection_id')->constrained()->cascadeOnDelete();
            $table->string('direction', 10); // inbound | outbound
            $table->string('wa_message_id')->nullable();
            $table->string('wa_id'); // customer's WhatsApp phone, no + prefix
            $table->string('contact_name')->nullable();
            $table->string('message_type', 20)->default('text'); // text | template | other
            $table->text('body')->nullable();
            $table->string('template_name')->nullable();
            $table->string('status', 20)->default('received'); // received|sent|delivered|read|failed
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_read')->default(false);
            $table->json('raw_payload')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();

            $table->unique('wa_message_id');
            $table->index(['user_id', 'wa_id']);
            $table->index(['user_id', 'is_read']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_messages');
    }
};
