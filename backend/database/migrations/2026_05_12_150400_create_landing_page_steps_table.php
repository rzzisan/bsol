<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_page_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->enum('step_type', ['landing', 'checkout', 'order_bump', 'upsell', 'thank_you'])->default('landing');
            $table->unsignedInteger('step_order')->default(0);
            $table->foreignId('page_id')->nullable()->constrained('landing_pages')->nullOnDelete();
            $table->json('settings_json')->nullable();
            $table->timestamps();

            $table->unique(['landing_page_id', 'step_order'], 'landing_page_step_unique');
            $table->index(['landing_page_id', 'step_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_steps');
    }
};
