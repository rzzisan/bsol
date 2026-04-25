<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_credits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->bigInteger('balance')->default(0)->comment('Available SMS credits');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_credits');
    }
};
