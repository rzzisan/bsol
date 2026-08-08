<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Facebook §6 item 4 — per-seller Conversions API (CAPI) config, so a
 * server-side Purchase event can be sent to the seller's own ad pixel when
 * a landing-page checkout completes. Deliberately separate from
 * facebook_page_connections: a Pixel/CAPI access token comes from the
 * seller's own Meta Events Manager (Business Manager asset), not from the
 * Page-connect OAuth flow used for lead capture — no new Meta App
 * permission/App-Review round needed, the seller pastes their own
 * credentials the same way platform_facebook_settings holds ours.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facebook_pixel_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('pixel_id')->nullable();
            $table->text('access_token')->nullable(); // encrypted cast — seller's own CAPI token
            $table->string('test_event_code')->nullable();
            $table->boolean('enabled')->default(false);
            $table->timestamp('last_sent_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facebook_pixel_settings');
    }
};
