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
        Schema::table('facebook_leads', function (Blueprint $table) {
            $table->timestamp('replied_at')->nullable();
            $table->text('reply_message')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('facebook_leads', function (Blueprint $table) {
            $table->dropColumn(['replied_at', 'reply_message']);
        });
    }
};
