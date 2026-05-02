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
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('order_number', 30)->unique();
            $table->string('customer_name', 150)->nullable();
            $table->string('customer_phone', 20);
            $table->text('customer_address')->nullable();
            $table->string('customer_district', 100)->nullable();
            $table->string('customer_thana', 100)->nullable();
            // source
            $table->string('source', 50)->default('manual'); // manual, facebook_inbox, landing_page
            $table->string('source_ref', 255)->nullable();   // FB thread/page ID
            // status
            $table->string('status', 30)->default('pending');
            // pending, confirmed, processing, shipped, delivered, cancelled, returned
            // payment
            $table->string('payment_method', 30)->default('cod'); // cod, online, bkash
            $table->string('payment_status', 20)->default('due'); // due, partial, paid
            // amounts
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('shipping_charge', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->text('notes')->nullable();
            // fraud
            $table->smallInteger('fraud_score')->default(0);
            $table->string('risk_level', 10)->default('low'); // low, medium, high
            // courier
            $table->string('courier_name', 50)->nullable();
            $table->string('courier_tracking_id', 100)->nullable();
            $table->string('courier_status', 50)->nullable();
            $table->decimal('courier_charge', 10, 2)->nullable();
            // assignment
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'risk_level']);
            $table->index('customer_phone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
