<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One row per customer-facing online-payment *attempt* against an order —
 * the raw session/claim data (provider correlation ids, raw gateway
 * payloads, a wallet claim's sender number/trx id before verification).
 * Distinct from order_payments (the clean "money collected" ledger, which
 * this table feeds into via order_payment_id once a row is verified/
 * completed). See online_payment_context.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_online_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete(); // shop owner scope

            $table->string('channel_type', 20); // wallet_manual | gateway_auto
            $table->string('provider', 20); // bkash | nagad | rocket | sslcommerz
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('status', 30)->default('initiated');
            // initiated -> awaiting_verification|processing -> completed|verified
            //           -> rejected|failed|expired|cancelled

            // wallet_manual fields
            $table->string('sender_number', 20)->nullable();
            $table->string('customer_trx_id', 60)->nullable();
            $table->string('screenshot_path')->nullable();

            // gateway_auto fields
            $table->string('provider_payment_id', 100)->nullable();
            $table->string('provider_trx_id', 100)->nullable();
            $table->json('gateway_response')->nullable();

            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->string('note', 500)->nullable(); // seller's approve/reject note
            $table->foreignId('order_payment_id')->nullable()->constrained('order_payments')->nullOnDelete();
            $table->timestamp('expires_at')->nullable();

            $table->timestamps();

            $table->index(['order_id']);
            $table->index(['user_id', 'status']);
        });

        // provider_payment_id correlates a gateway callback back to its row —
        // must be unique when present (mirrors subscription_payments.bkash_payment_id).
        DB::statement('CREATE UNIQUE INDEX order_online_payments_provider_payment_id_unique ON order_online_payments (provider_payment_id) WHERE provider_payment_id IS NOT NULL');

        // Anti-replay: the same real wallet TrxID must not be submittable against
        // more than one order for the same seller (a customer reusing one real
        // transaction across many orders would otherwise pass verification-lookup
        // checks trivially). Scoped to wallet_manual only — gateway_auto has its
        // own provider_payment_id uniqueness above and legitimately reuses
        // customer_trx_id semantics differently (provider_trx_id, not this column).
        DB::statement("CREATE UNIQUE INDEX order_online_payments_user_trx_unique ON order_online_payments (user_id, customer_trx_id) WHERE customer_trx_id IS NOT NULL AND channel_type = 'wallet_manual'");
    }

    public function down(): void
    {
        Schema::dropIfExists('order_online_payments');
    }
};
