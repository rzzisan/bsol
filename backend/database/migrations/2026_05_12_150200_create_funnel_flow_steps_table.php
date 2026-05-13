<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('funnel_flow_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('funnel_flow_id')->constrained('funnel_flows')->cascadeOnDelete();
            $table->enum('step_type', ['landing', 'checkout', 'order_bump', 'upsell', 'thank_you'])->default('landing');
            $table->unsignedInteger('step_order')->default(0);
            $table->foreignId('landing_page_id')->nullable()->constrained('landing_pages')->nullOnDelete();
            $table->string('slug', 220)->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->json('settings_json')->nullable();
            $table->timestamps();

            $table->unique(['funnel_flow_id', 'step_order'], 'funnel_flow_step_unique');
            $table->index(['funnel_flow_id', 'is_enabled']);
            $table->index('step_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('funnel_flow_steps');
    }
};
