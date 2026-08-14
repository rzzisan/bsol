<?php

namespace Tests\Feature;

use App\Models\ShopProfile;
use App\Models\SubdomainTombstone;
use App\Models\User;
use App\Support\SubdomainPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * D2 — per-seller subdomain claim/release + availability
 * (custom_domain_context.md §5).
 */
class ShopSubdomainTest extends TestCase
{
    use RefreshDatabase;

    private function ownerWithProfile(array $profileAttrs = []): User
    {
        $user = User::factory()->create();

        ShopProfile::create(array_merge([
            'user_id' => $user->id,
            'shop_name' => 'Zareen Natural Foods',
            'phone' => '01711223344',
            'address' => 'Dhaka',
        ], $profileAttrs));

        Sanctum::actingAs($user);

        return $user;
    }

    public function test_normalize_accepts_a_pasted_host_or_mixed_case(): void
    {
        $this->assertSame('zareen', SubdomainPolicy::normalize('  Zareen  '));
        $this->assertSame('zareen', SubdomainPolicy::normalize('ZAREEN.zyrotechbd.com'));
        $this->assertSame('zareen', SubdomainPolicy::normalize('https://zareen.zyrotechbd.com/'));
        $this->assertSame('zareen', SubdomainPolicy::normalize('za reen!'));
    }

    public function test_check_reports_a_free_label_as_available_with_its_host(): void
    {
        $this->ownerWithProfile();

        $this->getJson('/api/shop-profile/subdomain/check?label=zareen')
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.reason', null)
            ->assertJsonPath('data.host', 'zareen.' . config('app.subdomain_apex'));
    }

    /**
     * The single most important rule here: a seller must never be able to
     * claim a label that already exists in the zone, or a running service
     * would be hijacked.
     */
    public function test_labels_that_exist_in_dns_are_reserved(): void
    {
        $this->ownerWithProfile();

        foreach (['mail', 'cpanel', 'webmail', 'bsol', 'www', 'catv', 'dokploy'] as $label) {
            $this->getJson('/api/shop-profile/subdomain/check?label=' . $label)
                ->assertOk()
                ->assertJsonPath('data.available', false)
                ->assertJsonPath('data.reason', 'reserved');
        }
    }

    public function test_malformed_labels_are_rejected(): void
    {
        $this->ownerWithProfile();

        $cases = [
            'ab' => 'too_short',
            '-zareen' => 'invalid_format',
            'zareen-' => 'invalid_format',
            'za--reen' => 'invalid_format',
            str_repeat('a', 64) => 'too_long',
        ];

        foreach ($cases as $label => $expected) {
            $this->getJson('/api/shop-profile/subdomain/check?label=' . $label)
                ->assertOk()
                ->assertJsonPath('data.reason', $expected, "label: {$label}");
        }
    }

    public function test_owner_can_claim_a_subdomain(): void
    {
        $user = $this->ownerWithProfile();

        $this->putJson('/api/shop-profile/subdomain', ['label' => 'Zareen'])
            ->assertOk()
            ->assertJsonPath('data.subdomain', 'zareen')
            ->assertJsonPath('data.subdomain_status', 'active');

        $this->assertDatabaseHas('shop_profiles', [
            'user_id' => $user->id,
            'subdomain' => 'zareen',
            'subdomain_status' => 'active',
        ]);
    }

    public function test_a_label_claimed_by_another_shop_is_taken(): void
    {
        $other = User::factory()->create();
        ShopProfile::create([
            'user_id' => $other->id,
            'shop_name' => 'Other', 'phone' => '01700000000', 'address' => 'Dhaka',
            'subdomain' => 'zareen', 'subdomain_status' => 'active',
        ]);

        $this->ownerWithProfile();

        $this->getJson('/api/shop-profile/subdomain/check?label=zareen')
            ->assertOk()
            ->assertJsonPath('data.reason', 'taken');

        $this->putJson('/api/shop-profile/subdomain', ['label' => 'zareen'])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'taken');
    }

    public function test_a_shop_can_recheck_and_resave_its_own_current_label(): void
    {
        $this->ownerWithProfile(['subdomain' => 'zareen', 'subdomain_status' => 'active']);

        $this->getJson('/api/shop-profile/subdomain/check?label=zareen')
            ->assertOk()
            ->assertJsonPath('data.available', true);

        $this->putJson('/api/shop-profile/subdomain', ['label' => 'zareen'])
            ->assertOk()
            ->assertJsonPath('data.subdomain', 'zareen');
    }

    /**
     * Core anti-hijack regression: changing a subdomain must tombstone the
     * old label so a different seller can never inherit its ad traffic.
     */
    public function test_changing_the_subdomain_tombstones_the_old_label_forever(): void
    {
        $user = $this->ownerWithProfile(['subdomain' => 'oldshop', 'subdomain_status' => 'active']);

        $this->putJson('/api/shop-profile/subdomain', ['label' => 'newshop'])
            ->assertOk()
            ->assertJsonPath('data.subdomain', 'newshop');

        $this->assertDatabaseHas('subdomain_tombstones', [
            'label' => 'oldshop',
            'user_id' => $user->id,
        ]);

        // Nobody — not even the seller who released it — can take it back.
        $this->getJson('/api/shop-profile/subdomain/check?label=oldshop')
            ->assertOk()
            ->assertJsonPath('data.reason', 'reserved');

        $another = User::factory()->create();
        ShopProfile::create([
            'user_id' => $another->id,
            'shop_name' => 'Another', 'phone' => '01700000001', 'address' => 'Dhaka',
        ]);
        Sanctum::actingAs($another);

        $this->putJson('/api/shop-profile/subdomain', ['label' => 'oldshop'])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'reserved');
    }

    public function test_release_tombstones_and_clears_the_subdomain(): void
    {
        $user = $this->ownerWithProfile(['subdomain' => 'zareen', 'subdomain_status' => 'active']);

        $this->deleteJson('/api/shop-profile/subdomain')
            ->assertOk()
            ->assertJsonPath('data.subdomain', null)
            ->assertJsonPath('data.subdomain_status', 'none');

        $this->assertDatabaseHas('subdomain_tombstones', ['label' => 'zareen', 'user_id' => $user->id]);
    }

    public function test_public_resolver_returns_branding_for_an_active_subdomain(): void
    {
        $user = User::factory()->create();
        ShopProfile::create([
            'user_id' => $user->id,
            'shop_name' => 'Zareen Natural Foods',
            'phone' => '01711223344', 'address' => 'Dhaka',
            'subdomain' => 'zareen', 'subdomain_status' => 'active',
        ]);

        $response = $this->getJson('/api/public/shop-by-subdomain/zareen')
            ->assertOk()
            ->assertJsonPath('data.subdomain', 'zareen')
            ->assertJsonPath('data.shop_name', 'Zareen Natural Foods');

        // No internal identifiers leak through this unauthenticated endpoint.
        $this->assertArrayNotHasKey('user_id', $response->json('data'));
    }

    public function test_public_resolver_404s_for_unknown_or_inactive_subdomains(): void
    {
        $user = User::factory()->create();
        ShopProfile::create([
            'user_id' => $user->id,
            'shop_name' => 'Paused Shop', 'phone' => '01711223344', 'address' => 'Dhaka',
            'subdomain' => 'paused', 'subdomain_status' => 'disabled',
        ]);

        $this->getJson('/api/public/shop-by-subdomain/nosuchshop')->assertStatus(404);
        $this->getJson('/api/public/shop-by-subdomain/paused')->assertStatus(404);
    }

    public function test_staff_cannot_claim_a_subdomain(): void
    {
        $owner = User::factory()->create();
        ShopProfile::create([
            'user_id' => $owner->id,
            'shop_name' => 'Zareen', 'phone' => '01711223344', 'address' => 'Dhaka',
        ]);

        $staff = User::factory()->create(['owner_id' => $owner->id]);
        Sanctum::actingAs($staff);

        $this->putJson('/api/shop-profile/subdomain', ['label' => 'zareen'])->assertStatus(403);
        $this->getJson('/api/shop-profile/subdomain/check?label=zareen')->assertStatus(403);
        $this->deleteJson('/api/shop-profile/subdomain')->assertStatus(403);
    }
}
