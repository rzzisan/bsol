<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete(); // shop owner scope, mirrors transactions.user_id
            $table->foreignId('collected_by')->nullable()->constrained('users')->nullOnDelete(); // who physically received the money
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete(); // who logged this entry
            $table->string('purpose', 30); // advance | courier_charge | full_payment | other
            $table->string('method', 30); // cash | bank | bkash | nagad | rocket | upay | other
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->string('screenshot_path')->nullable();
            $table->string('note', 500)->nullable();
            $table->timestamp('collected_at');
            $table->timestamps();

            $table->index(['order_id', 'collected_at']);
            $table->index(['user_id', 'collected_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_payments');
    }
};
