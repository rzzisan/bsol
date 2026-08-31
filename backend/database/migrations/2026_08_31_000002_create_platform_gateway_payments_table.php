<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per seller→platform automated-gateway attempt, across all four
 * payment surfaces (subscription, sms_credit, order_credit,
 * storefront_addon) — mirrors OrderOnlinePayment's role for customer→seller
 * gateway_auto payments exactly (same lockForUpdate()+isTerminal()
 * idempotency discipline, same "always verify with our own stored
 * provider_payment_id, never trust callback data" guard). `purpose` +
 * `payable_id` point back at the actual SubscriptionPayment/
 * SmsCreditPurchase/AddonPurchase row that the manual flow already uses,
 * so the existing approve/activate cascades (SubscriptionActivationService,
 * SmsCreditService::recharge(), AddonApplyService::apply()) are reused
 * unchanged. See online_payment_context.md §12.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_gateway_payments', function (Blueprint $table) {
            $table->id();
            $table->string('purpose', 20); // subscription | sms_credit | order_credit | storefront_addon
            $table->unsignedBigInteger('payable_id'); // id in the purpose's own table (no FK — different tables per purpose)
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 30);
            $table->decimal('amount', 12, 2);
            $table->string('status', 20)->default('initiated'); // initiated | completed | failed
            $table->string('provider_payment_id', 150)->nullable()->index();
            $table->string('provider_trx_id', 150)->nullable();
            $table->text('gateway_response')->nullable(); // array cast (not encrypted — no secrets in here, same as OrderOnlinePayment)
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['purpose', 'payable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_gateway_payments');
    }
};
