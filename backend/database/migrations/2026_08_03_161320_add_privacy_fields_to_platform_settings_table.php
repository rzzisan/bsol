<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->string('privacy_link_label_bn', 150)->nullable();
            $table->string('privacy_link_label_en', 150)->nullable();

            // Public /privacy page content.
            $table->string('privacy_title_bn', 200)->nullable();
            $table->string('privacy_title_en', 200)->nullable();
            $table->json('privacy_content_bn')->nullable();
            $table->json('privacy_content_en')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn([
                'privacy_link_label_bn',
                'privacy_link_label_en',
                'privacy_title_bn',
                'privacy_title_en',
                'privacy_content_bn',
                'privacy_content_en',
            ]);
        });
    }
};
