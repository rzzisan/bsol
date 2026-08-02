<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facebook_page_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('fb_page_id')->unique();
            $table->string('page_name')->nullable();
            $table->text('page_access_token')->nullable();
            $table->string('fb_user_id')->nullable();
            $table->text('fb_user_access_token')->nullable();
            $table->json('scopes')->nullable();
            $table->string('status')->default('connected'); // connected | error | disconnected
            $table->timestamp('webhook_subscribed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facebook_page_connections');
    }
};
