<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Parallel to subscription_payments / sms_credit_purchases (same columns,
 * same manual-bKash-first flow) — see addon_packages migration's docblock.
 * `applied_at` is the AddonApplyService::apply() idempotency guard (set
 * once, never re-applied even if approve is somehow triggered twice).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addon_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('addon_package_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->string('payment_method', 30)->default('bkash_manual');
            $table->string('sender_bkash_number', 20)->nullable();
            $table->string('trx_id', 50)->nullable()->unique();
            $table->string('screenshot_path')->nullable();
            $table->string('bkash_payment_id')->nullable();
            $table->string('status', 20)->default('pending'); // pending|approved|rejected
            $table->text('admin_note')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addon_purchases');
    }
};
