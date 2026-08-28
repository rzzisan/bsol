<?php

namespace Tests\Feature;

use App\Jobs\GenerateAiSupportReplyJob;
use App\Models\PlatformAiSupportSetting;
use App\Models\SupportConversation;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Support\AiSupportAgentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Support ticketing (alongside live chat, not replacing it) + the AI agent's
 * guard rails — support_ticketing_ai_context.md. Deliberately does not mock
 * the Anthropic SDK to test actual reply content (not unit-testable, verified
 * live instead per the build plan) — these tests cover the surrounding logic:
 * ticket lifecycle/authorization, the AI-dispatch guards, and the on/off +
 * daily-cap settings, none of which ever reach the real API.
 */
class SupportTicketingTest extends TestCase
{
    use RefreshDatabase;

    // -- Ticket lifecycle / authorization ------------------------------------

    public function test_seller_can_open_a_ticket_and_it_gets_a_readable_number(): void
    {
        Bus::fake();
        $seller = User::factory()->create(['role' => 'user']);
        Sanctum::actingAs($seller);

        $response = $this->postJson('/api/tickets', [
            'subject' => 'Payment not approved',
            'category' => 'billing',
            'message' => 'আমার পেমেন্ট এখনও approve হয়নি।',
        ])->assertOk();

        $ticket = $response->json('data');
        $this->assertSame('billing', $ticket['category']);
        $this->assertStringStartsWith('TKT-', $ticket['ticket_number']);
        $this->assertSame($seller->id, $ticket['user_id']);

        Bus::assertDispatched(GenerateAiSupportReplyJob::class, fn ($job) => $job->threadType === 'ticket' && $job->threadId === $ticket['id']);
    }

    public function test_seller_cannot_view_or_message_another_sellers_ticket(): void
    {
        Bus::fake();
        $owner = User::factory()->create(['role' => 'user']);
        $intruder = User::factory()->create(['role' => 'user']);
        $ticket = SupportTicket::create(['ticket_number' => 'TKT-000001', 'user_id' => $owner->id, 'subject' => 'x', 'category' => 'other']);

        Sanctum::actingAs($intruder);

        $this->getJson("/api/tickets/{$ticket->id}")->assertForbidden();
        $this->postJson("/api/tickets/{$ticket->id}/messages", ['message' => 'hi'])->assertForbidden();
    }

    public function test_admin_take_over_stops_further_ai_replies_and_admin_reply_implicitly_takes_over(): void
    {
        Bus::fake();
        $seller = User::factory()->create(['role' => 'user']);
        $admin = User::factory()->create(['role' => 'admin']);
        $ticket = SupportTicket::create(['ticket_number' => 'TKT-000002', 'user_id' => $seller->id, 'subject' => 'x', 'category' => 'other']);

        Sanctum::actingAs($admin);
        $this->postJson("/api/admin/tickets/{$ticket->id}/take-over")->assertOk();

        $ticket->refresh();
        $this->assertSame($admin->id, $ticket->assigned_admin_id);
        $this->assertFalse($ticket->ai_handled);

        // Follow-up seller message must NOT re-dispatch the AI job now that a human owns it.
        Sanctum::actingAs($seller);
        $this->postJson("/api/tickets/{$ticket->id}/messages", ['message' => 'any update?'])->assertOk();
        Bus::assertNotDispatched(GenerateAiSupportReplyJob::class);
    }

    public function test_admin_reply_alone_also_takes_over_the_ticket(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        $admin = User::factory()->create(['role' => 'admin']);
        $ticket = SupportTicket::create(['ticket_number' => 'TKT-000003', 'user_id' => $seller->id, 'subject' => 'x', 'category' => 'other']);

        Sanctum::actingAs($admin);
        $this->postJson("/api/admin/tickets/{$ticket->id}/messages", ['message' => 'কী সাহায্য করতে পারি?'])->assertOk();

        $ticket->refresh();
        $this->assertSame($admin->id, $ticket->assigned_admin_id);
        $this->assertFalse($ticket->ai_handled);
    }

    public function test_admin_can_update_status_and_priority(): void
    {
        $seller = User::factory()->create(['role' => 'user']);
        $admin = User::factory()->create(['role' => 'admin']);
        $ticket = SupportTicket::create(['ticket_number' => 'TKT-000004', 'user_id' => $seller->id, 'subject' => 'x', 'category' => 'other']);

        Sanctum::actingAs($admin);
        $this->putJson("/api/admin/tickets/{$ticket->id}/status", ['status' => 'resolved'])->assertOk();
        $this->putJson("/api/admin/tickets/{$ticket->id}/priority", ['priority' => 'urgent'])->assertOk();

        $ticket->refresh();
        $this->assertSame('resolved', $ticket->status);
        $this->assertSame($admin->id, $ticket->resolved_by);
        $this->assertSame('urgent', $ticket->priority);
    }

    // -- Live chat gets the same AI hook -------------------------------------

    public function test_live_chat_message_dispatches_the_ai_job_until_a_human_replies(): void
    {
        Bus::fake();
        $seller = User::factory()->create(['role' => 'user']);
        Sanctum::actingAs($seller);

        $this->postJson('/api/support/messages', ['message' => 'হ্যালো'])->assertOk();
        Bus::assertDispatched(GenerateAiSupportReplyJob::class, fn ($job) => $job->threadType === 'conversation');

        Bus::fake(); // reset the dispatch log
        $admin = User::factory()->create(['role' => 'admin']);
        $conversation = SupportConversation::where('user_id', $seller->id)->firstOrFail();
        Sanctum::actingAs($admin);
        $this->postJson("/api/admin/support/conversations/{$conversation->id}/messages", ['message' => 'জি বলুন'])->assertOk();

        $this->assertTrue($conversation->fresh()->human_handled);

        Sanctum::actingAs($seller);
        $this->postJson('/api/support/messages', ['message' => 'ধন্যবাদ'])->assertOk();
        Bus::assertNotDispatched(GenerateAiSupportReplyJob::class);
    }

    // -- AI agent guards (never reach the real API) --------------------------

    public function test_ai_agent_skips_when_disabled(): void
    {
        PlatformAiSupportSetting::current()->update(['is_enabled' => false]);
        $seller = User::factory()->create(['role' => 'user']);
        $ticket = SupportTicket::create(['ticket_number' => 'TKT-000005', 'user_id' => $seller->id, 'subject' => 'x', 'category' => 'other']);

        app(AiSupportAgentService::class)->respondToTicket($ticket);

        $this->assertSame(0, $ticket->fresh()->messages()->count());
    }

    public function test_ai_agent_skips_once_daily_cap_is_reached(): void
    {
        $settings = PlatformAiSupportSetting::current();
        $settings->update(['is_enabled' => true, 'max_ai_replies_per_day' => 1, 'daily_reply_count' => 1, 'daily_reply_count_reset_at' => now()->toDateString()]);

        $seller = User::factory()->create(['role' => 'user']);
        $ticket = SupportTicket::create(['ticket_number' => 'TKT-000006', 'user_id' => $seller->id, 'subject' => 'x', 'category' => 'other']);

        app(AiSupportAgentService::class)->respondToTicket($ticket);

        $this->assertSame(0, $ticket->fresh()->messages()->count());
    }

    public function test_ai_agent_stays_out_once_a_ticket_is_assigned(): void
    {
        PlatformAiSupportSetting::current()->update(['is_enabled' => true]);
        $seller = User::factory()->create(['role' => 'user']);
        $admin = User::factory()->create(['role' => 'admin']);
        $ticket = SupportTicket::create([
            'ticket_number' => 'TKT-000007', 'user_id' => $seller->id, 'subject' => 'x', 'category' => 'other',
            'assigned_admin_id' => $admin->id,
        ]);

        // Would throw trying to reach the real API if the guard didn't short-circuit first.
        app(AiSupportAgentService::class)->respondToTicket($ticket);

        $this->assertSame(0, $ticket->fresh()->messages()->count());
    }

    public function test_ai_agent_stays_out_of_a_human_handled_conversation(): void
    {
        PlatformAiSupportSetting::current()->update(['is_enabled' => true]);
        $seller = User::factory()->create(['role' => 'user']);
        $conversation = SupportConversation::create(['user_id' => $seller->id, 'human_handled' => true]);

        app(AiSupportAgentService::class)->respondToConversation($conversation);

        $this->assertSame(0, $conversation->fresh()->messages()->count());
    }

    // -- PlatformAiSupportSetting daily cap -----------------------------------

    public function test_daily_cap_resets_on_a_new_day(): void
    {
        $settings = PlatformAiSupportSetting::current();
        $settings->update([
            'max_ai_replies_per_day' => 1,
            'daily_reply_count' => 1,
            'daily_reply_count_reset_at' => now()->subDay()->toDateString(),
        ]);

        $this->assertTrue($settings->canSendAnotherReplyToday());
        $this->assertSame(0, $settings->fresh()->daily_reply_count);
    }

    public function test_daily_cap_blocks_once_reached_today(): void
    {
        $settings = PlatformAiSupportSetting::current();
        $settings->update([
            'max_ai_replies_per_day' => 2,
            'daily_reply_count' => 2,
            'daily_reply_count_reset_at' => now()->toDateString(),
        ]);

        $this->assertFalse($settings->canSendAnotherReplyToday());
    }
}
