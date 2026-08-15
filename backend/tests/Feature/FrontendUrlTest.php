<?php

namespace Tests\Feature;

use App\Models\ShopProfile;
use App\Models\User;
use App\Support\FrontendUrl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Browser-facing URLs follow the seller's own address once they have one
 * (custom_domain_context.md §15).
 */
class FrontendUrlTest extends TestCase
{
    use RefreshDatabase;

    private function shop(?string $subdomain): User
    {
        $user = User::factory()->create();

        ShopProfile::create([
            'user_id' => $user->id,
            'shop_name' => 'Shop',
            'phone' => '01711223344',
            'address' => 'Dhaka',
            'subdomain' => $subdomain,
            'subdomain_status' => $subdomain ? 'active' : 'none',
        ]);

        return $user;
    }

    public function test_falls_back_to_the_platform_for_a_shop_without_a_subdomain(): void
    {
        $this->assertSame(FrontendUrl::platform(), FrontendUrl::forUser($this->shop(null)));
    }

    public function test_uses_the_shops_own_address_when_it_has_one(): void
    {
        $user = $this->shop('zareen');

        $this->assertSame(
            'https://zareen.' . config('app.subdomain_apex'),
            FrontendUrl::forUser($user),
        );
    }

    public function test_staff_follow_their_owners_address(): void
    {
        $owner = $this->shop('zareen');
        $staff = User::factory()->create(['owner_id' => $owner->id]);

        $this->assertSame(
            'https://zareen.' . config('app.subdomain_apex'),
            FrontendUrl::forUser($staff),
        );
    }

    /** Registration and other pre-shop flows have no user to resolve. */
    public function test_null_user_resolves_to_the_platform(): void
    {
        $this->assertSame(FrontendUrl::platform(), FrontendUrl::forUser(null));
    }

    public function test_path_helper_joins_without_doubling_slashes(): void
    {
        $user = $this->shop('zareen');
        $apex = config('app.subdomain_apex');

        $this->assertSame("https://zareen.{$apex}/verify-email", FrontendUrl::forUserPath($user, 'verify-email'));
        $this->assertSame("https://zareen.{$apex}/verify-email", FrontendUrl::forUserPath($user, '/verify-email'));
    }

    /**
     * The whole point of resolving from the user rather than the request:
     * these URLs end up in emails and payment-gateway callbacks, so a
     * spoofed Host header must not be able to steer them.
     */
    public function test_a_spoofed_host_header_cannot_steer_the_url(): void
    {
        $user = $this->shop('zareen');

        $this->app['request']->headers->set('Host', 'evil.example.com');

        $this->assertSame(
            'https://zareen.' . config('app.subdomain_apex'),
            FrontendUrl::forUser($user),
        );
    }
}
