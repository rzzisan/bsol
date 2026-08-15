<?php

namespace Tests\Feature;

use App\Models\ReservedSubdomain;
use App\Models\ShopProfile;
use App\Models\User;
use App\Support\SubdomainPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin-side subdomain tooling: the reserved-label list
 * (custom_domain_context.md §5.3) and support impersonation (§11.5).
 */
class AdminSubdomainToolsTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function seller(?string $subdomain = null): User
    {
        $user = User::factory()->create();

        ShopProfile::create([
            'user_id' => $user->id,
            'shop_name' => 'Shop', 'phone' => '01711223344', 'address' => 'Dhaka',
            'subdomain' => $subdomain,
            'subdomain_status' => $subdomain ? 'active' : 'none',
        ]);

        return $user;
    }

    // ── reserved labels ──────────────────────────────────────────────────

    /** The migration seeds the list, so no environment starts wide open. */
    public function test_the_live_dns_labels_are_reserved_out_of_the_box(): void
    {
        foreach (['mail', 'cpanel', 'webmail', 'bsol', 'www', 'catv'] as $label) {
            $this->assertTrue(SubdomainPolicy::isReserved($label), "expected {$label} to be reserved");
        }
    }

    public function test_admin_can_reserve_a_new_label(): void
    {
        $this->admin();

        $this->postJson('/api/admin/reserved-subdomains', ['label' => 'Newbrand', 'reason' => 'Upcoming product'])
            ->assertCreated()
            ->assertJsonPath('data.label', 'newbrand')
            ->assertJsonPath('data.is_system', false);

        $this->assertTrue(SubdomainPolicy::isReserved('newbrand'));
    }

    public function test_admin_can_release_a_label_they_added(): void
    {
        $this->admin();

        $id = $this->postJson('/api/admin/reserved-subdomains', ['label' => 'temporary'])->json('data.id');

        $this->deleteJson("/api/admin/reserved-subdomains/{$id}")->assertOk();

        $this->assertFalse(SubdomainPolicy::isReserved('temporary'));
    }

    /**
     * The safety rail that survived the move out of code: releasing a label
     * that resolves in DNS would hand a seller a live service.
     */
    public function test_system_labels_cannot_be_released(): void
    {
        $this->admin();

        $mail = ReservedSubdomain::where('label', 'mail')->firstOrFail();
        $this->assertTrue($mail->is_system);

        $this->deleteJson("/api/admin/reserved-subdomains/{$mail->id}")
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'system_protected');

        $this->assertTrue(SubdomainPolicy::isReserved('mail'));
    }

    public function test_reserving_a_label_a_shop_is_already_using_is_refused(): void
    {
        $this->seller('zareen');
        $this->admin();

        $this->postJson('/api/admin/reserved-subdomains', ['label' => 'zareen'])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'in_use');
    }

    public function test_duplicate_labels_are_refused(): void
    {
        $this->admin();

        $this->postJson('/api/admin/reserved-subdomains', ['label' => 'mail'])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'already_reserved');
    }

    public function test_sellers_cannot_reach_the_reserved_list(): void
    {
        Sanctum::actingAs($this->seller());

        $this->getJson('/api/admin/reserved-subdomains')->assertStatus(403);
        $this->postJson('/api/admin/reserved-subdomains', ['label' => 'x'])->assertStatus(403);
    }

    // ── impersonation ────────────────────────────────────────────────────

    public function test_admin_can_impersonate_a_seller(): void
    {
        $seller = $this->seller('zareen');
        $admin = $this->admin();

        $token = $this->postJson("/api/admin/users/{$seller->id}/impersonate")
            ->assertOk()
            ->assertJsonPath('data.user.id', $seller->id)
            ->json('data.token');

        $this->assertNotEmpty($token);

        // Sanctum::actingAs pins the resolved user for the whole test, so it
        // has to be cleared before the Bearer token gets a say — otherwise
        // this would assert nothing.
        $this->app['auth']->forgetGuards();

        // The token really acts as the seller.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/shop-profile')
            ->assertOk()
            ->assertJsonPath('data.user_id', $seller->id);

        // Traceable afterwards without needing the log file.
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $seller->id,
            'name' => "impersonation:admin-{$admin->id}",
        ]);
    }

    public function test_impersonation_tokens_expire(): void
    {
        $seller = $this->seller();
        $this->admin();

        $this->postJson("/api/admin/users/{$seller->id}/impersonate")->assertOk();

        $this->assertNotNull(
            \DB::table('personal_access_tokens')->where('tokenable_id', $seller->id)->value('expires_at'),
        );
    }

    /** Impersonation is for looking at seller accounts, not borrowing admin rights. */
    public function test_admins_cannot_impersonate_other_admins(): void
    {
        $other = User::factory()->create(['role' => 'admin']);
        $this->admin();

        $this->postJson("/api/admin/users/{$other->id}/impersonate")
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'target_is_admin');
    }

    public function test_sellers_cannot_impersonate_anyone(): void
    {
        $victim = $this->seller();
        Sanctum::actingAs($this->seller());

        $this->postJson("/api/admin/users/{$victim->id}/impersonate")->assertStatus(403);
    }
}
