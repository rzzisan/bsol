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
