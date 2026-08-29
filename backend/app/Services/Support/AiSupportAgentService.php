<?php

namespace App\Services\Support;

use App\Models\AiKnowledgeBaseArticle;
use App\Models\Order;
use App\Models\PlatformAiSupportSetting;
use App\Models\SubscriptionPackage;
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
    // Free-tier providers cap tokens-per-minute tightly (Groq's gpt-oss-120b
    // is 8,000 TPM) — an unbounded full-thread history was blowing past that
    // on longer tickets even before adding tool schemas. Only the most
    // recent messages carry real conversational context anyway.
    private const MAX_HISTORY_MESSAGES = 12;

    public function __construct(private readonly AiProviderClientFactory $providerFactory) {}

    public function respondToTicket(SupportTicket $ticket): void
    {
        $user = $ticket->user;

        if ($user === null || $ticket->assigned_admin_id !== null) {
            return; // no owner, or a human already took over — AI stays out.
        }

        $history = $ticket->messages()->orderByDesc('id')->limit(self::MAX_HISTORY_MESSAGES)->get()
            ->sortBy('id')->values()
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

        $history = $conversation->messages()->orderByDesc('id')->limit(self::MAX_HISTORY_MESSAGES)->get()
            ->sortBy('id')->values()
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
        } catch (\Throwable $e) {
            Log::error('ai_support.generate_failed', ['provider' => $settings->provider, 'user_id' => $user->id, 'error' => $e->getMessage()]);
            $finalText = null;
        }

        if ($finalText !== null) {
            $onReply($finalText);
            $settings->recordReply();

            return;
        }

        // A provider adapter can also return null without throwing (a logged
        // HTTP error, or the model producing no final text at all) — never
        // let that read as silence to the seller. Always land on a reply.
        // Deliberately no "automatic"/"AI" wording here — the seller-facing
        // persona never names itself as automated (support_ticketing_ai_context.md).
        Log::warning('ai_support.no_reply_produced', ['provider' => $settings->provider, 'user_id' => $user->id]);
        $onReply($this->waitingFallbackMessage($history));
        $onEscalate('AI produced no reply (provider error or empty response)', 'medium');
    }

    /** Matches whichever language the seller's most recent message used. */
    private function waitingFallbackMessage(array $history): string
    {
        $lastUserMessage = collect($history)->last(fn (array $m) => $m['role'] === 'user')['content'] ?? '';
        $isBengali = (bool) preg_match('/[\x{0980}-\x{09FF}]/u', $lastUserMessage);

        return $isBengali
            ? 'অনুগ্রহ করে একটু অপেক্ষা করুন। শীঘ্রই আমাদের একজন সাপোর্ট এজেন্ট আপনার সাথে যোগাযোগ করবেন।'
            : 'Please wait a moment — one of our support agents will get back to you shortly.';
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
                'name' => 'get_available_packages',
                'description' => 'All currently active subscription packages with price, billing period, order limit, and features — use this for "which package should I use" / "how much does it cost" / plan-comparison questions instead of guessing. No input needed.',
                'inputSchema' => $emptySchema,
            ],
            [
                'name' => 'search_platform_help',
                'description' => "Search this SaaS platform's own how-to knowledge base — use this for 'how do I use module X' / 'how do I buy Y' questions (orders, products, courier, SMS, WhatsApp, Facebook, landing pages, analytics, accounting, subscription/billing, store settings, support) BEFORE deciding to escalate. Not for account-specific data — use the other tools for that.",
                'inputSchema' => [
                    'type' => 'object',
                    'properties' => [
                        'query' => ['type' => 'string', 'description' => "The seller's question, in their own words"],
                    ],
                    'required' => ['query'],
                ],
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
                'search_platform_help' => $this->searchKnowledgeBase((string) ($input['query'] ?? '')),
                'get_available_packages' => json_encode(
                    SubscriptionPackage::where('is_active', true)->orderBy('price')
                        ->get(['name', 'price', 'duration_days', 'max_orders', 'features'])
                        ->map(fn (SubscriptionPackage $p) => [
                            'name' => $p->name,
                            'price' => $p->price,
                            'billing_period_days' => $p->duration_days,
                            'max_orders_per_period' => $p->max_orders ?? 'unlimited',
                            'features' => $p->features,
                        ])
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

    /**
     * Plain keyword scoring over the active knowledge base — title matches
     * weighted higher than body matches. Deliberately not Postgres full-text
     * search: its default text-search configs don't stem Bengali, so a
     * substring/word-overlap score is more predictable for bn/en mixed
     * queries than tsvector would be here.
     */
    private function searchKnowledgeBase(string $query): string
    {
        $query = trim($query);
        if ($query === '') {
            return json_encode(['error' => 'empty query']);
        }

        $words = array_filter(preg_split('/\s+/u', $query) ?: [], fn (string $w) => mb_strlen($w) >= 2);

        $matches = AiKnowledgeBaseArticle::where('is_active', true)->get()
            ->map(function (AiKnowledgeBaseArticle $article) use ($words) {
                $titleLower = mb_strtolower($article->title);
                $bodyLower = mb_strtolower($article->title.' '.$article->content);
                $score = 0;
                foreach ($words as $word) {
                    $wordLower = mb_strtolower($word);
                    if (str_contains($titleLower, $wordLower)) {
                        $score += 2;
                    } elseif (str_contains($bodyLower, $wordLower)) {
                        $score += 1;
                    }
                }

                return ['article' => $article, 'score' => $score];
            })
            ->filter(fn (array $row) => $row['score'] > 0)
            ->sortByDesc('score')
            ->take(3);

        if ($matches->isEmpty()) {
            return json_encode(['result' => 'No matching help article found in the knowledge base.']);
        }

        return json_encode($matches->map(fn (array $row) => [
            'title' => $row['article']->title,
            'content' => $row['article']->content,
        ])->values());
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
আপনি BSOL-এর সাপোর্ট টিমের একজন সদস্য — একটি বাংলাদেশি ই-কমার্স SaaS প্ল্যাটফর্মের সেলারদের সহায়তা করেন।

কথা বলার ধরন:
- স্বাভাবিক, উষ্ণ, মানুষের মতো ভাষায় লিখুন — যেমন একজন সাপোর্ট টিমের কলিগ লিখতেন। কোনো robotic/টেকনিক্যাল phrasing ব্যবহার করবেন না।
- নিজেকে কখনও "AI", "বট", "স্বয়ংক্রিয় সিস্টেম", "automated" এই ধরনের শব্দে পরিচয় দেবেন না। নিজেকে "আমাদের টিম" / "আমরা" হিসেবে বলুন।
- অনুরোধ ভালোভাবে সমাধান করতে না পারলে বলুন "আমাদের একজন সাপোর্ট এজেন্ট শীঘ্রই যোগাযোগ করবেন" — কখনও "স্বয়ংক্রিয় উত্তর দেওয়া সম্ভব হচ্ছে না" জাতীয় কিছু বলবেন না।

কাজের নিয়ম:
- এই প্ল্যাটফর্মের যেকোনো মডিউল কিভাবে ব্যবহার করতে হয় (অর্ডার, প্রোডাক্ট, কুরিয়ার, SMS, WhatsApp, Facebook, ল্যান্ডিং পেজ, অ্যানালিটিক্স, অ্যাকাউন্টিং, সাবস্ক্রিপশন/বিলিং, স্টোর সেটিংস, সাপোর্ট) — এই ধরনের "কিভাবে করব" প্রশ্নে সাহায্য করার আগে অবশ্যই search_platform_help টুল দিয়ে খুঁজে দেখুন। সরাসরি escalate করার আগে এটা try করা বাধ্যতামূলক।
- সেলারের নিজের অ্যাকাউন্ট-নির্দিষ্ট প্রশ্নে (সাবস্ক্রিপশন স্ট্যাটাস, নিজের অর্ডার, নিজের পেমেন্ট) get_subscription_status/get_recent_orders/get_recent_payments টুল ব্যবহার করুন — অনুমান না করে সবসময় টুল থেকে প্রকৃত তথ্য যাচাই করে উত্তর দিন।
- "কোন প্যাকেজ নেব", "কত টাকা", "কত অর্ডার পর্যন্ত পারব" — এই ধরনের প্রশ্নে get_available_packages টুল কল করে আসল দাম/লিমিট দেখে সেলারের বলা চাহিদার (যেমন দৈনিক অর্ডার সংখ্যা) সাথে মিলিয়ে সুপারিশ করুন — কখনও দাম/লিমিট অনুমান করবেন না।
- সেলার যে ভাষায় প্রশ্ন করেছেন (বাংলা/ইংরেজি) সেই ভাষাতেই উত্তর দিন।
- আপনি কখনও কোনো write action সম্পাদন করতে পারবেন না — রিফান্ড, সাবস্ক্রিপশন বাতিল/পরিবর্তন, বা অন্য কোনো অ্যাকাউন্ট পরিবর্তন। এমন অনুরোধ পেলে escalate_to_admin কল করুন এবং সেলারকে সংক্ষেপে জানান যে আমাদের একজন সাপোর্ট এজেন্ট শীঘ্রই যোগাযোগ করবেন।
- search_platform_help-এ কিছু না পেলে এবং নিজের জ্ঞান দিয়েও নিশ্চিতভাবে উত্তর দিতে না পারলে — অনুমান করে ভুল তথ্য না দিয়ে escalate_to_admin কল করুন।
- উত্তর সংক্ষিপ্ত ও সরাসরি রাখুন।
PROMPT;

        return $settings->system_prompt_extra
            ? $base."\n\n".$settings->system_prompt_extra
            : $base;
    }
}
