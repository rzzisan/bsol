<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One connector API key per shop owner (Pattern B, owner-only) — used by
     * the future BSOL WordPress/WooCommerce plugin to authenticate against
     * /api/connect/v1/*. See bsol_history_and_new_context.md §5.
     *
     * key_hash is a one-way sha256 digest of the raw key (never stored/shown
     * again after generation) — NOT Laravel's reversible `encrypted` cast, so
     * a plain string(64) column is correct here (the "encrypted columns must
     * be text" lesson from courier_settings doesn't apply to hashes).
     */
    public function up(): void
    {
        Schema::create('platform_api_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('platform', 30)->default('woocommerce');
            $table->string('domain');
            $table->string('key_hash', 64)->unique();
            $table->string('key_prefix', 12)->nullable();
            $table->string('status', 20)->default('pending'); // pending | connected | revoked
            $table->timestamp('last_used_at')->nullable();
            $table->string('last_connected_ip', 45)->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_api_keys');
    }
};
