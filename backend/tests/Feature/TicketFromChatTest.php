<?php

namespace Tests\Feature;

use App\Models\AiProviderCredential;
use App\Models\PlatformAiSupportSetting;
use App\Models\SupportConversation;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Services\Support\AiProviders\AiProviderClient;
use App\Services\Support\AiProviders\AiProviderClientFactory;
use App\Services\Support\AiSupportAgentService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "Should I open a ticket?" flow — live-chat-only escalation path.
 * support_ticketing_ai_context.md §"ask before opening a ticket".
 */
class TicketFromChatTest extends TestCase
{
    use RefreshDatabase;

    private function enableAi(): void
    {
        PlatformAiSupportSetting::current()->update(['is_enabled' => true, 'provider' => 'anthropic']);
        AiProviderCredential::create(['provider' => 'anthropic', 'api_key' => 'k']);
    }

    /** A fake provider that immediately calls the named tool with the given input, then returns $finalReply. */
    private function toolCallingProvider(string $toolName, array $toolInput, string $finalReply): AiProviderClient
    {
        return new class($toolName, $toolInput, $finalReply) implements AiProviderClient
        {
            public function __construct(
                private readonly string $toolName,
                private readonly array $toolInput,
                private readonly string $finalReply,
            ) {}

            public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string
            {
                $executeTool($this->toolName, $this->toolInput);

                return $this->finalReply;
            }
        };
    }

    public function test_ticket_tool_present_for_conversations(): void
    {
        $this->enableAi();
        $capturedTools = null;
        $spy = new class($capturedTools) implements AiProviderClient
        {
            public function __construct(private mixed &$capturedTools) {}

            public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string
            {
                $this->capturedTools = collect($tools)->pluck('name')->all();

                return 'ok';
            }
        };
        $this->mock(AiProviderClientFactory::class, fn ($mock) => $mock->shouldReceive('make')->andReturn($spy));

        $seller = User::factory()->create(['role' => 'user']);
        $conversation = SupportConversation::create(['user_id' => $seller->id]);
        SupportMessage::create(['conversation_id' => $conversation->id, 'sender_type' => 'user', 'sender_id' => $seller->id, 'message' => 'hi']);

        app(AiSupportAgentService::class)->respondToConversation($conversation->fresh());

        $this->assertContains('open_support_ticket', $capturedTools);
    }

    public function test_ticket_tool_absent_for_tickets(): void
    {
        $this->enableAi();
        $capturedTools = null;
        $spy = new class($capturedTools) implements AiProviderClient
        {
            public function __construct(private mixed &$capturedTools) {}

            public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string
            {
                $this->capturedTools = collect($tools)->pluck('name')->all();

                return 'ok';
            }
        };
        $this->mock(AiProviderClientFactory::class, fn ($mock) => $mock->shouldReceive('make')->andReturn($spy));

        $seller = User::factory()->create(['role' => 'user']);
        $ticket = SupportTicket::create(['ticket_number' => 'TKT-000031', 'user_id' => $seller->id, 'subject' => 'x', 'category' => 'other']);
        $ticket->messages()->create(['sender_type' => 'user', 'sender_id' => $seller->id, 'message' => 'hi']);

        app(AiSupportAgentService::class)->respondToTicket($ticket->fresh());

        $this->assertNotContains('open_support_ticket', $capturedTools);
    }

    public function test_calling_open_support_ticket_copies_the_transcript_and_flags_it_escalated(): void
    {
        $this->enableAi();
        $seller = User::factory()->create(['role' => 'user']);
        $conversation = SupportConversation::create(['user_id' => $seller->id]);
        SupportMessage::create(['conversation_id' => $conversation->id, 'sender_type' => 'user', 'sender_id' => $seller->id, 'message' => 'Order tracking is broken']);
        SupportMessage::create(['conversation_id' => $conversation->id, 'sender_type' => 'ai', 'sender_id' => null, 'message' => 'Want me to open a ticket for this?']);
        SupportMessage::create(['conversation_id' => $conversation->id, 'sender_type' => 'user', 'sender_id' => $seller->id, 'message' => 'yes please']);

        $provider = $this->toolCallingProvider(
            'open_support_ticket',
            ['subject' => 'Order tracking broken', 'category' => 'order'],
            'Ticket opened, our team will follow up.',
        );
        $this->mock(AiProviderClientFactory::class, fn ($mock) => $mock->shouldReceive('make')->andReturn($provider));

        app(AiSupportAgentService::class)->respondToConversation($conversation->fresh());

        $ticket = SupportTicket::where('user_id', $seller->id)->sole();
        $this->assertSame('Order tracking broken', $ticket->subject);
        $this->assertSame('order', $ticket->category);
        $this->assertTrue($ticket->escalated);
        $this->assertStringStartsWith('TKT-', $ticket->ticket_number);

        // Transcript copied in order, sender types preserved (including the AI's own prior message).
        $messages = $ticket->messages()->orderBy('id')->pluck('sender_type', 'message');
        $this->assertSame('user', $messages['Order tracking is broken']);
        $this->assertSame('ai', $messages['Want me to open a ticket for this?']);
        $this->assertSame('user', $messages['yes please']);

        // The live chat itself got the AI's confirmation reply too.
        $this->assertSame('Ticket opened, our team will follow up.', $conversation->fresh()->messages()->latest('id')->first()->message);
    }

    public function test_open_support_ticket_falls_back_gracefully_outside_live_chat(): void
    {
        // Defensive check: even if a provider somehow called this tool name
        // from a ticket context (it's never offered there), the dispatcher
        // doesn't crash or create a phantom ticket.
        $this->enableAi();
        $seller = User::factory()->create(['role' => 'user']);
        $ticket = SupportTicket::create(['ticket_number' => 'TKT-000032', 'user_id' => $seller->id, 'subject' => 'x', 'category' => 'other']);
        $ticket->messages()->create(['sender_type' => 'user', 'sender_id' => $seller->id, 'message' => 'hi']);

        $provider = $this->toolCallingProvider('open_support_ticket', ['subject' => 'x', 'category' => 'other'], 'done');
        $this->mock(AiProviderClientFactory::class, fn ($mock) => $mock->shouldReceive('make')->andReturn($provider));

        app(AiSupportAgentService::class)->respondToTicket($ticket->fresh());

        $this->assertSame(1, SupportTicket::count()); // no phantom second ticket created
    }
}
