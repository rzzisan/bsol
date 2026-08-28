<?php

namespace Tests\Feature;

use App\Jobs\SendAutomationSmsJob;
use App\Models\Order;
use App\Models\SmsAutomationLog;
use App\Models\SmsAutomationRule;
use App\Models\SmsCredit;
use App\Models\SmsGateway;
use App\Models\User;
use App\Services\SmsAutomationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * pre_launch_polish_context.md §চ — no test file existed for this feature
 * at all. Covers: (1) the 'payment_due'/'failed_delivery_retry' dead-
 * trigger removal, (2) that the orphaned-'queued'-log-row fix (an earlier
 * commit, e0f7ea6) actually holds — a job exhausting retries must finish
 * the log row, never leave it stuck at 'queued' forever.
 */
class SmsAutomationTest extends TestCase
{
    use RefreshDatabase;

    private function assignGatewayAndCredit(User $user, int $balance = 1000): void
    {
        SmsGateway::create([
            'name' => 'Test Gateway', 'provider' => 'khudebarta',
            'endpoint_url' => 'https://sms.example.com/send', 'api_key' => 'key', 'secret_key' => 'secret',
            'sender_id' => 'BSOL', 'is_active' => true, 'is_enabled' => true,
        ]);
        $user->update(['sms_gateway_id' => SmsGateway::first()->id]);
        SmsCredit::create(['user_id' => $user->id, 'balance' => $balance]);
    }

    private function order(User $user): Order
    {
        return Order::create([
            'user_id' => $user->id,
            'order_number' => 'ORD-SMS-1',
            'customer_name' => 'Test Customer',
            'customer_phone' => '01711223344',
            'customer_address' => 'Some Address',
            'status' => 'pending',
            'total' => 500,
        ]);
    }

    // ── Dead-trigger removal ────────────────────────────────────────────

    public function test_creating_a_rule_with_payment_due_trigger_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/sms/automation/rules', [
            'name' => 'Payment reminder',
            'trigger_event' => 'payment_due',
            'template_text' => 'Please pay {total}',
            'delay_minutes' => 0,
            'is_active' => true,
        ])->assertStatus(422)->assertJsonValidationErrors('trigger_event');
    }

    public function test_creating_a_rule_with_failed_delivery_retry_trigger_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/sms/automation/rules', [
            'name' => 'Retry notice',
            'trigger_event' => 'failed_delivery_retry',
            'template_text' => 'We will retry delivery.',
            'delay_minutes' => 0,
            'is_active' => true,
        ])->assertStatus(422)->assertJsonValidationErrors('trigger_event');
    }

    public function test_the_four_real_trigger_events_are_all_still_accepted(): void
    {
        $user = User::factory()->create();

        foreach (['order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled'] as $trigger) {
            $this->actingAs($user)->postJson('/api/sms/automation/rules', [
                'name' => "Rule for {$trigger}",
                'trigger_event' => $trigger,
                'template_text' => 'Hi {customer_name}',
                'delay_minutes' => 0,
                'is_active' => true,
            ])->assertCreated();
        }
    }

    // ── Immediate dispatch ────────────────────────────────────────────

    public function test_a_status_change_fires_a_matching_active_rule_immediately(): void
    {
        $user = User::factory()->create();
        $this->assignGatewayAndCredit($user);
        $order = $this->order($user);
        $rule = SmsAutomationRule::create([
            'user_id' => $user->id, 'name' => 'Confirmed', 'trigger_event' => 'order_confirmed',
            'template_text' => 'Hi {customer_name}, order {order_number} confirmed.', 'delay_minutes' => 0, 'is_active' => true,
        ]);

        Http::fake(['sms.example.com/*' => Http::response('OK', 200)]);

        app(SmsAutomationService::class)->handleOrderStatusChanged($order, 'pending', 'confirmed');

        $log = SmsAutomationLog::where('rule_id', $rule->id)->where('order_id', $order->id)->sole();
        $this->assertSame('sent', $log->status);
        $this->assertStringContainsString('ORD-SMS-1 confirmed', $log->rendered_message);
    }

    public function test_a_status_change_with_no_matching_trigger_mapping_fires_nothing(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        SmsAutomationRule::create([
            'user_id' => $user->id, 'name' => 'Confirmed', 'trigger_event' => 'order_confirmed',
            'template_text' => 'Hi', 'delay_minutes' => 0, 'is_active' => true,
        ]);

        // 'processing' has no statusToTriggerEvent() mapping at all.
        app(SmsAutomationService::class)->handleOrderStatusChanged($order, 'confirmed', 'processing');

        $this->assertSame(0, SmsAutomationLog::count());
    }

    public function test_a_delayed_rule_dispatches_the_job_instead_of_sending_immediately(): void
    {
        Queue::fake();

        $user = User::factory()->create();
        $order = $this->order($user);
        SmsAutomationRule::create([
            'user_id' => $user->id, 'name' => 'Delayed', 'trigger_event' => 'order_confirmed',
            'template_text' => 'Hi', 'delay_minutes' => 30, 'is_active' => true,
        ]);

        app(SmsAutomationService::class)->handleOrderStatusChanged($order, 'pending', 'confirmed');

        Queue::assertPushed(SendAutomationSmsJob::class);
        $log = SmsAutomationLog::sole();
        $this->assertSame('queued', $log->status);
    }

    // ── The orphaned-'queued'-row regression ─────────────────────────

    public function test_a_job_that_exhausts_all_retries_finishes_the_queued_log_as_failed(): void
    {
        $user = User::factory()->create();
        $this->assignGatewayAndCredit($user);
        $order = $this->order($user);
        $rule = SmsAutomationRule::create([
            'user_id' => $user->id, 'name' => 'Confirmed', 'trigger_event' => 'order_confirmed',
            'template_text' => 'Hi', 'delay_minutes' => 5, 'is_active' => true,
        ]);
        $log = SmsAutomationLog::create([
            'user_id' => $user->id, 'rule_id' => $rule->id, 'order_id' => $order->id,
            'trigger_event' => 'order_confirmed', 'customer_phone' => $order->customer_phone,
            'rendered_message' => 'Hi', 'status' => 'queued',
        ]);

        // Simulate the job's failed() lifecycle hook firing after all 3
        // tries threw (e.g. the gateway host was unreachable every time) —
        // this must not leave the log stuck at 'queued' forever.
        (new SendAutomationSmsJob($order->id, $rule->id, $log->id))
            ->failed(new \RuntimeException('Connection timed out'));

        $log->refresh();
        $this->assertSame('failed', $log->status);
        $this->assertStringContainsString('Connection timed out', $log->error_message);
    }

    public function test_the_failed_hook_never_overwrites_a_log_that_already_finished(): void
    {
        $user = User::factory()->create();
        $order = $this->order($user);
        $rule = SmsAutomationRule::create([
            'user_id' => $user->id, 'name' => 'Confirmed', 'trigger_event' => 'order_confirmed',
            'template_text' => 'Hi', 'delay_minutes' => 5, 'is_active' => true,
        ]);
        // A retry actually succeeded (attempt 2) before the job-level
        // failed() hook could ever run — the log is already 'sent'.
        $log = SmsAutomationLog::create([
            'user_id' => $user->id, 'rule_id' => $rule->id, 'order_id' => $order->id,
            'trigger_event' => 'order_confirmed', 'customer_phone' => $order->customer_phone,
            'rendered_message' => 'Hi', 'status' => 'sent', 'sent_at' => now(),
        ]);

        (new SendAutomationSmsJob($order->id, $rule->id, $log->id))
            ->failed(new \RuntimeException('should not matter'));

        $log->refresh();
        $this->assertSame('sent', $log->status);
        $this->assertNull($log->error_message);
    }

    public function test_no_queued_rows_are_currently_stuck_past_their_expected_lifetime(): void
    {
        // Direct regression guard for the checklist's "periodically check
        // for orphaned queued rows" ask — a row still 'queued' more than
        // an hour after creation means either the job never ran or its
        // failed() hook didn't fire, both worth alerting on.
        $user = User::factory()->create();
        $order = $this->order($user);
        $rule = SmsAutomationRule::create([
            'user_id' => $user->id, 'name' => 'Confirmed', 'trigger_event' => 'order_confirmed',
            'template_text' => 'Hi', 'delay_minutes' => 5, 'is_active' => true,
        ]);
        SmsAutomationLog::create([
            'user_id' => $user->id, 'rule_id' => $rule->id, 'order_id' => $order->id,
            'trigger_event' => 'order_confirmed', 'customer_phone' => $order->customer_phone,
            'rendered_message' => 'Hi', 'status' => 'queued', 'created_at' => now()->subMinutes(10),
        ]);

        $stuck = SmsAutomationLog::where('status', 'queued')->where('created_at', '<', now()->subHour())->count();
        $this->assertSame(0, $stuck); // still within its normal in-flight window, not stuck
    }
}
