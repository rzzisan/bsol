<?php

namespace App\Services\Security;

use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * One-time-use fallback codes for when an admin loses their authenticator
 * device — security_hardening_context.md. Stored hashed (on top of the
 * User model's own `encrypted:array` cast on the column) so that even a
 * database + app-key compromise together don't hand over usable codes,
 * only their hashes.
 */
class RecoveryCodeService
{
    private const COUNT = 8;

    /**
     * @return array{plaintext: string[], hashed: string[]} plaintext is
     *   shown to the admin exactly once; hashed is what gets stored.
     */
    public static function generate(): array
    {
        $plaintext = [];

        for ($i = 0; $i < self::COUNT; $i++) {
            $plaintext[] = strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4));
        }

        return [
            'plaintext' => $plaintext,
            'hashed' => array_map(fn (string $code) => Hash::make($code), $plaintext),
        ];
    }

    /**
     * Checks $code against the stored hashes and, if it matches, returns the
     * remaining hash list with that one removed (each code works once).
     * Returns null when there's no match.
     *
     * @param string[] $hashedCodes
     * @return string[]|null
     */
    public static function consume(array $hashedCodes, string $code): ?array
    {
        $code = trim($code);

        foreach ($hashedCodes as $index => $hash) {
            if (Hash::check($code, $hash)) {
                unset($hashedCodes[$index]);

                return array_values($hashedCodes);
            }
        }

        return null;
    }
}
