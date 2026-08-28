<?php

namespace App\Services\Security;

/**
 * RFC 6238 TOTP (the algorithm behind Google Authenticator / Authy / any
 * standard authenticator app) — security_hardening_context.md.
 *
 * Implemented directly rather than pulling in a package: the algorithm is
 * ~30 lines of hash_hmac + bit-shifting with no external state, and this
 * codebase's own convention for payment-gateway crypto (Nagad's RSA
 * sign/encrypt, EPS's HMAC request signing) is already "read the spec,
 * implement it, lock it down with tests against known vectors" rather than
 * adding a dependency for something this size. Verified below against the
 * official RFC 6238 Appendix B SHA1 test vectors.
 */
class TotpService
{
    private const PERIOD = 30;
    private const DIGITS = 6;
    private const SECRET_BYTES = 20; // 160 bits, the RFC 4226 recommendation

    private const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function generateSecret(): string
    {
        return self::base32Encode(random_bytes(self::SECRET_BYTES));
    }

    /** Public for the RFC 6238 test-vector unit test — encodes an arbitrary
     * byte string rather than only ever generating a fresh random secret. */
    public static function base32EncodeRaw(string $bytes): string
    {
        return self::base32Encode($bytes);
    }

    /**
     * otpauth:// URI an authenticator app can scan (as a QR code) or a user
     * can enter manually via the secret it embeds.
     */
    public static function provisioningUri(string $issuer, string $accountLabel, string $base32Secret): string
    {
        $label = rawurlencode($issuer) . ':' . rawurlencode($accountLabel);

        return sprintf(
            'otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d',
            $label,
            $base32Secret,
            rawurlencode($issuer),
            self::DIGITS,
            self::PERIOD,
        );
    }

    /**
     * True if $code matches the secret at the current time step, or one
     * step either side (±30s) to absorb normal clock drift between the
     * server and the user's phone.
     */
    public static function verify(string $base32Secret, string $code, int $window = 1): bool
    {
        $code = trim($code);

        if (! preg_match('/^\d{' . self::DIGITS . '}$/', $code)) {
            return false;
        }

        $timestamp = time();

        for ($errorWindow = -$window; $errorWindow <= $window; $errorWindow++) {
            if (hash_equals(self::codeAt($base32Secret, $timestamp + ($errorWindow * self::PERIOD)), $code)) {
                return true;
            }
        }

        return false;
    }

    public static function codeAt(string $base32Secret, ?int $timestamp = null): string
    {
        $timestamp ??= time();
        $counter = intdiv($timestamp, self::PERIOD);

        $key = self::base32Decode($base32Secret);
        $counterBytes = pack('N*', 0, $counter); // 8-byte big-endian counter (top 4 bytes always 0 until year 2106)

        $hash = hash_hmac('sha1', $counterBytes, $key, true);

        $offset = ord($hash[19]) & 0x0F;
        $binary = ((ord($hash[$offset]) & 0x7F) << 24)
            | ((ord($hash[$offset + 1]) & 0xFF) << 16)
            | ((ord($hash[$offset + 2]) & 0xFF) << 8)
            | (ord($hash[$offset + 3]) & 0xFF);

        $code = $binary % (10 ** self::DIGITS);

        return str_pad((string) $code, self::DIGITS, '0', STR_PAD_LEFT);
    }

    private static function base32Encode(string $bytes): string
    {
        $binaryString = '';
        foreach (str_split($bytes) as $byte) {
            $binaryString .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $output = '';
        foreach (str_split($binaryString, 5) as $chunk) {
            $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            $output .= self::BASE32_ALPHABET[bindec($chunk)];
        }

        return $output;
    }

    private static function base32Decode(string $base32): string
    {
        $base32 = strtoupper(rtrim($base32, '='));
        $binaryString = '';

        foreach (str_split($base32) as $char) {
            $pos = strpos(self::BASE32_ALPHABET, $char);
            if ($pos === false) {
                continue;
            }
            $binaryString .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }

        $bytes = '';
        foreach (str_split($binaryString, 8) as $byteChunk) {
            if (strlen($byteChunk) < 8) {
                break; // trailing padding bits, not a full byte
            }
            $bytes .= chr(bindec($byteChunk));
        }

        return $bytes;
    }
}
