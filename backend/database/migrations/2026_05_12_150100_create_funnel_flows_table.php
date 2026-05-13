<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('funnel_flows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('funnel_id')->constrained('funnels')->cascadeOnDelete();
            $table->string('name', 180);
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['funnel_id', 'version'], 'funnel_flow_version_unique');
            $table->index(['funnel_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('funnel_flows');
    }
};
