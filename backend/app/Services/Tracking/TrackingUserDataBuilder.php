<?php

namespace App\Services\Tracking;

/**
 * Turns raw customer details into Meta's user_data shape
 * (tracking_capi_context.md §3.3).
 *
 * This exists as one class for one reason: Meta matches on the hash, so if
 * two call sites normalise a phone number differently they produce different
 * digests for the same person and the match silently degrades — no error,
 * just worse ad performance that nobody can trace. Every producer of
 * user_data goes through here.
 *
 * Two rules the output must always satisfy:
 *  - PII is sha256 of the *normalised* value, never the raw one.
 *  - fbp / fbc / ip / user agent are sent raw. Hashing them makes them
 *    useless to Meta.
 */
class TrackingUserDataBuilder
{
    /** Hashed identity fields, in the order Meta documents them. */
    private const HASHED = ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'external_id'];

    /** Passed through untouched. */
    private const RAW = ['fbp', 'fbc', 'client_ip_address', 'client_user_agent'];

    /**
     * @param  array<string, mixed>  $input  Raw values keyed by Meta field name.
     * @return array<string, mixed>
     */
    public function build(array $input): array
    {
        $out = [];

        foreach (self::HASHED as $field) {
            $normalized = $this->normalize($field, $input[$field] ?? null);

            if ($normalized !== null && $normalized !== '') {
                // Meta accepts an array per field so several values (two
                // phone numbers, say) can be matched; single-element arrays
                // keep that door open without a shape change later.
                $out[$field] = [hash('sha256', $normalized)];
            }
        }

        foreach (self::RAW as $field) {
            $value = $input[$field] ?? null;

            if (is_string($value) && $value !== '') {
                $out[$field] = $value;
            }
        }

        return $out;
    }

    /**
     * Derive _fbc from a click id when the cookie is missing — a visitor
     * landing from an ad has fbclid in the URL before Meta's own script has
     * had a chance to write the cookie, and on a first page view that is
     * often the only attribution signal available.
     */
    public function fbcFromClickId(?string $fbclid, ?int $timestampMs = null): ?string
    {
        if (! $fbclid) {
            return null;
        }

        return 'fb.1.' . ($timestampMs ?? (int) (microtime(true) * 1000)) . '.' . $fbclid;
    }

    private function normalize(string $field, mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $value = (string) $value;

        return match ($field) {
            'ph' => $this->normalizePhone($value),
            'em' => mb_strtolower(trim($value)),
            // Letters only: "Md. Rahim" and "md rahim" have to hash alike.
            'fn', 'ln' => preg_replace('/[^\p{L}]/u', '', mb_strtolower(trim($value))) ?? '',
            'ct', 'st' => preg_replace('/[^\p{L}\p{N}]/u', '', mb_strtolower(trim($value))) ?? '',
            'zp' => preg_replace('/[^\p{N}a-z]/u', '', mb_strtolower(trim($value))) ?? '',
            'country' => mb_substr(preg_replace('/[^a-z]/', '', mb_strtolower(trim($value))) ?? '', 0, 2),
            default => trim($value),
        };
    }

    /**
     * Bangladeshi numbers to E.164 digits without the plus, matching what
     * SendFacebookCapiPurchaseEventJob already sends so events from the old
     * and new pipelines hash to the same value.
     */
    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';

        if ($digits === '') {
            return '';
        }

        if (str_starts_with($digits, '880')) {
            return $digits;
        }

        return '880' . ltrim($digits, '0');
    }
}
