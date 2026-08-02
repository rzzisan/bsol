<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * One-time data migration: encrypt whatever plaintext credentials already
 * exist before CourierSetting/EmailConfiguration get the `encrypted` Eloquent
 * cast (added right after this migration, in the same change). Writes go
 * through raw DB::table() (bypassing the model) so this runs correctly
 * regardless of whether the model cast is already deployed — and so the
 * model cast never encounters a still-plaintext row and throws a
 * DecryptException on the next normal read.
 */
return new class extends Migration
{
    private const COURIER_COLUMNS = [
        'steadfast_api_key',
        'steadfast_secret_key',
        'pathao_client_secret',
        'pathao_password',
        'pathao_access_token',
        'pathao_refresh_token',
        'redx_api_key',
        'redx_password',
        'carrybee_password',
        'carrybee_client_secret',
        'carrybee_client_context',
        'paperfly_password',
    ];

    public function up(): void
    {
        foreach (DB::table('courier_settings')->get() as $row) {
            $updates = [];
            foreach (self::COURIER_COLUMNS as $column) {
                $value = $row->{$column} ?? null;
                if ($value === null || $value === '') {
                    continue;
                }
                $updates[$column] = Crypt::encryptString($value);
            }
            if ($updates !== []) {
                DB::table('courier_settings')->where('id', $row->id)->update($updates);
            }
        }

        foreach (DB::table('email_configurations')->get() as $row) {
            if (! empty($row->password)) {
                DB::table('email_configurations')->where('id', $row->id)
                    ->update(['password' => Crypt::encryptString($row->password)]);
            }
        }
    }

    /**
     * Best-effort revert to plaintext. Skips any value that doesn't decrypt
     * (e.g. it was already plaintext going in, or added after this ran) —
     * this migration isn't expected to be rolled back in practice.
     */
    public function down(): void
    {
        foreach (DB::table('courier_settings')->get() as $row) {
            $updates = [];
            foreach (self::COURIER_COLUMNS as $column) {
                $value = $row->{$column} ?? null;
                if ($value === null || $value === '') {
                    continue;
                }
                try {
                    $updates[$column] = Crypt::decryptString($value);
                } catch (\Throwable) {
                    // leave as-is
                }
            }
            if ($updates !== []) {
                DB::table('courier_settings')->where('id', $row->id)->update($updates);
            }
        }

        foreach (DB::table('email_configurations')->get() as $row) {
            if (! empty($row->password)) {
                try {
                    DB::table('email_configurations')->where('id', $row->id)
                        ->update(['password' => Crypt::decryptString($row->password)]);
                } catch (\Throwable) {
                    // leave as-is
                }
            }
        }
    }
};
