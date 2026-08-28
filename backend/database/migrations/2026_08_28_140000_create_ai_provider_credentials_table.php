<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per provider — support_ticketing_ai_context.md. api_key is
        // stored via Eloquent's 'encrypted' cast (same convention as
        // PlatformFacebookSetting/CourierSetting), so it's ciphertext here.
        Schema::create('ai_provider_credentials', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->unique(); // anthropic | gemini | groq | openai | openrouter
            $table->text('api_key')->nullable();
            $table->string('default_model')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_provider_credentials');
    }
};
