<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Seller-pasted WhatsApp Cloud API credentials — parallels
 * facebook_page_connections, but credential-paste instead of OAuth
 * (matches the Facebook Pixel/CAPI pattern: zero App-Review dependency
 * on our side). See whatsapp_context.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_business_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('phone_number_id');
            $table->string('waba_id')->nullable();
            $table->string('display_phone_number')->nullable();
            $table->text('access_token')->nullable(); // encrypted cast
            $table->string('status')->default('connected'); // connected | error | disconnected
            $table->text('last_error')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_business_connections');
    }
};
