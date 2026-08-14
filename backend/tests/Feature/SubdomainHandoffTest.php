<?php

namespace Tests\Feature;

use App\Models\ShopProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * D3 — moving a logged-in session from bsol.zyrotechbd.com to the seller's
 * own subdomain via a single-use code (custom_domain_context.md §6).
 */
class SubdomainHandoffTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    private function seller(?string $subdomain, array $userAttrs = []): User
    {
        $user = User::factory()->create(array_merge([
            'password' => Hash::make(self::PASSWORD),
        ], $userAttrs));

        ShopProfile::create([
            'user_id' => $user->id,
            'shop_name' => 'Zareen Natural Foods',
            'phone' => '01711223344',
            'address' => 'Dhaka',
            'subdomain' => $subdomain,
            'subdomain_status' => $subdomain ? 'active' : 'none',
        ]);

        return $user;
    }

    /**
     * Absolute URLs, not withHeader('Host', ...): Symfony's Request::create()
     * derives HTTP_HOST from the URI and overwrites any server var, so a Host
     * header set on a relative path is silently ignored and every request
     * would land on 'localhost'.
     */
    private function login(User $user, string $host = 'bsol.zyrotechbd.com')
    {
        return $this->postJson("https://{$host}/api/login", [
            'email' => $user->email,
            'password' => self::PASSWORD,
        ]);
    }

    private function exchange(string $host, string $code)
    {
        return $this->postJson("https://{$host}/api/auth/handoff/exchange", ['code' => $code]);
    }

    /** @return string the handoff code */
    private function codeFromRedirect(string $redirectTo): string
    {
        parse_str(parse_url($redirectTo, PHP_URL_QUERY) ?: '', $query);

        return $query['code'] ?? '';
    }

    public function test_seller_without_a_subdomain_logs_in_normally(): void
    {
        $user = $this->seller(null);

        $this->login($user)
            ->assertOk()
            ->assertJsonStructure(['token', 'user'])
            ->assertJsonMissingPath('redirect_to');
    }

    /**
     * The core of the design: no token is minted on the origin the seller is
     * being redirected away from.
     */
    public function test_seller_with_a_subdomain_gets_a_redirect_and_no_token(): void
    {
        $user = $this->seller('zareen');

        $response = $this->login($user)->assertOk()->assertJsonMissingPath('token');

        $this->assertStringStartsWith(
            'https://zareen.' . config('app.subdomain_apex') . '/auth/handoff?code=',
            $response->json('redirect_to'),
        );
    }

    public function test_no_redirect_when_already_on_the_sellers_own_subdomain(): void
    {
        $user = $this->seller('zareen');

        $this->login($user, 'zareen.' . config('app.subdomain_apex'))
            ->assertOk()
            ->assertJsonStructure(['token'])
            ->assertJsonMissingPath('redirect_to');
    }

    /**
     * Admins must never land on an origin that also serves seller-authored
     * landing-page HTML — custom_domain_context.md §9 rule 3.
     */
    public function test_admins_are_never_redirected(): void
    {
        $admin = $this->seller('zareen', ['role' => 'admin']);

        $this->login($admin)
            ->assertOk()
            ->assertJsonStructure(['token'])
            ->assertJsonMissingPath('redirect_to');
    }

    public function test_exchanging_the_code_on_the_target_host_returns_a_token(): void
    {
        $user = $this->seller('zareen');
        $host = 'zareen.' . config('app.subdomain_apex');
        $code = $this->codeFromRedirect($this->login($user)->json('redirect_to'));

        $this->exchange($host, $code)
            ->assertOk()
            ->assertJsonStructure(['token', 'user'])
            ->assertJsonPath('user.id', $user->id);
    }

    public function test_a_code_can_only_be_used_once(): void
    {
        $user = $this->seller('zareen');
        $host = 'zareen.' . config('app.subdomain_apex');
        $code = $this->codeFromRedirect($this->login($user)->json('redirect_to'));

        $this->exchange($host, $code)->assertOk();

        $this->exchange($host, $code)
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'handoff_invalid');
    }

    /**
     * Replay protection: a code leaked from a URL must be useless anywhere
     * other than the host it was minted for.
     */
    public function test_a_code_is_rejected_on_a_different_host(): void
    {
        $user = $this->seller('zareen');
        $code = $this->codeFromRedirect($this->login($user)->json('redirect_to'));

        $this->exchange('attacker.' . config('app.subdomain_apex'), $code)
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'handoff_invalid');

        // Still unusable afterwards on the correct host — a rejected attempt
        // consumes the code rather than leaving it replayable.
        $this->exchange('zareen.' . config('app.subdomain_apex'), $code)
            ->assertStatus(422);
    }

    public function test_unknown_code_is_rejected(): void
    {
        $this->exchange('zareen.' . config('app.subdomain_apex'), str_repeat('x', 64))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'handoff_invalid');
    }

    public function test_suspended_staff_cannot_exchange_a_code(): void
    {
        $owner = $this->seller('zareen');
        $host = 'zareen.' . config('app.subdomain_apex');

        $staff = User::factory()->create([
            'password' => Hash::make(self::PASSWORD),
            'owner_id' => $owner->id,
            'staff_status' => 'active',
        ]);

        $code = $this->codeFromRedirect($this->login($staff)->json('redirect_to'));

        $staff->update(['staff_status' => 'suspended']);

        $this->exchange($host, $code)
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'staff_suspended');
    }

    public function test_staff_are_redirected_to_their_owners_subdomain(): void
    {
        $owner = $this->seller('zareen');

        $staff = User::factory()->create([
            'password' => Hash::make(self::PASSWORD),
            'owner_id' => $owner->id,
            'staff_status' => 'active',
        ]);

        $this->assertStringStartsWith(
            'https://zareen.' . config('app.subdomain_apex') . '/auth/handoff?code=',
            $this->login($staff)->json('redirect_to'),
        );
    }
}
