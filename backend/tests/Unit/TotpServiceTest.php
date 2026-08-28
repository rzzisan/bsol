<?php

namespace Tests\Unit;

use App\Services\Security\TotpService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Locks TotpService against the official RFC 6238 Appendix B test vectors
 * (SHA1 seed "12345678901234567890", 8-digit OTPs) — the 6-digit code this
 * service produces is mathematically the last 6 digits of those 8-digit
 * values (X mod 10^6 == (X mod 10^8) mod 10^6), so the vectors apply
 * directly without needing a separate 6-digit-specific source.
 */
class TotpServiceTest extends TestCase
{
    private function rfcSecret(): string
    {
        return TotpService::base32EncodeRaw('12345678901234567890');
    }

    public static function rfcVectors(): array
    {
        return [
            'T=59'          => [59, '287082'],
            'T=1111111109'  => [1111111109, '081804'],
            'T=1111111111'  => [1111111111, '050471'],
            'T=1234567890'  => [1234567890, '005924'],
            'T=2000000000'  => [2000000000, '279037'],
            'T=20000000000' => [20000000000, '353130'],
        ];
    }

    #[DataProvider('rfcVectors')]
    public function test_matches_rfc_6238_test_vectors(int $timestamp, string $expected): void
    {
        $this->assertSame($expected, TotpService::codeAt($this->rfcSecret(), $timestamp));
    }

    public function test_verify_accepts_the_correct_code_at_the_current_time(): void
    {
        $secret = TotpService::generateSecret();
        $code = TotpService::codeAt($secret);

        $this->assertTrue(TotpService::verify($secret, $code));
    }

    public function test_verify_rejects_a_wrong_code(): void
    {
        $secret = TotpService::generateSecret();
        $wrong = TotpService::codeAt($secret) === '000000' ? '111111' : '000000';

        $this->assertFalse(TotpService::verify($secret, $wrong));
    }

    public function test_verify_accepts_the_previous_time_step_within_the_window(): void
    {
        $secret = TotpService::generateSecret();
        $previousStepCode = TotpService::codeAt($secret, time() - 30);

        $this->assertTrue(TotpService::verify($secret, $previousStepCode, 1));
    }

    public function test_verify_rejects_a_code_two_steps_away(): void
    {
        $secret = TotpService::generateSecret();
        $farCode = TotpService::codeAt($secret, time() - 90);

        $this->assertFalse(TotpService::verify($secret, $farCode, 1));
    }

    public function test_verify_rejects_non_numeric_or_wrong_length_input(): void
    {
        $secret = TotpService::generateSecret();

        $this->assertFalse(TotpService::verify($secret, 'abcdef'));
        $this->assertFalse(TotpService::verify($secret, '12345'));
        $this->assertFalse(TotpService::verify($secret, ''));
    }

    public function test_base32_round_trip_produces_a_usable_secret(): void
    {
        $secret = TotpService::generateSecret();

        $this->assertMatchesRegularExpression('/^[A-Z2-7]+$/', $secret);
        $this->assertNotEmpty(TotpService::codeAt($secret));
    }

    public function test_provisioning_uri_contains_the_secret_and_issuer(): void
    {
        $uri = TotpService::provisioningUri('BSOL', 'admin@example.com', 'ABCDEFGH');

        $this->assertStringContainsString('otpauth://totp/', $uri);
        $this->assertStringContainsString('secret=ABCDEFGH', $uri);
        $this->assertStringContainsString('issuer=BSOL', $uri);
    }
}
