<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * RedX's API-ACCESS-TOKEN is a JWT (can run well past 255 chars) but the
     * column was created as varchar(255), silently truncating/rejecting real
     * tokens. Widen it to text, matching pathao_access_token.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE courier_settings ALTER COLUMN redx_api_key TYPE text');
        }
        // SQLite (used by the test suite) has no fixed-length varchar limit to widen.
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE courier_settings ALTER COLUMN redx_api_key TYPE varchar(255)');
        }
    }
};
