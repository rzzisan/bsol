<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    /**
     * These credential columns are moving to Laravel's `encrypted` cast
     * (matching the pattern already used on SmsGateway::api_key/secret_key).
     * The encrypted envelope (iv+mac+tag, base64-encoded) runs well past
     * varchar(255) even for short passwords — this project already hit
     * exactly that truncation bug once with redx_api_key (see
     * 2026_07_31_172754_change_redx_api_key_to_text_in_courier_settings.php)
     * before it stored JWTs. Widen every field getting the encrypted cast to
     * `text` up front instead of waiting to reproduce that bug per-column.
     */
    private const COLUMNS = [
        'steadfast_api_key',
        'steadfast_secret_key',
        'pathao_client_secret',
        'pathao_password',
        'redx_password',
        'carrybee_password',
        'carrybee_client_secret',
        'carrybee_client_context',
        'paperfly_password',
    ];

    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            foreach (self::COLUMNS as $column) {
                DB::statement("ALTER TABLE courier_settings ALTER COLUMN {$column} TYPE text");
            }
        }
        // SQLite (used by the test suite) has no fixed-length varchar limit to widen.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            foreach (self::COLUMNS as $column) {
                DB::statement("ALTER TABLE courier_settings ALTER COLUMN {$column} TYPE varchar(255)");
            }
        }
    }
};
