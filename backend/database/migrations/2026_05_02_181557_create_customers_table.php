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
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index(); // seller
            $table->string('phone', 20);
            $table->string('name', 150)->nullable();
            $table->string('email', 150)->nullable();
            $table->text('address')->nullable();
            $table->string('district', 100)->nullable();
            $table->string('thana', 100)->nullable();
            $table->text('notes')->nullable();
            $table->jsonb('tags')->default('[]');         // ['vip','wholesale'...]
            $table->string('risk_level', 20)->default('low'); // low/medium/high
            $table->decimal('fraud_score', 5, 2)->default(0);
            $table->boolean('is_blocked')->default(false);
            $table->unsignedInteger('total_orders')->default(0);
            $table->decimal('total_spent', 14, 2)->default(0);
            $table->timestamp('last_order_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'phone']); // one customer per phone per seller
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
