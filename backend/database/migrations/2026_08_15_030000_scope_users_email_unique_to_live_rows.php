<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Makes users.email unique only among live rows.
 *
 * Registration deliberately lets a soft-deleted account's email be reused —
 * both the validation rule (Rule::unique(...)->whereNull('deleted_at'),
 * added in e0f7ea6) and the pre-flight User::where() check (SoftDeletes
 * excludes trashed rows by default) are written that way on purpose. The
 * index never matched: it was a plain UNIQUE(email) covering trashed rows
 * too. So every check passed and User::create() then hit the constraint,
 * surfacing to the seller as a bare "Server Error" at the OTP step.
 *
 * Hit in production on 2026-08-15 by a signup reusing the email of an
 * account soft-deleted on 2026-08-12.
 *
 * Safe for lookups: User uses SoftDeletes, so ordinary queries already
 * exclude trashed rows and cannot match the older duplicate.
 */
return new class extends Migration
{
    public function up(): void
    {
        // It's a table CONSTRAINT, not a bare index, so DROP INDEX is refused
        // ("cannot drop index ... because constraint ... requires it").
        // Dropping the constraint takes its backing index with it. A partial
        // unique index cannot be expressed as a constraint at all, which is
        // why the replacement is an index.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique');
        }
        DB::statement('DROP INDEX IF EXISTS users_email_unique');
        DB::statement('CREATE UNIQUE INDEX users_email_unique ON users (email) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        // Fails loudly if a trashed row now shares an email with a live one,
        // rather than silently dropping either.
        DB::statement('DROP INDEX IF EXISTS users_email_unique');
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)');
        }
    }
};
