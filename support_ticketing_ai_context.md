# সাপোর্ট টিকেটিং + AI Agent (added 2026-08-28)

## প্রশ্ন যা থেকে শুরু

সেলার-দের সাপোর্ট এখন শুধু live chat (`support_conversations`/`support_messages`)। দরকার: (১) একটা ফরমাল টিকেটিং সিস্টেম — subject/category/priority/status/ticket number — live chat-এর **পাশাপাশি**, প্রতিস্থাপন হিসেবে নয়। (২) একটা AI Agent দুটো surface-এই যুক্ত থাকবে, যাতে সেলার সাথে সাথে সেবা পায়।

স্পষ্টীকরণ: AI সাধারণ প্রশ্নে **সরাসরি রিপ্লাই** পাঠাবে; অনিশ্চিত/স্পর্শকাতর (রিফান্ড, অ্যাকাউন্ট অ্যাকশন) হলে **স্বয়ংক্রিয়ভাবে admin-কে escalate** করবে। AI সেলারের **নিজের** অ্যাকাউন্ট ডেটা (সাবস্ক্রিপশন/অর্ডার/পেমেন্ট) দেখে উত্তর দিতে পারে — শুধু general FAQ না।

## ডেটা মডেল

`support_conversations`/`support_messages` অপরিবর্তিত রাখা হয়েছে — শুধু `human_handled` (bool) কলাম যোগ হয়েছে (একবার কোনো admin রিপ্লাই দিলে AI ওই থ্রেডে আর ঢুকবে না)।

নতুন সমান্তরাল জোড়া:
- **`support_tickets`**: `ticket_number` (`TKT-000123` ফরম্যাট, id বসানোর পর জেনারেট), `subject`, `category` (billing/order/product/technical/account/other), `priority` (low/medium/high/urgent), `status` (open/pending/resolved/closed), `assigned_admin_id` (নাল থাকলে AI handle করে, সেট হলে AI বন্ধ), `ai_handled`, `escalated` + `escalation_reason`, বাকিটা `support_conversations`-এর মতোই (unread counters, last_message_*)।
- **`support_ticket_messages`**: `support_messages`-এর মতোই কিন্তু `sender_type` এ `ai` যোগ, `sender_id` nullable (AI-এর জন্য null)।
- **`platform_ai_support_settings`**: single-row settings — `is_enabled` (kill switch, ডিফল্ট **false**), `model` (ডিফল্ট `claude-opus-5`), `effort`, `max_ai_replies_per_day` + `daily_reply_count` (lazy daily reset — `PlatformAiSupportSetting::canSendAnotherReplyToday()`-তে চেক করার সময়ই রিসেট হয়, আলাদা cron লাগে না), `system_prompt_extra` (ডিপ্লয় ছাড়াই admin থেকে অতিরিক্ত নির্দেশনা)।

## AI Agent — নিরাপত্তা নকশা

`backend/app/Services/Support/AiSupportAgentService.php`। প্রতিটা read tool (`get_subscription_status`, `get_recent_orders`, `get_recent_payments`) PHP স্কোপ থেকে `$user->id` ক্যাপচার করে বন্ধ করা — মডেল কখনও user id ইনপুট হিসেবে দিতে পারে না। মানে prompt injection দিয়েও একজন সেলার অন্য সেলারের ডেটা দেখাতে AI-কে রাজি করাতে পারবে না — এটা স্ট্রাকচারাল, শুধু prompt-নির্ভর নিয়ম না।

`escalate_to_admin` টুল — একমাত্র side-effect-ওয়ালা টুল: reason + suggested_priority নিয়ে ticket/conversation-এ escalation flag বসায় ও admin_unread_count বাড়ায়। System prompt-এ কড়াভাবে বলা আছে: AI কখনও write action (রিফান্ড, সাবস্ক্রিপশন বাতিল) নিজে করবে না, শুধু status জানাবে অথবা escalate করবে।

### মাল্টি-প্রোভাইডার (added 2026-08-28)

শুরুতে শুধু Anthropic হার্ডকোড করা ছিল। এখন super-admin ড্যাশবোর্ড থেকে **৫টা প্রোভাইডারের** key দেওয়া যায় — Anthropic, Google Gemini, Groq, OpenAI, OpenRouter (Gemini/Groq-এর ফ্রি টিয়ার আছে, খরচ ছাড়াই চালানো যায়) — এবং যেকোনো একটাকে "active" হিসেবে বেছে নেওয়া যায়।

- **`ai_provider_credentials`**: এক প্রোভাইডারে এক row — `provider` (unique), `api_key` (`encrypted` cast), `default_model` (সাজেশন মাত্র, admin বদলাতে পারে)।
- **`platform_ai_support_settings.provider`**: কোন প্রোভাইডার এখন active, `model` কলামে সেই প্রোভাইডারের জন্য নির্বাচিত মডেলের নাম।
- **`app/Services/Support/AiProviders/`** — provider-agnostic contract (`AiProviderClient` interface: `respond(systemPrompt, history, tools, executeTool): ?string`)। তিনটা adapter, পাঁচটা না, কারণ OpenAI/Groq/OpenRouter একই chat-completions + tool-calling wire format ব্যবহার করে:
  - `AnthropicProviderClient` — Anthropic PHP SDK Tool Runner (আগের মতোই, শুধু interface-এর পেছনে সরানো হয়েছে)।
  - `OpenAiCompatibleProviderClient(baseUrl, apiKey, model)` — raw HTTP (`Http::` facade, এই কোডবেসের বাকি ৩rd-party ক্লায়েন্টদের মতোই কনভেনশন) `POST {baseUrl}/chat/completions`। OpenAI/Groq/OpenRouter তিনটাই এটা ব্যবহার করে, শুধু base URL আলাদা।
  - `GeminiProviderClient(apiKey, model)` — Gemini-এর নিজস্ব wire format (`user`/`model` role, `functionCall`/`functionResponse` parts) — সম্পূর্ণ আলাদা adapter।
  - `AiProviderClientFactory::make($settings)` — active provider-এর credential row খুঁজে সঠিক adapter বানায়; key না থাকলে `null` রিটার্ন করে (`AiSupportAgentService` এটাকে ঠিক "disabled"-এর মতোই ট্রিট করে — চুপচাপ কিছু পাঠায় না, মানুষের জন্য অপেক্ষা করে)।
- `AiSupportAgentService`-এর tool গুলো এখন provider-নিরপেক্ষ plain array + একটা dispatcher closure — orchestration লজিক (guard, escalation, reply persist) অপরিবর্তিত।

### প্ল্যাটফর্ম how-to নলেজ বেস (added 2026-08-29)

লাইভ টেস্টে ধরা পড়েছিল: AI শুধু account-specific ডেটা (সাবস্ক্রিপশন/অর্ডার/পেমেন্ট) দেখতে পারত, কিন্তু "SMS ক্রেডিট কিভাবে কিনব" জাতীয় সাধারণ "কিভাবে করব" প্রশ্নে কোনো tool না থাকায় সরাসরি escalate করে দিচ্ছিল — যদিও এগুলো platform-এর সাধারণ ব্যবহারবিধি, escalation-যোগ্য না।

- **`ai_knowledge_base_articles`**: slug/title/content/is_active/sort_order — অ্যাডমিন-এডিটেবল (`/admin/settings/ai-knowledge-base`)। মাইগ্রেশনেই সিলার-সাইড পুরো মেনু কভার করে ১৩টা আর্টিকেল সিড করা হয়েছে (অর্ডার, প্রোডাক্ট, গ্রাহক, কুরিয়ার, SMS, WhatsApp, Facebook, ল্যান্ডিং পেজ, অ্যানালিটিক্স, অ্যাকাউন্টিং, সাবস্ক্রিপশন/বিলিং, স্টোর সেটিংস+স্টাফ, সাপোর্ট) — `frontend/src/components/user-shell.tsx`-এর আসল seller menu অনুযায়ী লেখা, অনুমান করে না।
- নতুন টুল **`search_platform_help(query)`** — সাধারণ কীওয়ার্ড স্কোরিং (title match ×2, body match ×1), Postgres FTS ব্যবহার করা হয়নি কারণ ডিফল্ট text-search config বাংলা stem করে না, প্লেইন substring matching বাংলা/ইংরেজি মিশ্র প্রশ্নে বেশি predictable। সেরা ৩টা ফলাফল দেয়।
- System prompt-এ এখন স্পষ্ট নির্দেশ: "কিভাবে করব" টাইপ প্রশ্নে escalate করার **আগে** `search_platform_help` try করা বাধ্যতামূলক — শুধু account-নির্দিষ্ট প্রশ্নেই অন্য টুলগুলো ব্যবহার হবে।

### AI silently কোনো উত্তর না দেওয়ার বাগ (found + fixed 2026-08-28)

লাইভ টেস্টে দুইটা bug ধরা পড়েছিল একসাথে:
1. **Gemini-স্পেসিফিক**: no-argument tool call (`get_subscription_status` ইত্যাদি) echo করার সময় PHP-এর `{}` → `[]` রূপান্তরের কারণে ২য় tool-call থেকে Gemini `400 Invalid JSON: Proto field is not repeating` error দিচ্ছিল। `GeminiProviderClient`-এ echo করা `functionCall.args` empty হলে `stdClass`-এ cast করে ফিক্স করা হয়েছে।
2. **সব provider-এ প্রযোজ্য, বেশি গুরুত্বপূর্ণ**: কোনো provider adapter exception না ছুঁড়ে চুপচাপ `null` রিটার্ন করলে (যেমন উপরের মতো একটা logged HTTP error-এর পর) `AiSupportAgentService`-এ কিছুই হতো না — না fallback message, না escalation। এখন **provider থেকে যেকোনো কারণে ফাইনাল টেক্সট না এলে** (exception বা silent null, দুটোই) সবসময় fallback message + escalation হয় — সেলার আর নিরুত্তর অবস্থায় থাকবে না।

⚠️ **queue worker (`hybrid-queue-worker.service`) একটা long-running প্রসেস — কোড ডিপ্লয় করলেই এটা নতুন কোড pickup করে না, ম্যানুয়ালি `sudo systemctl restart hybrid-queue-worker.service` চালাতে হয়।**

### provider/model mismatch — আরেকটা লাইভ ইনসিডেন্ট (2026-08-28)

Admin "Active Provider" dropdown থেকে Anthropic থেকে Groq-এ সুইচ করেছিল কিন্তু Model ফিল্ড আগের `gemini-2.5-flash`-ই থেকে গিয়েছিল — Groq সেই মডেল চেনে না বলে `404 model_not_found`, safety net ঠিকই fallback পাঠিয়েছে কিন্তু root cause ছিল ভুল কনফিগারেশন, কোনো কোড বাগ না। ফিক্স:
- `/admin/settings/ai-support`-এ provider dropdown বদলালে, model ফিল্ড যদি এখনো কোনো provider-এর "unedited suggestion"-এর মতো দেখায় (খালি বা কোনো provider-এর suggested model-এর সাথে হুবহু মেলে), তাহলে স্বয়ংক্রিয়ভাবে নতুন provider-এর suggested model বসিয়ে দেয় — deliberately customized model name কখনো overwrite করে না।
- Model ফিল্ডের নিচে এখন সবসময় সতর্কবার্তা + নির্বাচিত provider-এর জন্য সাজেস্টেড মডেল দেখায়।

### সব ফ্রি প্রোভাইডার লাইভ-চেক করে ঠিক করা হয়েছে (2026-08-29)

তিনটা saved key-ই (Groq, Gemini, OpenRouter) সরাসরি সেই প্রোভাইডারের live `/models` endpoint hit করে verify করা হয়েছে (guess করা হয়নি):
- **Groq**: `llama-3.3-70b-versatile` আসলেই retire হয়ে গেছে (Groq-এর মডেল ক্যাটালগ পাল্টে গেছে)। Live model list চেক করে `openai/gpt-oss-120b` দিয়ে real tool-calling round-trip টেস্ট করে কাজ করা কনফার্ম করা হয়েছে — এখন এটাই suggested default।
- **Gemini**: মডেল নাম (`gemini-2.5-flash`) ঠিকই ছিল, `429` আসলে সত্যিকারের free-tier quota exhausted — কোনো কোড/কনফিগ সমস্যা না, নতুন key বা quota reset-এর অপেক্ষা করতে হবে।
- **OpenRouter**: suggested `meta-llama/llama-3.3-70b-instruct:free` ও পরে টেস্ট করা `z-ai/glm-5.2:free` দুটোই তখন upstream rate-limited ছিল (OpenRouter free মডেলের capacity demand অনুযায়ী ওঠানামা করে) — `minimax/minimax-m3:free` দিয়ে সেই মুহূর্তে tool-calling টেস্ট পাস করেছে, এখন suggested default। এই volatility structural, কোনো নির্দিষ্ট মডেল নাম স্থায়ীভাবে নির্ভরযোগ্য না — সেটিংস পেজে এখন স্পষ্ট সতর্কবার্তা আছে।

লাইভ `platform_ai_support_settings`/`ai_provider_credentials` রো সরাসরি আপডেট করে active provider **Groq + `openai/gpt-oss-120b`**-এ সেট করা হয়েছে (এই তিনটার মধ্যে সবচেয়ে স্থিতিশীল প্রমাণিত)। Groq-এর ফ্রি টিয়ার: ৩০ RPM, **১০০০ RPD**, ৮০০০ TPM, ২,০০,০০০ TPD (এই মডেলের জন্য, Groq-এর অফিসিয়াল ডকস + লাইভ header-এ ভেরিফাই করা)।

### সেলার-facing persona — মানুষের মতো, "AI" শব্দ নেই (added 2026-08-29)

ব্যবসায়িক সিদ্ধান্ত: সেলার যেন বুঝতে না পারে যে AI রিপ্লাই দিচ্ছে — একটা consistent human সাপোর্ট টিমের অভিজ্ঞতা দিতে হবে।

- **System prompt** (`AiSupportAgentService::systemPrompt()`) থেকে "BSOL AI সাপোর্ট এজেন্ট" পরিচয় সরিয়ে "BSOL-এর সাপোর্ট টিমের একজন সদস্য" করা হয়েছে + স্পষ্ট নিয়ম: নিজেকে কখনও AI/বট/স্বয়ংক্রিয় বলে পরিচয় দেবে না, "আমাদের টিম/আমরা" হিসেবে কথা বলবে।
- **Fallback message** (কোনো provider ব্যর্থ হলে) আগে ছিল "স্বয়ংক্রিয় উত্তর দেওয়া সম্ভব হচ্ছে না | Sorry, an automated reply..." (bilingual, pipe-separated — নিজেই একটা automation-tell ছিল)। এখন সেলারের শেষ মেসেজের ভাষা অনুযায়ী (Bengali Unicode range দিয়ে ডিটেক্ট করে) শুধু একটা ভাষায়, "অনুগ্রহ করে একটু অপেক্ষা করুন। শীঘ্রই আমাদের একজন সাপোর্ট এজেন্ট আপনার সাথে যোগাযোগ করবেন।" / "Please wait a moment — one of our support agents will get back to you shortly."
- **Frontend**: seller-facing দুই জায়গা থেকেই (`support-chat-widget.tsx`, `dashboard/tickets/page.tsx`) "AI Agent" ব্যাজ + বেগুনি রঙ সরানো হয়েছে — AI-লিখিত মেসেজ এখন admin-লিখিত মেসেজের সাথে দৃশ্যত অভিন্ন। টিকেট লিস্টের প্রিভিউ থেকে 🤖 ইমোজিও সরানো হয়েছে। "নতুন টিকেট" ফর্মের hint টেক্সট থেকেও "AI" শব্দ সরানো হয়েছে।
- **Admin-facing views** — per-message "AI Agent"/"AI এজেন্ট" ব্যাজ + বেগুনি রঙ পরে `admin/support/page.tsx` ও `admin/tickets/page.tsx` থেকেও সরানো হয়েছে (2026-08-29 আপডেট) — এখন AI-লিখিত রিপ্লাই অ্যাডমিনের কাছেও সাধারণ admin-message-এর মতোই দেখায়। ticket-level অবস্থা-নির্দেশক ("🤖 AI is handling this", "🚩 Escalated") ইচ্ছাকৃতভাবে অপরিবর্তিত রাখা হয়েছে — এগুলো নির্দিষ্ট কোনো reply-র flag না, পুরো ticket-এর বর্তমান অবস্থা বোঝানোর জন্য, admin টিমের নিজেদের workflow-এর জন্য দরকারি।
- সরাসরি "তুমি কি AI/বট?" জিজ্ঞেস করলে মিথ্যা বলার কোনো নির্দিষ্ট নির্দেশ দেওয়া হয়নি — শুধু স্বতঃপ্রণোদিতভাবে (unprompted) কখনো "আমি একটা AI" বলবে না, এটুকুই নিশ্চিত করা হয়েছে।

### রিপ্লাইয়ের নিচে সাইনেচার — নাম, "AI" না (added 2026-08-29)

প্রতিটা admin/AI রিপ্লাইয়ের নিচে এখন কে পাঠাল তার নাম দেখায় (সেলার-facing ও admin-facing দুই জায়গাতেই):
- admin রিপ্লাই দিলে সেই admin-এর আসল নাম (যেমন "- Zisan")।
- AI রিপ্লাই দিলে সবসময় **"- BSOL"** (কখনো "AI"/"AI Agent" না)।
- সেলারের নিজের মেসেজে কোনো সাইনেচার নেই।

Backend: `SupportMessage`/`SupportTicketMessage`-এর `sender()` relation আগে থেকেই ছিল, শুধু চারটা controller-এর (`SupportController`, `AdminSupportController`, `SupportTicketController`, `AdminSupportTicketController`) `messages()`/`send()` response-এ `->with('sender:id,name')` / `->load('sender:id,name')` যোগ করা হয়েছে — key ফাঁস হয় না, শুধু id+name। AI-লিখিত মেসেজে `sender_id` null-ই থাকে, ফ্রন্টএন্ড নিজেই `sender_type === 'ai'` দেখে "BSOL" বসায়।

### প্যাকেজ প্রশ্নের জন্য নতুন টুল + TPM চাপ কমানো (added 2026-08-29)

লাইভ টেস্টে "daily 250+ order-এর জন্য কোন প্যাকেজ নেব" প্রশ্নে AI escalate করে দিচ্ছিল — কারণ প্যাকেজ/দাম/লিমিট সংক্রান্ত কোনো টুল ছিল না। একই সময়ে Groq-এ TPM (8000, `openai/gpt-oss-120b`) rate-limit-এ ধরাও পড়ছিল বড় ticket thread-এ।

- **নতুন টুল `get_available_packages`** — লাইভ `subscription_packages` টেবিল থেকে active প্যাকেজের নাম/দাম/duration/`max_orders` (null = unlimited, `OrderStatusService::consumeProcessingQuotaOrFail()`-এর কনভেনশন অনুযায়ী কনফার্ম করা)/features সরাসরি পড়ে — কোনো ডুপ্লিকেট/স্ট্যাটিক কন্টেন্ট মেইনটেইন করতে হয় না, প্যাকেজ পেজে (`/admin/packages`) দাম বদলালে এই টুলও সাথে সাথে আপডেটেড থাকবে।
- **History trim** — আগে পুরো thread (unbounded) প্রতি রিকোয়েস্টে পাঠানো হতো, এখন সর্বশেষ ১২টা মেসেজ পাঠানো হয় (`AiSupportAgentService::MAX_HISTORY_MESSAGES`) — লম্বা টিকিটে TPM চাপ কমাতে।
- **`groq/compound`/`compound-mini` মডেল ব্যবহার করা যাবে না** — যদিও TPM অনেক বেশি (70K বনাম gpt-oss-এর 8K), এই মডেলগুলো custom tool-calling সাপোর্ট করে না ("agentic compound" সিস্টেম, নিজস্ব built-in টুল চালায়) — লাইভ টেস্টে `400 tool calling is not supported with this model` কনফার্ম করা হয়েছে।

🟡 **আপডেট (2026-08-29, পরে):** admin `/admin/packages`-এ গিয়ে দাম/লিমিট ঠিক করে দিয়েছেন। পুনরায় লাইভ টেস্টে AI এখন সঠিকভাবে "কোনো প্যাকেজই দৈনিক ২৫০+ অর্ডার কভার করে না, কাস্টম প্ল্যান লাগবে" বলে escalate করছে — আর ভুলভাবে "unlimited" বলছে না। ছোট একটা numeric anomaly এখনও আছে (Business এখনও Growth-এর চেয়ে সস্তা অথচ বেশি অর্ডার-লিমিট দেয়) কিন্তু সেটা admin-এর ব্যবসায়িক সিদ্ধান্ত হতে পারে বলে touch করা হয়নি — শুধু জানিয়ে রাখা হয়েছে।

## পেজ-ভিত্তিক "কীভাবে ব্যবহার করব?" বাটন (added 2026-08-29)

প্রতিটা ড্যাশবোর্ড পেজে একটা floating "❓ কীভাবে ব্যবহার করব?" বাটন (bottom-left, Support বাটনের উল্টো কোণে যাতে ওভারল্যাপ না করে) — ক্লিক করলে সেই নির্দিষ্ট পেজের how-to কন্টেন্ট দেখায়। AI-এর জন্য বানানো knowledge base-ই পুনর্ব্যবহার করা হয়েছে — কোনো duplicate কন্টেন্ট লাগেনি।

- **Backend**: নতুন read-only `GET /api/help/{slug}` (`HelpArticleController`) — শুধু active থাকলে `{title, content}` রিটার্ন করে, নাহলে 404। Seller-authenticated (auth:sanctum) কিন্তু admin-only না — existing `/admin/ai-knowledge-base` CRUD থেকে আলাদা এই lightweight lookup route।
- **Frontend**: নতুন `frontend/src/components/page-help-button.tsx`, `UserShell`-এ globally মাউন্ট করা (SupportChatWidget-এর মতোই — প্রতিটা `/dashboard/*` পেজে automatic)। `usePathname()` দিয়ে বর্তমান route detect করে একটা longest-prefix-match টেবিল (`ROUTE_TO_SLUG`) দিয়ে সঠিক knowledge-base slug বের করে — যে পেজের জন্য কোনো slug ম্যাচ করে না (যেমন `/dashboard` overview) সেখানে বাটনই দেখায় না।
- Admin `/admin/settings/ai-knowledge-base`-এ কোনো আর্টিকেল এডিট করলে সাথে সাথে এই বাটনেও এবং AI-এর `search_platform_help` টুলেও — দুই জায়গাতেই আপডেটেড কন্টেন্ট দেখা যাবে, একবারই মেইনটেইন করতে হয়।

## ইনস্ট্যান্ট সমস্যা নির্ণয় (added 2026-08-29)

আগে AI শুধু "কিভাবে করব" প্রশ্নে সাহায্য করতে পারত, কিন্তু "কেন X কাজ করছে না" প্রশ্নে concrete কোনো তথ্য ছাড়াই escalate করে দিত। এখন তিনটা নির্দিষ্ট সমস্যার জন্য নতুন `app/Services/Support/SupportDiagnosticsService.php` — প্রতিটা মেথড সেলারের নিজের একাউন্টের আসল state চেক করে শুধু raw fact রিটার্ন করে (কোনো verdict/prose না) — মডেল নিজেই ফ্যাক্ট দেখে বুঝিয়ে বলে, সমস্যা না থাকলে সেটাও স্পষ্ট করে বলার নির্দেশ system prompt-এ আছে।

- **`diagnose_no_new_orders`** — storefront subdomain কনফিগার+active কিনা, storefront-এ visible active প্রোডাক্ট সংখ্যা, শেষ অর্ডার কতদিন আগে, গত ৭ দিনে abandoned checkout সংখ্যা (>0 মানে real traffic আসছে কিন্তু convert হচ্ছে না — zero-traffic থেকে আলাদা কারণ), সাবস্ক্রিপশন স্ট্যাটাস।
- **`diagnose_sms_not_sending`** — platform-wide SMS গেটওয়ে active কিনা (এটা false হলে সেলার নিজে ঠিক করতে পারবে না, admin-level ইস্যু), সেলারের নিজের SMS ক্রেডিট ব্যালেন্স, সাম্প্রতিক ৫টা ব্যর্থ পাঠানোর আসল error_message।
- **`diagnose_wordpress_not_connecting`** — সেলারের নিজের WooCommerce `PlatformApiKey` — key generate করা হয়েছে কিনা, status (pending = কখনো successfully connect হয়নি / connected / revoked), domain, শেষ কবে ব্যবহার হয়েছে।

লাইভ টেস্টে verify করা হয়েছে ("amar sms pathano jacche na") — AI সঠিকভাবে গেটওয়ে/ক্রেডিট/সাম্প্রতিক-ব্যর্থতা চেক করে "system-side কোনো বাধা নেই" বলে সম্ভাব্য অন্য কারণ (ফোন নম্বর ফরম্যাট, নেটওয়ার্ক) সাজেস্ট করেছে — বানিয়ে কারণ বলেনি, চুপচাপ escalate-ও করেনি।

টেস্টে একটা রিয়েল বাগ ধরা পড়েছিল (শিপ করার আগেই ফিক্স হয়েছে): Carbon-এর `diffInDays()` signed sign convention-এর কারণে `days_since_last_order`/`days_since_last_used` মাঝেমধ্যে negative আসছিল — `abs()` দিয়ে ফিক্স করা হয়েছে।

### প্রি-রিকুইজিট বদলে গেছে

আগে `backend/.env`-এ `ANTHROPIC_API_KEY` বসাতে হতো — এখন সেটা আর ব্যবহৃত হয় না। এখন **সরাসরি `/admin/settings/ai-support` পেজ থেকে** যেকোনো প্রোভাইডারের key পেস্ট করে "Save this provider" চাপলেই key `ai_provider_credentials` টেবিলে এনক্রিপ্টেড অবস্থায় জমা হয়ে যায় — কোনো `.env`/ডিপ্লয় লাগে না।

## ট্রিগার ফ্লো

`GenerateAiSupportReplyJob` (queued) — সেলারের মেসেজ সেভ হওয়ার সাথে সাথেই dispatch হয় (`SupportController::send`, `SupportTicketController::store`/`send`), যতক্ষণ না কোনো human ইতিমধ্যে দায়িত্ব নিয়েছে। `hybrid-queue-worker.service` (`queue:work redis`) প্রোডাকশনে লাইভ চলছে বলে নিশ্চিত করা হয়েছে (আগে একটা পুরনো comment বলত queue worker নেই — সেটা এখন stale, §17.10-এ ফিক্স হয়ে গেছে) — তাই job সেফভাবে ব্যাকগ্রাউন্ডে চলে, সেলারের HTTP রিকোয়েস্ট সাথে সাথে রিটার্ন করে।

Frontend-এ নতুন কোনো delivery mechanism লাগেনি — লাইভ চ্যাট widget-এর বিদ্যমান 4s poll আর নতুন ticket thread-এর poll AI-এর মেসেজ এমনিতেই তুলে নেয়, ঠিক admin রিপ্লাই-এর মতোই।

Admin কোনো টিকিটে রিপ্লাই দিলে (বা "Take over" চাপলে) `assigned_admin_id`/`ai_handled=false` সেট হয়ে যায় — তারপর থেকে AI ওই টিকিটে আর ঢুকবে না।

## Endpoints

- সেলার: `GET/POST /api/tickets`, `GET /api/tickets/{id}`, `GET/POST /api/tickets/{id}/messages`, `POST /api/tickets/{id}/read`, `GET /api/tickets/unread-count`
- অ্যাডমিন: `GET /api/admin/tickets`, `GET/POST /api/admin/tickets/{id}/messages`, `POST /api/admin/tickets/{id}/take-over`, `POST /api/admin/tickets/{id}/read`, `PUT /api/admin/tickets/{id}/status`, `PUT /api/admin/tickets/{id}/priority`, `GET /api/admin/tickets/unread-count`
- AI সেটিংস: `GET/PUT /api/admin/settings/ai-support`
- AI প্রোভাইডার key: `GET /api/admin/ai-providers` (key কখনও পুরোটা রিটার্ন করে না, শুধু `has_key`/masked preview), `PUT /api/admin/ai-providers/{provider}`

## Frontend

- `/admin/tickets` — অ্যাডমিন ইনবক্স (list+thread, filters, take-over, AI ব্যাজ) — `admin/support/page.tsx`-এর একই skeleton।
- `/dashboard/tickets` — সেলার-সাইড টিকেট লিস্ট + নতুন টিকেট ফর্ম + থ্রেড ভিউ। `user-shell.tsx` মেনুতে "আমার টিকেট" এন্ট্রি।
- `/admin/settings/ai-support` — উপরে ৫টা provider credential card (key/default model/free-tier badge, নিজস্ব Save বাটন), নিচে active provider select + kill switch + model/effort/daily cap/extra prompt ফর্ম।
- লাইভ চ্যাট widget + admin support page দুটোতেই `sender_type === 'ai'` মেসেজ আলাদা (বেগুনি) bubble + badge দিয়ে দেখানো হয়।

## প্রি-রিকুইজিট (ম্যানুয়াল)

কোনো `.env` এন্ট্রি লাগে না — `/admin/settings/ai-support`-এ গিয়ে অন্তত একটা প্রোভাইডারের key সেভ করে, সেটাকে active provider হিসেবে বেছে নিয়ে, kill switch চালু করলেই AI কাজ শুরু করবে। key ছাড়া চালু করলেও কিছু ভাঙবে না — `AiProviderClientFactory::make()` `null` রিটার্ন করে, service সেটাকে disabled-এর মতোই ট্রিট করে।

## সীমাবদ্ধতা (এই রাউন্ডে ইচ্ছাকৃতভাবে বাদ)

- Category তালিকা fixed enum, admin-editable না।
- সময়ভিত্তিক SLA/auto-escalation নেই — শুধু AI-confidence-based escalation।
- কোনো knowledge-base/document-RAG নেই — AI-এর জ্ঞান system prompt + সেলারের নিজের tool-fetched ডেটা পর্যন্তই সীমাবদ্ধ।
- Ollama/self-hosted মডেল সাপোর্ট নেই এই রাউন্ডে (ইচ্ছাকৃতভাবে বাদ, দরকার হলে পরে `AiProviderClient`-এর আরেকটা adapter হিসেবে যোগ করা সহজ)।

## টেস্ট

`backend/tests/Feature/SupportTicketingTest.php` (১২টা) — ticket lifecycle/authorization, AI-dispatch guard, daily-cap reset। `backend/tests/Feature/AiProviderCredentialTest.php` (৬টা) — key কখনও echo হয় না, key-omit করে শুধু model আপডেট করা যায়, factory সঠিক adapter বেছে নেয়/no-key-এ null দেয়। কোনোটাই আসল provider API টাচ করে না। পুরো স্যুট isolated Postgres schema-তে verified: ৭০৩ passed, ৩টা pre-existing baseline failure (AuthApiTest, CourierFraudCheckApiTest, ProductMediaApiTest) অপরিবর্তিত।
