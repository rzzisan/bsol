<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\StaffPermission;
use App\Models\SubscriptionPackage;
use App\Models\User;
use App\Models\WhatsappAutomationLog;
use App\Models\WhatsappAutomationRule;
use App\Models\WhatsappBusinessConnection;
use App\Models\WhatsappMessage;
use App\Services\OrderStatusService;
use App\Services\Whatsapp\WhatsappMessageCaptureService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * WhatsApp Business integration — connection (owner-only credential
 * paste), inbound webhook capture + wa_id customer auto-link, order-status
 * automation, and the 2-way inbox. See whatsapp_context.md.
 */
class WhatsappTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        $package = SubscriptionPackage::create([
            'name' => 'Test', 'slug' => 'test-' . uniqid(), 'price' => 0, 'duration_days' => 30,
        ]);

        return User::factory()->create(['subscription_package_id' => $package->id]);
    }

    private function connectedConnection(User $owner, array $overrides = []): WhatsappBusinessConnection
    {
        return WhatsappBusinessConnection::create(array_merge([
            'user_id' => $owner->id,
            'phone_number_id' => 'PNID123',
            'access_token' => 'token-secret',
            'status' => 'connected',
        ], $overrides));
    }

    private function order(User $owner, array $overrides = []): Order
    {
        $order = Order::create(array_merge([
            'user_id' => $owner->id,
            'order_number' => 'ORD-' . uniqid(),
            'public_token' => bin2hex(random_bytes(24)),
            'customer_name' => 'Karim Uddin',
            'customer_phone' => '01712345678',
            'subtotal' => 1000, 'shipping_charge' => 120, 'discount' => 0, 'total' => 1120,
            'status' => 'pending',
        ], $overrides));

        $product = Product::create([
            'user_id' => $owner->id, 'name' => 'Test Product', 'sku' => 'TP-' . uniqid(),
            'selling_price' => 1000, 'stock' => 100, 'track_stock' => false, 'status' => 'active',
        ]);

        OrderItem::create([
            'order_id' => $order->id, 'product_id' => $product->id,
            'product_name' => 'Test Product', 'quantity' => 1, 'unit_price' => 1000, 'total' => 1000,
        ]);

        return $order->fresh();
    }

    // ── Connection (owner-only) ─────────────────────────────────────────

    public function test_owner_can_save_and_read_masked_connection(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        Http::fake(['*/WABA1/subscribed_apps' => Http::response(['success' => true])]);

        $this->putJson('/api/whatsapp/connection', [
            'phone_number_id' => 'PNID123',
            'waba_id' => 'WABA1',
            'access_token' => 'secret-token',
        ])->assertOk()->assertJsonPath('data.access_token_set', true)->assertJsonPath('data.last_error', null);

        $response = $this->getJson('/api/whatsapp/connection')->assertOk();
        $response->assertJsonPath('data.phone_number_id', 'PNID123');
        $response->assertJsonMissingPath('data.access_token');
    }

    public function test_save_still_succeeds_but_warns_when_the_webhook_subscribe_call_fails(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        Http::fake(['*/WABA1/subscribed_apps' => Http::response([], 400)]);

        $response = $this->putJson('/api/whatsapp/connection', [
            'phone_number_id' => 'PNID123',
            'waba_id' => 'WABA1',
            'access_token' => 'secret-token',
        ])->assertOk();

        $this->assertNotNull($response->json('data.last_error'));
        $this->assertSame('connected', WhatsappBusinessConnection::where('user_id', $owner->id)->first()->status);
    }

    public function test_saving_without_a_waba_id_is_rejected(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/whatsapp/connection', [
            'phone_number_id' => 'PNID123',
            'access_token' => 'secret-token',
        ])->assertStatus(422);
    }

    public function test_staff_cannot_reach_connection_routes(): void
    {
        $owner = $this->owner();
        $staff = User::factory()->create(['owner_id' => $owner->id]);
        Sanctum::actingAs($staff);

        $this->getJson('/api/whatsapp/connection')->assertStatus(403);
    }

    public function test_test_send_reports_failure_without_short_circuiting(): void
    {
        $owner = $this->owner();
        $this->connectedConnection($owner);
        Sanctum::actingAs($owner);

        Http::fake(['*/PNID123/messages' => Http::response([], 400)]);

        $this->postJson('/api/whatsapp/connection/test-send', ['to' => '8801700000000'])
            ->assertOk()
            ->assertJson(['success' => false]);
    }

    // ── Inbound webhook capture ──────────────────────────────────────────

    public function test_inbound_message_is_captured_and_auto_links_customer_by_wa_id(): void
    {
        $owner = $this->owner();
        $connection = $this->connectedConnection($owner);

        $payload = [
            'object' => 'whatsapp_business_account',
            'entry' => [[
                'id' => 'WABA1',
                'changes' => [[
                    'field' => 'messages',
                    'value' => [
                        'metadata' => ['phone_number_id' => 'PNID123'],
                        'contacts' => [['profile' => ['name' => 'Karim'], 'wa_id' => '8801712345678']],
                        'messages' => [[
                            'id' => 'wamid.INBOUND1',
                            'from' => '8801712345678',
                            'type' => 'text',
                            'text' => ['body' => 'Hi, is this in stock?'],
                        ]],
                    ],
                ]],
            ]],
        ];

        app(WhatsappMessageCaptureService::class)->handle($payload);

        $message = WhatsappMessage::where('wa_message_id', 'wamid.INBOUND1')->first();
        $this->assertNotNull($message);
        $this->assertSame($connection->id, $message->whatsapp_business_connection_id);
        $this->assertSame('Hi, is this in stock?', $message->body);

        $customer = Customer::where('user_id', $owner->id)->where('phone', '01712345678')->first();
        $this->assertNotNull($customer);
        $this->assertSame($customer->id, $message->customer_id);
    }

    public function test_redelivered_inbound_message_is_not_duplicated(): void
    {
        $owner = $this->owner();
        $this->connectedConnection($owner);

        $payload = [
            'object' => 'whatsapp_business_account',
            'entry' => [[
                'id' => 'WABA1',
                'changes' => [[
                    'field' => 'messages',
                    'value' => [
                        'metadata' => ['phone_number_id' => 'PNID123'],
                        'messages' => [['id' => 'wamid.DUPE', 'from' => '8801712345678', 'type' => 'text', 'text' => ['body' => 'hi']]],
                    ],
                ]],
            ]],
        ];

        $service = app(WhatsappMessageCaptureService::class);
        $service->handle($payload);
        $service->handle($payload);

        $this->assertSame(1, WhatsappMessage::where('wa_message_id', 'wamid.DUPE')->count());
    }

    public function test_delivery_status_event_updates_the_matching_outbound_row(): void
    {
        $owner = $this->owner();
        $connection = $this->connectedConnection($owner);

        $outbound = WhatsappMessage::create([
            'user_id' => $owner->id,
            'whatsapp_business_connection_id' => $connection->id,
            'direction' => 'outbound',
            'wa_message_id' => 'wamid.OUT1',
            'wa_id' => '8801712345678',
            'message_type' => 'template',
            'status' => 'sent',
        ]);

        app(WhatsappMessageCaptureService::class)->handle([
            'object' => 'whatsapp_business_account',
            'entry' => [[
                'id' => 'WABA1',
                'changes' => [[
                    'field' => 'messages',
                    'value' => [
                        'metadata' => ['phone_number_id' => 'PNID123'],
                        'statuses' => [['id' => 'wamid.OUT1', 'status' => 'delivered']],
                    ],
                ]],
            ]],
        ]);

        $this->assertSame('delivered', $outbound->fresh()->status);
    }

    public function test_unrelated_object_payload_is_ignored(): void
    {
        app(WhatsappMessageCaptureService::class)->handle(['object' => 'page', 'entry' => []]);

        $this->assertSame(0, WhatsappMessage::count());
    }

    // ── Order-status automation ──────────────────────────────────────────

    public function test_order_confirmed_sends_the_mapped_template(): void
    {
        $owner = $this->owner();
        $this->connectedConnection($owner);
        $order = $this->order($owner);

        WhatsappAutomationRule::create([
            'user_id' => $owner->id,
            'name' => 'Confirm',
            'trigger_event' => 'order_confirmed',
            'template_name' => 'order_confirmed_v1',
            'language_code' => 'en_US',
            'variable_mapping' => ['customer_name', 'order_number'],
            'delay_minutes' => 0,
            'is_active' => true,
        ]);

        Http::fake(['*/PNID123/messages' => Http::response(['messages' => [['id' => 'wamid.SENT1']]])]);

        app(OrderStatusService::class)->transition($order, 'confirmed');

        Http::assertSent(function ($request) use ($order) {
            $body = $request->data();
            return $body['template']['name'] === 'order_confirmed_v1'
                && $body['template']['components'][0]['parameters'][0]['text'] === $order->customer_name
                && $body['template']['components'][0]['parameters'][1]['text'] === $order->order_number;
        });

        $this->assertSame(1, WhatsappMessage::where('direction', 'outbound')->count());
        $log = WhatsappAutomationLog::where('order_id', $order->id)->first();
        $this->assertSame('sent', $log->status);
    }

    public function test_a_second_status_change_to_the_same_trigger_does_not_double_send(): void
    {
        $owner = $this->owner();
        $this->connectedConnection($owner);
        $order = $this->order($owner);

        WhatsappAutomationRule::create([
            'user_id' => $owner->id, 'name' => 'Confirm', 'trigger_event' => 'order_confirmed',
            'template_name' => 'order_confirmed_v1', 'variable_mapping' => [], 'is_active' => true,
        ]);

        Http::fake(['*/PNID123/messages' => Http::response(['messages' => [['id' => 'wamid.SENT2']]])]);

        $service = app(OrderStatusService::class);
        $service->transition($order, 'confirmed');
        // Simulate a re-triggered handleOrderStatusChanged for the exact
        // same order+rule+trigger (the claim-index guard this mirrors from
        // SmsAutomationLog) without a real second confirmed transition,
        // since transition() itself no-ops on old===new.
        app(\App\Services\Whatsapp\WhatsappAutomationService::class)->handleOrderStatusChanged($order, 'pending', 'confirmed');

        $this->assertSame(1, WhatsappAutomationLog::where('order_id', $order->id)->where('status', 'sent')->count());
        $this->assertSame(1, WhatsappAutomationLog::where('order_id', $order->id)->where('status', 'skipped')->count());
    }

    public function test_automation_fails_cleanly_when_whatsapp_is_not_connected(): void
    {
        $owner = $this->owner();
        $order = $this->order($owner);

        WhatsappAutomationRule::create([
            'user_id' => $owner->id, 'name' => 'Confirm', 'trigger_event' => 'order_confirmed',
            'template_name' => 'order_confirmed_v1', 'variable_mapping' => [], 'is_active' => true,
        ]);

        app(OrderStatusService::class)->transition($order, 'confirmed');

        $log = WhatsappAutomationLog::where('order_id', $order->id)->first();
        $this->assertSame('failed', $log->status);
        $this->assertSame('WhatsApp is not connected.', $log->error_message);
    }

    // ── Inbox reply ──────────────────────────────────────────────────────

    public function test_reply_within_window_creates_an_outbound_row(): void
    {
        $owner = $this->owner();
        $this->connectedConnection($owner);
        Sanctum::actingAs($owner);

        Http::fake(['*/PNID123/messages' => Http::response(['messages' => [['id' => 'wamid.REPLY1']]])]);

        $this->postJson('/api/whatsapp/messages/thread/8801712345678/reply', ['message' => 'Yes, in stock!'])
            ->assertOk()->assertJson(['success' => true]);

        $this->assertSame(1, WhatsappMessage::where('wa_message_id', 'wamid.REPLY1')->count());
    }

    public function test_reply_outside_window_surfaces_a_clean_422(): void
    {
        $owner = $this->owner();
        $this->connectedConnection($owner);
        Sanctum::actingAs($owner);

        Http::fake(['*/PNID123/messages' => Http::response(['error' => ['message' => 're-engagement message']], 400)]);

        $this->postJson('/api/whatsapp/messages/thread/8801712345678/reply', ['message' => 'Yes, in stock!'])
            ->assertStatus(422);
    }

    public function test_staff_with_whatsapp_permission_can_read_messages(): void
    {
        $owner = $this->owner();
        $this->connectedConnection($owner);
        $staff = User::factory()->create(['owner_id' => $owner->id, 'staff_status' => 'active']);
        StaffPermission::create(['user_id' => $staff->id, 'module_key' => 'whatsapp', 'enabled' => true]);
        Sanctum::actingAs($staff);

        $this->getJson('/api/whatsapp/messages')->assertOk();
    }

    public function test_staff_without_whatsapp_permission_is_refused(): void
    {
        $owner = $this->owner();
        $staff = User::factory()->create(['owner_id' => $owner->id]);
        Sanctum::actingAs($staff);

        $this->getJson('/api/whatsapp/messages')->assertStatus(403);
    }
}
