<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Order-credit wallet — subscription_billing_context.md §9.3 decision #1:
 * single balance, no per-purchase "lot" tracking. Every new purchase does
 * `balance += quantity` and resets `expires_at = now() + duration_days`
 * (a fresh purchase always refreshes the clock — decision #1/#2, no
 * rollover past expiry). Expiry is checked lazily at read/consume time
 * (OrderCreditService), not swept by a cron — same "derived, not stored"
 * preference already used elsewhere in this codebase (e.g. the Getting
 * Started checklist's step-completion).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_credit_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('balance')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_credit_wallets');
    }
};
