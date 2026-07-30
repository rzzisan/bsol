<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courier_fraud_stats', function (Blueprint $table) {
            $table->id();
            $table->string('phone_number', 15);
            $table->string('courier_name', 30); // pathao|steadfast|redx|carrybee|paperfly
            $table->unsignedInteger('total_parcels')->default(0);
            $table->unsignedInteger('total_delivered')->default(0);
            $table->unsignedInteger('total_cancelled')->default(0);
            $table->decimal('success_rate', 5, 2)->default(0);
            $table->string('status', 20)->default('ok'); // ok|error
            $table->text('error_message')->nullable();
            $table->unsignedBigInteger('fetched_by_user_id')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamps();

            $table->unique(['phone_number', 'courier_name']);
            $table->index('phone_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_fraud_stats');
    }
};
