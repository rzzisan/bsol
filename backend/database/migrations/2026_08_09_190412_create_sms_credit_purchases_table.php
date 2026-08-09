<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sms_credit_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('credits');
            $table->decimal('rate_used', 10, 4);
            $table->decimal('amount', 10, 2);
            $table->string('payment_method', 30)->default('bkash_manual');
            $table->string('sender_bkash_number', 20)->nullable();
            $table->string('trx_id', 50)->nullable()->unique();
            $table->string('screenshot_path')->nullable();
            $table->string('bkash_payment_id')->nullable();
            $table->string('status', 20)->default('pending');
            $table->text('admin_note')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sms_credit_purchases');
    }
};
