<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_template_access_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->constrained('landing_templates')->cascadeOnDelete();
            $table->foreignId('package_id')->nullable()->constrained('subscription_packages')->nullOnDelete();
            $table->boolean('is_enabled')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['template_id', 'package_id'], 'landing_template_package_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_template_access_rules');
    }
};
