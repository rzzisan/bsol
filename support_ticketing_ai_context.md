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

Model: `claude-opus-5` (Anthropic PHP SDK-এর Tool Runner — `$client->beta->messages->toolRunner(...)`), `thinking: adaptive`, `effort` অ্যাডমিন-কনফিগারযোগ্য (ডিফল্ট medium)।

## ট্রিগার ফ্লো

`GenerateAiSupportReplyJob` (queued) — সেলারের মেসেজ সেভ হওয়ার সাথে সাথেই dispatch হয় (`SupportController::send`, `SupportTicketController::store`/`send`), যতক্ষণ না কোনো human ইতিমধ্যে দায়িত্ব নিয়েছে। `hybrid-queue-worker.service` (`queue:work redis`) প্রোডাকশনে লাইভ চলছে বলে নিশ্চিত করা হয়েছে (আগে একটা পুরনো comment বলত queue worker নেই — সেটা এখন stale, §17.10-এ ফিক্স হয়ে গেছে) — তাই job সেফভাবে ব্যাকগ্রাউন্ডে চলে, সেলারের HTTP রিকোয়েস্ট সাথে সাথে রিটার্ন করে।

Frontend-এ নতুন কোনো delivery mechanism লাগেনি — লাইভ চ্যাট widget-এর বিদ্যমান 4s poll আর নতুন ticket thread-এর poll AI-এর মেসেজ এমনিতেই তুলে নেয়, ঠিক admin রিপ্লাই-এর মতোই।

Admin কোনো টিকিটে রিপ্লাই দিলে (বা "Take over" চাপলে) `assigned_admin_id`/`ai_handled=false` সেট হয়ে যায় — তারপর থেকে AI ওই টিকিটে আর ঢুকবে না।

## Endpoints

- সেলার: `GET/POST /api/tickets`, `GET /api/tickets/{id}`, `GET/POST /api/tickets/{id}/messages`, `POST /api/tickets/{id}/read`, `GET /api/tickets/unread-count`
- অ্যাডমিন: `GET /api/admin/tickets`, `GET/POST /api/admin/tickets/{id}/messages`, `POST /api/admin/tickets/{id}/take-over`, `POST /api/admin/tickets/{id}/read`, `PUT /api/admin/tickets/{id}/status`, `PUT /api/admin/tickets/{id}/priority`, `GET /api/admin/tickets/unread-count`
- AI সেটিংস: `GET/PUT /api/admin/settings/ai-support`

## Frontend

- `/admin/tickets` — অ্যাডমিন ইনবক্স (list+thread, filters, take-over, AI ব্যাজ) — `admin/support/page.tsx`-এর একই skeleton।
- `/dashboard/tickets` — সেলার-সাইড টিকেট লিস্ট + নতুন টিকেট ফর্ম + থ্রেড ভিউ। `user-shell.tsx` মেনুতে "আমার টিকেট" এন্ট্রি।
- `/admin/settings/ai-support` — kill switch + model/effort/daily cap/extra prompt ফর্ম, বাকি settings পেজগুলোর মতোই।
- লাইভ চ্যাট widget + admin support page দুটোতেই `sender_type === 'ai'` মেসেজ আলাদা (বেগুনি) bubble + badge দিয়ে দেখানো হয়।

## প্রি-রিকুইজিট (ম্যানুয়াল)

`backend/.env`-এ `ANTHROPIC_API_KEY` সেট করতে হবে (console.anthropic.com থেকে) — না থাকলেও কিছু ভাঙবে না, কারণ `platform_ai_support_settings.is_enabled` ডিফল্ট **false**। Key বসিয়ে `/admin/settings/ai-support`-এ গিয়ে চালু করলেই AI কাজ শুরু করবে।

## সীমাবদ্ধতা (এই রাউন্ডে ইচ্ছাকৃতভাবে বাদ)

- Category তালিকা fixed enum, admin-editable না।
- সময়ভিত্তিক SLA/auto-escalation নেই — শুধু AI-confidence-based escalation।
- কোনো knowledge-base/document-RAG নেই — AI-এর জ্ঞান system prompt + সেলারের নিজের tool-fetched ডেটা পর্যন্তই সীমাবদ্ধ।

## টেস্ট

`backend/tests/Feature/SupportTicketingTest.php` (১২টা টেস্ট) — ticket lifecycle/authorization, AI-dispatch guard (assigned/human_handled/disabled/daily-cap — কোনোটাই আসল Anthropic API touch করে না), daily-cap reset লজিক। পুরো স্যুট isolated Postgres schema-তে verified: ৬৯৭ passed, ৩টা pre-existing baseline failure (AuthApiTest, CourierFraudCheckApiTest, ProductMediaApiTest) অপরিবর্তিত।
