<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Separate from `key_hash` (one-way sha256, never reversible by design —
 * see create_platform_api_keys_table). This secret is for the reverse
 * direction: BSOL pushing stock changes OUT to WordPress, so BSOL needs
 * to hold the plaintext to send it, and WordPress holds the same
 * plaintext to hash_equals()-compare an incoming call. `text`, not
 * `string`, from the start — Laravel's `encrypted` cast overflows
 * varchar(255) even for short plaintext (see
 * 2026_08_02_074114_widen_courier_settings_secret_columns_for_encryption.php).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_api_keys', function (Blueprint $table) {
            $table->text('webhook_secret')->nullable()->after('key_prefix');
        });
    }

    public function down(): void
    {
        Schema::table('platform_api_keys', function (Blueprint $table) {
            $table->dropColumn('webhook_secret');
        });
    }
};
