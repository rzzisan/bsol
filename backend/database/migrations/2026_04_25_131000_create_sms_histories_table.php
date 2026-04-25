<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gateway_id')->nullable()->constrained('sms_gateways')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('gateway_name')->nullable();
            $table->string('provider', 80)->nullable();
            $table->string('phone_number', 30);
            $table->text('message');
            $table->string('status', 20);
            $table->unsignedSmallInteger('http_status_code')->nullable();
            $table->text('response_body')->nullable();
            $table->string('error_message', 255)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['phone_number', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_histories');
    }
};
