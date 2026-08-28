<?php

namespace App\Services\Support;

use App\Models\Order;
use App\Models\PlatformAiSupportSetting;
use App\Models\SubscriptionPayment;
use App\Models\SupportConversation;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\User;
use App\Services\Support\AiProviders\AiProviderClientFactory;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Instant first-response AI agent for both support surfaces (live chat +
 * tickets) — support_ticketing_ai_context.md. Which LLM actually answers is
 * pluggable (Anthropic/Gemini/Groq/OpenAI/OpenRouter, chosen in
 * platform_ai_support_settings.provider) — this class stays the orchestrator
 * (guards, tool logic, reply/escalation persistence) regardless of provider.
 *
 * Security: every read tool below captures the thread's own $user from PHP
 * scope. None of them accept a user/account id as a model-supplied argument,
 * so a seller can never prompt-inject the AI into reading another seller's
 * data — the tool surface makes it structurally impossible, not just
 * policy-discouraged.
 */
class AiSupportAgentService
{
    public function __construct(private readonly AiProviderClientFactory $providerFactory) {}

    public function respondToTicket(SupportTicket $ticket): void
    {
        $user = $ticket->user;

        if ($user === null || $ticket->assigned_admin_id !== null) {
            return; // no owner, or a human already took over — AI stays out.
        }

        $history = $ticket->messages()->orderBy('id')->get()
            ->map(fn (SupportTicketMessage $m) => $this->toApiMessage($m->sender_type, $m->message))
            ->all();

        $this->respond(
            user: $user,
            history: $history,
            onReply: function (string $text) use ($ticket) {
                $message = SupportTicketMessage::create([
                    'ticket_id' => $ticket->id,
                    'sender_type' => 'ai',
                    'sender_id' => null,
                    'message' => $text,
                ]);

                $ticket->update([
                    'last_message_at' => $message->created_at,
                    'last_message_preview' => Str::limit($text, 120),
                    'last_message_sender_type' => 'ai',
                    'user_unread_count' => $ticket->user_unread_count + 1,
                ]);
            },
            onEscalate: function (string $reason, string $priority) use ($ticket) {
                $ticket->update([
                    'escalated' => true,
                    'escalation_reason' => $reason,
                    'priority' => in_array($priority, SupportTicket::PRIORITIES, true) ? $priority : $ticket->priority,
                    'admin_unread_count' => $ticket->admin_unread_count + 1,
                ]);
            },
        );
    }

    public function respondToConversation(SupportConversation $conversation): void
    {
        $user = $conversation->user;

        if ($user === null || $conversation->human_handled) {
            return; // a human admin has already replied here — AI stays out.
        }

        $history = $conversation->messages()->orderBy('id')->get()
            ->map(fn (SupportMessage $m) => $this->toApiMessage($m->sender_type, $m->message))
            ->all();

        $this->respond(
            user: $user,
            history: $history,
            onReply: function (string $text) use ($conversation) {
                $message = SupportMessage::create([
                    'conversation_id' => $conversation->id,
                    'sender_type' => 'ai',
                    'sender_id' => null,
                    'message' => $text,
                ]);

                $conversation->update([
                    'last_message_at' => $message->created_at,
                    'last_message_preview' => Str::limit($text, 120),
                    'last_message_sender_type' => 'ai',
                    'user_unread_count' => $conversation->user_unread_count + 1,
                ]);
            },
            onEscalate: function (string $reason, string $priority) use ($conversation) {
                // No dedicated escalation/priority columns on live-chat threads —
                // bumping admin_unread_count (already the shared-inbox unread
                // signal) is enough to surface it; the AI's own reply text tells
                // the seller a teammate is taking over.
                Log::info('ai_support.conversation_escalated', [
                    'conversation_id' => $conversation->id, 'reason' => $reason, 'suggested_priority' => $priority,
                ]);
                $conversation->update(['admin_unread_count' => $conversation->admin_unread_count + 1]);
            },
        );
    }

    private function toApiMessage(string $senderType, string $text): array
    {
        // Messages API only has user/assistant roles — admin and ai replies
        // both read as "assistant" from the model's point of view.
        return ['role' => $senderType === 'user' ? 'user' : 'assistant', 'content' => $text];
    }

    private function respond(User $user, array $history, \Closure $onReply, \Closure $onEscalate): void
    {
        $settings = PlatformAiSupportSetting::current();

        if (! $settings->is_enabled) {
            return;
        }

        if (! $settings->canSendAnotherReplyToday()) {
            Log::info('ai_support.daily_cap_reached', ['user_id' => $user->id]);

            return;
        }

        $provider = $this->providerFactory->make($settings);

        if ($provider === null) {
            Log::info('ai_support.no_provider_key', ['provider' => $settings->provider, 'user_id' => $user->id]);

            return; // selected provider has no API key saved yet — wait for a human, same as disabled.
        }

        try {
            $finalText = $provider->respond(
                $this->systemPrompt($settings),
                $history,
                $this->toolDefinitions(),
                $this->toolDispatcher($user, $onEscalate),
            );

            if ($finalText !== null) {
                $onReply($finalText);
                $settings->recordReply();
            }
        } catch (\Throwable $e) {
            Log::error('ai_support.generate_failed', ['provider' => $settings->provider, 'user_id' => $user->id, 'error' => $e->getMessage()]);

            // Never leave the seller with silence on an API failure — post a
            // graceful placeholder and force a human to pick it up.
            $onReply('দুঃখিত, এই মুহূর্তে স্বয়ংক্রিয় উত্তর দেওয়া সম্ভব হচ্ছে না। আমাদের টিমের একজন সদস্য শীঘ্রই আপনার সাথে যোগাযোগ করবেন। | Sorry, an automated reply isn\'t possible right now — a team member will get back to you shortly.');
            $onEscalate('AI reply failed: '.$e->getMessage(), 'medium');
        }
    }

    /** Provider-agnostic tool definitions — every adapter translates these into its own wire format. */
    private function toolDefinitions(): array
    {
        $emptySchema = ['type' => 'object', 'properties' => new \stdClass, 'required' => []];

        return [
            [
                'name' => 'get_subscription_status',
                'description' => "The seller's own current subscription package, status, and renewal date. No input needed.",
                'inputSchema' => $emptySchema,
            ],
            [
                'name' => 'get_recent_orders',
                'description' => "The seller's own 10 most recent store orders (status, payment status, courier status, total). No input needed.",
                'inputSchema' => $emptySchema,
            ],
            [
                'name' => 'get_recent_payments',
                'description' => "The seller's own 10 most recent subscription payments (amount, status, method, admin note if rejected). No input needed.",
                'inputSchema' => $emptySchema,
            ],
            [
                'name' => 'escalate_to_admin',
                'description' => 'Flag this conversation for a human admin instead of answering yourself. Use for refunds, account/financial actions, or anything you are not confident about.',
                'inputSchema' => [
                    'type' => 'object',
                    'properties' => [
                        'reason' => ['type' => 'string', 'description' => 'Why a human needs to take this'],
                        'suggested_priority' => ['type' => 'string', 'enum' => SupportTicket::PRIORITIES],
                    ],
                    'required' => ['reason'],
                ],
            ],
        ];
    }

    /** One dispatcher every provider adapter calls the same way: fn(name, input): string. */
    private function toolDispatcher(User $user, \Closure $onEscalate): \Closure
    {
        return function (string $name, array $input) use ($user, $onEscalate): string {
            return match ($name) {
                'get_subscription_status' => json_encode([
                    'package' => $user->subscriptionPackage?->name,
                    'status' => $user->subscription_status,
                    'started_at' => optional($user->subscription_started_at)->toDateString(),
                    'ends_at' => optional($user->subscription_ends_at)->toDateString(),
                    'is_expired' => $user->isSubscriptionExpired(),
                ]),
                'get_recent_orders' => json_encode(
                    Order::where('user_id', $user->id)->latest()->limit(10)
                        ->get(['order_number', 'status', 'payment_status', 'courier_status', 'total', 'created_at'])
                ),
                'get_recent_payments' => json_encode(
                    SubscriptionPayment::where('user_id', $user->id)->latest()->limit(10)
                        ->get(['amount', 'status', 'payment_method', 'trx_id', 'admin_note', 'created_at'])
                        ->map(fn (SubscriptionPayment $p) => [
                            'amount' => $p->amount,
                            'status' => $p->status,
                            'payment_method' => $p->payment_method,
                            'trx_id' => $this->maskTrx($p->trx_id),
                            'admin_note' => $p->admin_note,
                            'created_at' => $p->created_at,
                        ])
                ),
                'escalate_to_admin' => (function () use ($input, $onEscalate) {
                    $onEscalate((string) ($input['reason'] ?? 'unspecified'), (string) ($input['suggested_priority'] ?? 'medium'));

                    return 'Escalated to a human admin. You may still send the seller a brief acknowledgement.';
                })(),
                default => json_encode(['error' => "unknown tool: {$name}"]),
            };
        };
    }

    private function maskTrx(?string $trx): ?string
    {
        if ($trx === null || $trx === '') {
            return $trx;
        }

        return strlen($trx) <= 4 ? $trx : str_repeat('*', strlen($trx) - 4).substr($trx, -4);
    }

    private function systemPrompt(PlatformAiSupportSetting $settings): string
    {
        $base = <<<'PROMPT'
আপনি BSOL AI সাপোর্ট এজেন্ট — একটি বাংলাদেশি ই-কমার্স SaaS প্ল্যাটফর্মের সেলারদের সহায়তাকারী।

নিয়ম:
- শুধুমাত্র এই প্ল্যাটফর্মের সাবস্ক্রিপশন, বিলিং, অর্ডার ও অ্যাকাউন্ট সংক্রান্ত প্রশ্নে সাহায্য করুন।
- সেলারের নিজের অ্যাকাউন্ট ডেটা দেখার জন্য আপনাকে টুল দেওয়া হয়েছে — অনুমান না করে সবসময় টুল থেকে প্রকৃত তথ্য যাচাই করে উত্তর দিন।
- সেলার যে ভাষায় প্রশ্ন করেছেন (বাংলা/ইংরেজি) সেই ভাষাতেই উত্তর দিন।
- আপনি কখনও কোনো write action সম্পাদন করতে পারবেন না — রিফান্ড, সাবস্ক্রিপশন বাতিল/পরিবর্তন, বা অন্য কোনো অ্যাকাউন্ট পরিবর্তন। এমন অনুরোধ পেলে escalate_to_admin কল করুন এবং সেলারকে সংক্ষেপে জানান যে একজন টিম সদস্য শীঘ্রই যোগাযোগ করবেন।
- আপনি নিশ্চিত না হলে বা প্রশ্নটি স্পর্শকাতর/জটিল মনে হলে অনুমান করে ভুল তথ্য না দিয়ে escalate_to_admin কল করুন।
- উত্তর সংক্ষিপ্ত ও সরাসরি রাখুন।
PROMPT;

        return $settings->system_prompt_extra
            ? $base."\n\n".$settings->system_prompt_extra
            : $base;
    }
}
