<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Facebook §6 item 11 — per-seller quick-reply templates for common
 * questions in the Leads inbox reply box.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facebook_reply_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 100);
            $table->text('message');
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facebook_reply_templates');
    }
};
