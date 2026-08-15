<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Where tracking events get sent — the successor to facebook_pixel_settings
 * (tracking_capi_context.md §4.1).
 *
 * Two things it fixes. First, facebook_pixel_settings has unique('user_id'),
 * so a seller running two brands or two sites is stuck with one pixel.
 * Second, it is Meta-only by name; the pipeline behind it is meant to be
 * provider-agnostic (§3.4), so adding TikTok/GA4 later is a new driver
 * rather than a migration.
 *
 * The backfill runs here rather than in a later phase: with the table
 * created but empty, every piece of code written in between would have to
 * decide which of the two tables to read. facebook_pixel_settings is
 * deliberately NOT dropped — SendFacebookCapiPurchaseEventJob still reads it
 * until T2 turns that job into a wrapper, and it is the rollback path.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracking_destinations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 20)->default('meta');
            // The seller's own name for it ("Main Pixel", "Brand B") — shown
            // in the dashboard once multiple destinations are possible.
            $table->string('label')->default('Default');
            $table->string('pixel_id')->nullable();
            $table->text('access_token')->nullable(); // encrypted cast — text, not string: ciphertext overflows varchar(255)
            $table->string('test_event_code')->nullable();
            $table->boolean('enabled')->default(false);
            // null = shop-wide. 'landing_page' | 'platform_api_key' scope this
            // destination to one page or one connected WooCommerce site.
            // 'landing_domain' arrives with T8b (§4.4).
            $table->string('scope_type', 20)->nullable();
            // Deliberately no FK: the target table depends on scope_type.
            $table->unsignedBigInteger('scope_id')->nullable();
            $table->string('consent_mode', 20)->default('off'); // 'off' | 'required'
            $table->timestamp('last_sent_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'enabled']);
            $table->index(['scope_type', 'scope_id']);
        });

        // Copies the ciphertext verbatim. Safe because both columns use the
        // same 'encrypted' cast and the same APP_KEY — decrypting the copy
        // yields the original token.
        DB::statement(<<<'SQL'
            INSERT INTO tracking_destinations (
                user_id, provider, label, pixel_id, access_token, test_event_code,
                enabled, consent_mode, last_sent_at, last_error, created_at, updated_at
            )
            SELECT
                user_id, 'meta', 'Default', pixel_id, access_token, test_event_code,
                enabled, 'off', last_sent_at, last_error, created_at, updated_at
            FROM facebook_pixel_settings
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('tracking_destinations');
    }
};
