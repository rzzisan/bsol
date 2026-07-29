<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('abandoned_checkouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('landing_page_id')->constrained()->cascadeOnDelete();
            $table->string('session_token', 64);

            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();
            $table->text('customer_address')->nullable();
            $table->string('customer_district')->nullable();
            $table->string('customer_thana')->nullable();
            $table->string('customer_area')->nullable();
            $table->text('notes')->nullable();
            $table->json('custom_fields')->nullable();

            $table->json('items')->nullable();
            $table->decimal('subtotal', 12, 2)->nullable();

            $table->string('ip_address')->nullable();
            $table->string('status', 20)->default('active'); // active|converted|dismissed
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('last_activity_at')->useCurrent();

            $table->timestamps();
            $table->softDeletes();

            $table->unique(['landing_page_id', 'session_token']);
            $table->index('customer_phone');
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('abandoned_checkouts');
    }
};
