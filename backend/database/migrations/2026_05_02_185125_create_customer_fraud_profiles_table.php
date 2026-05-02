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
        Schema::create('customer_fraud_profiles', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('phone', 20);
            $table->integer('total_orders')->default(0);
            $table->integer('delivered_count')->default(0);
            $table->integer('cancelled_count')->default(0);
            $table->integer('return_count')->default(0);
            $table->integer('fraud_score')->default(0); // 0-100
            $table->string('risk_level', 20)->default('low'); // low/medium/high
            $table->timestamp('last_updated')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'phone']);
            $table->index(['user_id', 'risk_level']);
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_fraud_profiles');
    }
};
