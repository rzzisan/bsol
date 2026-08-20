<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A reusable, previously-authorized charge target — currently only bKash's
 * Tokenized Checkout "Agreement" (one-time customer consent on bKash's own
 * page, then server-to-server charges against agreement_id afterward, no
 * further customer interaction). Powers SMS-credit auto-recharge
 * (auto_top_up_context.md); one row per (user, provider), so a future
 * second use (e.g. subscription auto-renew) can reuse the same table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saved_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 30)->default('bkash'); // only 'bkash' for now
            $table->text('agreement_id')->nullable(); // encrypted cast — never exposed to any API response
            // Plain (not encrypted) — holds the bKash paymentID only during
            // the create->callback window, while status is still 'pending'.
            // Can't reuse agreement_id for this: an encrypted-cast column
            // can't be looked up with where() (random IV means equal
            // plaintext never produces equal ciphertext), so the callback
            // needs an unencrypted key to find the row by.
            $table->string('pending_payment_id', 60)->nullable()->index();
            $table->string('payer_reference', 60)->nullable();
            $table->string('status', 20)->default('pending'); // pending | active | cancelled | failed
            $table->timestamps();

            $table->unique(['user_id', 'provider']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_payment_methods');
    }
};
