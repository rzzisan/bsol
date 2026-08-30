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

    public function __construct(
        private readonly AiProviderClientFactory $providerFactory,
        private readonly SupportDiagnosticsService $diagnostics,
    ) {}

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
            onOpenTicket: function (string $subject, string $category) use ($conversation, $user) {
                return $this->openTicketFromConversation($conversation, $user, $subject, $category);
            },
        );
    }

    /**
     * Live-chat-only escalation path (support_ticketing_ai_context.md
     * §"ask before opening a ticket"): copies the chat transcript into a new
     * ticket so admin has full context, flags it escalated, and hands back
     * the ticket number for the AI to tell the seller.
     */
    private function openTicketFromConversation(SupportConversation $conversation, User $user, string $subject, string $category): string
    {
        $ticket = SupportTicket::create([
            'ticket_number' => 'PENDING',
            'user_id' => $user->id,
            'subject' => $subject !== '' ? $subject : 'Opened from live chat',
            'category' => in_array($category, SupportTicket::CATEGORIES, true) ? $category : 'other',
            'escalated' => true,
            'escalation_reason' => 'Seller asked to open a ticket from live chat',
        ]);
        $ticket->update(['ticket_number' => 'TKT-'.str_pad((string) $ticket->id, 6, '0', STR_PAD_LEFT)]);

        $lastMessage = null;
        foreach ($conversation->messages()->orderBy('id')->get() as $m) {
            $lastMessage = SupportTicketMessage::create([
                'ticket_id' => $ticket->id,
                'sender_type' => $m->sender_type,
                'sender_id' => $m->sender_id,
                'message' => $m->message,
            ]);
        }

        $ticket->update([
            'last_message_at' => $lastMessage?->created_at ?? now(),
            'last_message_preview' => Str::limit($lastMessage?->message ?? $ticket->subject, 120),
            'last_message_sender_type' => $lastMessage?->sender_type ?? 'user',
            'admin_unread_count' => 1,
        ]);

        Log::info('ai_support.ticket_opened_from_chat', ['conversation_id' => $conversation->id, 'ticket_id' => $ticket->id]);

        return $ticket->ticket_number;
    }

    private function toApiMessage(string $senderType, string $text): array
    {
        // Messages API only has user/assistant roles — admin and ai replies
        // both read as "assistant" from the model's point of view.
        return ['role' => $senderType === 'user' ? 'user' : 'assistant', 'content' => $text];
    }

    private function respond(User $user, array $history, \Closure $onReply, \Closure $onEscalate, ?\Closure $onOpenTicket = null): void
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
                $this->systemPrompt($settings, isLiveChat: $onOpenTicket !== null),
                $history,
                $this->toolDefinitions(includeOpenTicket: $onOpenTicket !== null),
                $this->toolDispatcher($user, $onEscalate, $onOpenTicket),
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
    private function toolDefinitions(bool $includeOpenTicket): array
    {
        $emptySchema = ['type' => 'object', 'properties' => new \stdClass, 'required' => []];

        $tools = [
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
                'name' => 'diagnose_no_new_orders',
                'description' => "Checks the seller's own account for concrete reasons new storefront orders might not be coming in — storefront/subdomain reachability, whether any products are actually visible for sale, days since the last order, and recent abandoned-checkout activity (signals real traffic vs. none at all). Use this instead of guessing when a seller reports 'no new orders' / 'orders not coming'. No input needed.",
                'inputSchema' => $emptySchema,
            ],
            [
                'name' => 'diagnose_sms_not_sending',
                'description' => "Checks why SMS might not be sending — whether the platform's SMS gateway is active at all, the seller's own SMS credit balance, and their most recent failed sends with the actual error message. No input needed.",
                'inputSchema' => $emptySchema,
            ],
            [
                'name' => 'diagnose_wordpress_not_connecting',
                'description' => "Checks the seller's own WordPress/WooCommerce plugin connection key — whether one was ever generated, its status (pending = never successfully connected, connected = has worked, revoked = needs a new key), the domain on file, and how long since it was last used. No input needed.",
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

        if ($includeOpenTicket) {
            // Live-chat only — see the system prompt rule this pairs with:
            // ask the seller first, only call this after they say yes.
            $tools[] = [
                'name' => 'open_support_ticket',
                'description' => "Opens a formal support ticket from this live chat conversation, copying the chat transcript into it so the admin team has full context. Only call this AFTER the seller has explicitly agreed (in their own words) that they want a ticket opened — never call it unprompted or on the first sign of trouble.",
                'inputSchema' => [
                    'type' => 'object',
                    'properties' => [
                        'subject' => ['type' => 'string', 'description' => "Short subject line summarizing the seller's problem"],
                        'category' => ['type' => 'string', 'enum' => SupportTicket::CATEGORIES],
                    ],
                    'required' => ['subject', 'category'],
                ],
            ];
        }

        return $tools;
    }

    /** One dispatcher every provider adapter calls the same way: fn(name, input): string. */
    private function toolDispatcher(User $user, \Closure $onEscalate, ?\Closure $onOpenTicket): \Closure
    {
        return function (string $name, array $input) use ($user, $onEscalate, $onOpenTicket): string {
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
                'diagnose_no_new_orders' => json_encode($this->diagnostics->diagnoseNoNewOrders($user)),
                'diagnose_sms_not_sending' => json_encode($this->diagnostics->diagnoseSmsNotSending($user)),
                'diagnose_wordpress_not_connecting' => json_encode($this->diagnostics->diagnoseWordpressNotConnecting($user)),
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
                'open_support_ticket' => (function () use ($input, $onOpenTicket) {
                    if ($onOpenTicket === null) {
                        return 'This tool is not available here.';
                    }
                    $ticketNumber = $onOpenTicket(
                        (string) ($input['subject'] ?? 'Support request'),
                        (string) ($input['category'] ?? 'other'),
                    );

                    return "Ticket {$ticketNumber} created and flagged for the admin team. Tell the seller their ticket number and that a team member will follow up there.";
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

    private function systemPrompt(PlatformAiSupportSetting $settings, bool $isLiveChat): string
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
- "কেন নতুন অর্ডার আসছে না", "কেন SMS যাচ্ছে না", "কেন WordPress প্লাগইন কানেক্ট হচ্ছে না" — এই ধরনের সমস্যায় সংশ্লিষ্ট diagnose_* টুল (diagnose_no_new_orders / diagnose_sms_not_sending / diagnose_wordpress_not_connecting) কল করুন। টুল যা ফ্যাক্ট দেয় তার ভিত্তিতে সম্ভাব্য কারণ ও সমাধান বলুন। **টুল কোনো সমস্যা খুঁজে না পেলে সেটাও স্পষ্ট করে বলুন** (যেমন: "আমি চেক করেছি, স্টোরফ্রন্ট/প্রোডাক্ট/ক্রেডিট সব ঠিক আছে — সমস্যাটা সম্ভবত অন্য কারণে, একজন টিম সদস্য আরও গভীরে দেখবেন") — চুপচাপ escalate করবেন না বা বানিয়ে কারণ বলবেন না।
- সেলার যে ভাষায় প্রশ্ন করেছেন (বাংলা/ইংরেজি) সেই ভাষাতেই উত্তর দিন।
- আপনি কখনও কোনো write action সম্পাদন করতে পারবেন না — রিফান্ড, সাবস্ক্রিপশন বাতিল/পরিবর্তন, বা অন্য কোনো অ্যাকাউন্ট পরিবর্তন। এমন অনুরোধ পেলে escalate_to_admin কল করুন এবং সেলারকে সংক্ষেপে জানান যে আমাদের একজন সাপোর্ট এজেন্ট শীঘ্রই যোগাযোগ করবেন।
- search_platform_help-এ কিছু না পেলে এবং নিজের জ্ঞান দিয়েও নিশ্চিতভাবে উত্তর দিতে না পারলে — অনুমান করে ভুল তথ্য না দিয়ে escalate_to_admin কল করুন।
- উত্তর সংক্ষিপ্ত ও সরাসরি রাখুন।
PROMPT;

        if ($isLiveChat) {
            $base .= "\n\n".<<<'PROMPT'
লাইভ চ্যাট-নির্দিষ্ট নিয়ম (টিকিটে প্রযোজ্য না):
- যদি search_platform_help/diagnose_* সব চেষ্টা করেও প্রশ্নটার সমাধান দিতে না পারেন — সরাসরি escalate_to_admin কল করার বদলে সেলারকে জিজ্ঞেস করুন, যেমন: "এটার জন্য আমাদের টিম বিস্তারিত দেখলে ভালো হবে — আপনার জন্য কি একটা সাপোর্ট টিকেট খুলে দেব?"
- সেলার সম্মতি জানালে (পরের মেসেজে "হ্যাঁ"/"ok"/অনুরূপ কিছু বললে) open_support_ticket টুল কল করুন, বিষয় ও ক্যাটাগরি নিজে থেকে ঠিক করে। টিকেট নম্বর পেলে সেলারকে জানিয়ে দিন যে আমাদের টিম ওখানেই follow up করবে।
- সেলার না বললে বা অন্য কিছু জিজ্ঞেস করলে, টিকেট ছাড়াই যতটা সম্ভব সাহায্য করার চেষ্টা চালিয়ে যান।
- রিফান্ড/অ্যাকাউন্ট পরিবর্তনের মতো স্পর্শকাতর/জরুরি বিষয়ে টিকিট জিজ্ঞেস করার দরকার নেই — আগের নিয়ম অনুযায়ী সরাসরি escalate_to_admin কল করুন।
PROMPT;
        }

        return $settings->system_prompt_extra
            ? $base."\n\n".$settings->system_prompt_extra
            : $base;
    }
}
