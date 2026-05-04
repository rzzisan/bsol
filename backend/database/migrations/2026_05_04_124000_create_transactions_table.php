<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 20); // income|expense
            $table->string('status', 20)->default('confirmed'); // pending|confirmed
            $table->string('category', 60);
            $table->string('reference_type', 40)->nullable(); // order|manual
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->decimal('amount', 12, 2);
            $table->text('note')->nullable();
            $table->date('transaction_date');
            $table->boolean('is_auto')->default(false);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'type', 'transaction_date']);
            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
