<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Transparency log for the order-credit wallet (mirrors sms_credit_histories'
 * role) — every purchase/consume event, so a seller can see why their
 * balance changed. Not used for balance computation itself (the wallet
 * row is the source of truth); this is read-only audit trail.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_credit_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20); // purchase|consume
            $table->integer('credits'); // positive for purchase, negative for consume
            $table->unsignedInteger('balance_after');
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignId('addon_purchase_id')->nullable()->constrained('addon_purchases')->nullOnDelete();
            $table->string('note')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_credit_histories');
    }
};
