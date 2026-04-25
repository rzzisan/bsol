<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_credit_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('type', ['recharge', 'deduct'])->index();
            $table->bigInteger('credits')->comment('Credits added (recharge) or used (deduct)');
            $table->bigInteger('balance_before');
            $table->bigInteger('balance_after');
            $table->string('note', 500)->nullable()->comment('Admin note or deduction reason');
            $table->foreignId('recharged_by')->nullable()->constrained('users')->nullOnDelete()->comment('Admin who performed the recharge');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_credit_histories');
    }
};
