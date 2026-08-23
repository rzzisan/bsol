<?php

namespace Tests\Feature;

use App\Models\AddonPackage;
use App\Models\AddonPurchase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Order-credit add-on — seller-facing purchase flow + super-admin
 * package/approve management. subscription_billing_context.md §9.2-B,
 * §9.4, §9.6 step 3.
 */
class OrderCreditAddonApiTest extends TestCase
{
    use RefreshDatabase;

    private function orderCreditPackage(array $overrides = []): AddonPackage
    {
        return AddonPackage::create(array_merge([
            'type' => 'order_credit', 'name' => '50 Orders / 1 Month',
            'price' => 50, 'quantity' => 50, 'duration_days' => 30, 'is_active' => true,
        ], $overrides));
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    // ── Seller-facing ────────────────────────────────────────────────────

    public function test_packages_lists_only_active_order_credit_packages(): void
    {
        $active = $this->orderCreditPackage();
        $this->orderCreditPackage(['is_active' => false, 'name' => 'Inactive']);

        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $res = $this->getJson('/api/order-credits/packages')->assertOk();
        $names = collect($res->json('data'))->pluck('name')->all();

        $this->assertContains($active->name, $names);
        $this->assertNotContains('Inactive', $names);
    }

    public function test_balance_reports_zero_with_no_wallet_yet(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $this->getJson('/api/order-credits/balance')
            ->assertOk()
            ->assertJsonPath('data.available_balance', 0);
    }

    public function test_submit_payment_computes_amount_server_side_from_the_package(): void
    {
        $package = $this->orderCreditPackage(['price' => 75]);
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $res = $this->postJson('/api/order-credits/purchases', [
            'addon_package_id' => $package->id,
            'sender_bkash_number' => '01711111111',
            'trx_id' => 'TRXTEST123',
        ])->assertCreated();

        $this->assertSame('75.00', $res->json('data.amount'));
        $this->assertSame('pending', $res->json('data.status'));
    }

    public function test_duplicate_trx_id_is_rejected(): void
    {
        $package = $this->orderCreditPackage();
        AddonPurchase::create([
            'user_id' => User::factory()->create()->id, 'addon_package_id' => $package->id,
            'amount' => 50, 'trx_id' => 'DUPLICATE1', 'status' => 'pending',
        ]);

        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $this->postJson('/api/order-credits/purchases', [
            'addon_package_id' => $package->id,
            'sender_bkash_number' => '01711111111',
            'trx_id' => 'DUPLICATE1',
        ])->assertStatus(422);
    }

    public function test_staff_cannot_purchase_order_credit(): void
    {
        $owner = User::factory()->create();
        $staff = User::factory()->create(['owner_id' => $owner->id, 'role' => 'user', 'staff_status' => 'active']);
        Sanctum::actingAs($staff);

        $this->getJson('/api/order-credits/balance')->assertStatus(403);
    }

    // ── Admin ────────────────────────────────────────────────────────────

    public function test_admin_can_create_an_order_credit_package(): void
    {
        Sanctum::actingAs($this->admin());

        $res = $this->postJson('/api/admin/addon-packages', [
            'type' => 'order_credit', 'name' => '50 Orders / 1 Month',
            'price' => 50, 'quantity' => 50, 'duration_days' => 30,
        ])->assertCreated();

        $this->assertSame('order_credit', $res->json('package.type'));
    }

    public function test_admin_cannot_create_a_not_yet_wired_addon_type(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/admin/addon-packages', [
            'type' => 'landing_page', 'name' => 'Extra Landing Page',
            'price' => 100, 'quantity' => 1, 'duration_days' => 30,
        ])->assertStatus(422);
    }

    public function test_non_admin_is_denied(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/admin/addon-packages')->assertForbidden();
    }

    public function test_approve_grants_credits_to_the_wallet_and_is_idempotent(): void
    {
        $package = $this->orderCreditPackage(['quantity' => 50, 'duration_days' => 30]);
        $seller = User::factory()->create();
        $purchase = AddonPurchase::create([
            'user_id' => $seller->id, 'addon_package_id' => $package->id,
            'amount' => 50, 'trx_id' => 'APPROVEME1', 'status' => 'pending',
        ]);

        Sanctum::actingAs($this->admin());

        $this->postJson("/api/admin/addon-purchases/{$purchase->id}/approve")->assertOk();
        $this->assertSame(50, app(\App\Services\OrderCreditService::class)->getAvailableBalance($seller->id));

        // Re-approving an already-approved purchase is rejected at the
        // status guard (not pending any more) — never double-grants.
        $this->postJson("/api/admin/addon-purchases/{$purchase->id}/approve")->assertStatus(422);
        $this->assertSame(50, app(\App\Services\OrderCreditService::class)->getAvailableBalance($seller->id));
    }

    public function test_apply_service_itself_is_idempotent_not_just_the_controller_guard(): void
    {
        // Regression test for a real bug caught live-verifying this
        // feature: `applied_at` was missing from AddonPurchase's Fillable,
        // so AddonApplyService::apply()'s own idempotency stamp silently
        // no-op'd — masked in the normal flow only because the controller
        // has its own separate status!=='pending' guard. This calls
        // apply() directly, twice, bypassing that controller guard
        // entirely, so it actually exercises AddonApplyService's stamp.
        $package = $this->orderCreditPackage(['quantity' => 10, 'duration_days' => 30]);
        $seller = User::factory()->create();
        $purchase = AddonPurchase::create([
            'user_id' => $seller->id, 'addon_package_id' => $package->id,
            'amount' => 50, 'trx_id' => 'IDEMPOTENT1', 'status' => 'approved',
        ]);

        $service = app(\App\Services\AddonApplyService::class);
        $service->apply($purchase);
        $this->assertNotNull($purchase->fresh()->applied_at);

        $service->apply($purchase->fresh());
        $this->assertSame(10, app(\App\Services\OrderCreditService::class)->getAvailableBalance($seller->id));
    }

    public function test_reject_records_admin_note_and_grants_nothing(): void
    {
        $package = $this->orderCreditPackage();
        $seller = User::factory()->create();
        $purchase = AddonPurchase::create([
            'user_id' => $seller->id, 'addon_package_id' => $package->id,
            'amount' => 50, 'trx_id' => 'REJECTME1', 'status' => 'pending',
        ]);

        Sanctum::actingAs($this->admin());

        $this->postJson("/api/admin/addon-purchases/{$purchase->id}/reject", [
            'admin_note' => 'Screenshot did not match trx id.',
        ])->assertOk()->assertJsonPath('data.status', 'rejected');

        $this->assertSame(0, app(\App\Services\OrderCreditService::class)->getAvailableBalance($seller->id));
    }
}
