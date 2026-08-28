<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * pre_launch_polish_context.md §ঠ / domain_security_audit.md §I-2 — CORS
 * used to accept any origin (`Access-Control-Allow-Origin: *`). Not a
 * token-leak path by itself (the Bearer token lives in localStorage,
 * origin-scoped, and supports_credentials stays false) but tightened as
 * defense-in-depth now that the seller-subdomain set is a known, closed
 * shape — see config/cors.php.
 */
class CorsPolicyTest extends TestCase
{
    public function test_the_platform_apex_is_allowed(): void
    {
        $response = $this->withHeaders(['Origin' => 'https://bsol.zyrotechbd.com'])
            ->getJson('/api/health');

        $response->assertHeader('Access-Control-Allow-Origin', 'https://bsol.zyrotechbd.com');
    }

    public function test_any_seller_subdomain_is_allowed(): void
    {
        $response = $this->withHeaders(['Origin' => 'https://zareen.zyrotechbd.com'])
            ->getJson('/api/health');

        $response->assertHeader('Access-Control-Allow-Origin', 'https://zareen.zyrotechbd.com');
    }

    public function test_a_hyphenated_subdomain_label_is_allowed(): void
    {
        $response = $this->withHeaders(['Origin' => 'https://my-shop-2.zyrotechbd.com'])
            ->getJson('/api/health');

        $response->assertHeader('Access-Control-Allow-Origin', 'https://my-shop-2.zyrotechbd.com');
    }

    public function test_an_unrelated_origin_is_rejected(): void
    {
        $response = $this->withHeaders(['Origin' => 'https://evil.example.com'])
            ->getJson('/api/health');

        $response->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_a_lookalike_domain_is_rejected(): void
    {
        // e.g. "zyrotechbd.com.evil.com" or "notzyrotechbd.com" must not
        // satisfy the pattern just because it contains the apex string.
        $response = $this->withHeaders(['Origin' => 'https://zyrotechbd.com.evil.com'])
            ->getJson('/api/health');

        $response->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_credentials_are_still_never_supported(): void
    {
        $response = $this->withHeaders(['Origin' => 'https://bsol.zyrotechbd.com'])
            ->getJson('/api/health');

        $response->assertHeaderMissing('Access-Control-Allow-Credentials');
    }
}
