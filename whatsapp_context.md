# WhatsApp Business Integration — Context

শেষ আপডেট: 2026-08-20 (২) — **§১ সংশোধন করা হলো — আগের এন্ট্রি ভুলভাবে "BSOL-এর App Review" বলছিল, আসলে per-seller।** সেলারের প্রশ্নে ধরা পড়ল যে "app review কার করতে হবে" এই প্রশ্নের আগের উত্তরটা Facebook Pixel/CAPI-র মডেলের সাথে ভুলভাবে মিলিয়ে ফেলা হয়েছিল। WebSearch করে confirm করা হয়েছে: System User token generate করার সময় সেলার **নিজের** কোন App-এর আন্ডারে সেটা বানাচ্ছে বেছে নেয় — এই credential-paste আর্কিটেকচারে সেটা স্বাভাবিকভাবেই সেলারের **নিজের** Meta App/Business Manager হবে, BSOL-এর App না। তার মানে ৫-নম্বর cap কাটানোর জন্য **প্রতিটা সেলারকে নিজে** তার Business Manager verify করাতে হবে — BSOL-এর একটামাত্র App Review দিয়ে সবার জন্য unlock হয় না। এই ভুল সংশোধনের সময় আরেকটা **real কোড গ্যাপ** পাওয়া গেছে ও ফিক্স করা হয়েছে (§১ক)। বিস্তারিত নিচে।

## ১. Real customer-দের জন্য কী কী লাগবে — সংশোধিত ব্যাখ্যা

**দুটো আলাদা জিনিস, দুটোই সেলার-সাইড, BSOL-এর একবারের App Review দিয়ে কোনোটাই unlock হয় না:**

1. **পাঠানোর অনুমতি (৫-নম্বর cap)** — WhatsApp Cloud API-তে একটা System User access token জেনারেট করার সময় সেলার কোন Meta App-এর আন্ডারে বানাচ্ছে সেটা বেছে নেয়; token সেই App-এর সাথে বাঁধা থাকে। এই প্ল্যাটফর্মে সেলার নিজে "Meta Business Suite → WhatsApp Manager"-এ গিয়ে token বানায় — মানে এটা স্বাভাবিকভাবেই **তার নিজের** App/Business Manager-এর আন্ডারে হয়, BSOL-এর App-এর না। ৫টা verified-tester নম্বরের বাইরে real কাস্টমারে পাঠাতে **সেলারকে নিজের Business Manager Meta-তে Business Verification করাতে হবে** (ট্রেড লাইসেন্স ইত্যাদি ডকুমেন্ট জমা — এটা `pages_messaging`-এর মতো manual reviewer/screencast App Review না, তুলনামূলক দ্রুত self-service প্রসেস)। BSOL এখানে কিছু করতে পারে না — প্রতিটা সেলারকে আলাদাভাবে এটা করতে হবে।
2. **মেসেজ পাওয়ার অনুমতি (§১ক-এ বর্ণিত `subscribed_apps` কল)** — এটা BSOL-সাইড কোড দিয়েই হয়, সেলারের কোনো Review লাগে না, শুধু connect করার সময় ঠিকভাবে wire করা থাকতে হবে (এখন আছে)।

**তাহলে BSOL নিজের কোনো App Review লাগবে কি?** এই architecture-এ (seller নিজের credential ব্যবহার করছে) — না, sending-এর জন্য BSOL-এর নিজের App-এ `whatsapp_business_messaging` চাওয়ার দরকার নেই, কারণ actual send call সবসময় সেলারের নিজের token দিয়ে হয় (`Authorization: Bearer {seller_token}`), BSOL-এর App credential ব্যবহার হয়ই না। BSOL-এর App শুধু webhook receive করার জন্য দরকার (§১ক) — সেটার জন্য App Review-এর দরকার নেই, শুধু `subscribed_apps` কল।

**সেলারকে যা বলতে হবে**: "Connect WhatsApp"-এর পর real কাস্টমারে মেসেজ পাঠাতে চাইলে নিজের Meta Business Manager-এ গিয়ে Business Verification সম্পূর্ণ করতে হবে — এটা একটা onboarding ধাপ, প্রতি সেলারের জন্য একবার।

## ১ক. 🔧 রিয়েল কোড গ্যাপ পাওয়া গেছে ও ফিক্স করা হয়েছে — inbound webhook subscribe

সেলার connect করার পর phone_number_id + access_token সেভ হলেও, Meta **কখনোই** সেই WABA-র inbound webhook event আমাদের `/facebook/webhook`-এ পাঠাত না — কারণ `POST /{waba_id}/subscribed_apps` কলটা কোথাও করা হয়নি (Facebook Page connect-এ ঠিক এই কাজটাই `FacebookGraphClient::subscribeAppToPage()` করে, WhatsApp সাইডে সেই সমতুল্য মেথডটাই বাদ পড়ে গিয়েছিল)। মানে **App Review/Business Verification স্ট্যাটাস যাই হোক না কেন, ৫টা test নম্বরের মধ্যেই থাকা সত্ত্বেও ২-way ইনবক্স কখনো কোনো inbound মেসেজ দেখাত না** — এটা কোনো Meta-side gating না, খাঁটি missing-wiring বাগ।

**ফিক্স**:
- `WhatsappCloudApiClient::subscribeAppToWaba($wabaId, $accessToken)` — নতুন মেথড, `POST /{waba_id}/subscribed_apps`, `FacebookGraphClient::subscribeAppToPage()`-এর হুবহু প্যাটার্ন।
- `WhatsappConnectionController::update()` — সেভ করার পর এখন এই কলটা করে; `waba_id` আগে ঐচ্ছিক ছিল, এখন **required** (এই কলের জন্য দরকার)। কল ব্যর্থ হলেও connection সেভ থাকে (sending/automation তখনো কাজ করবে) কিন্তু `last_error`-এ স্পষ্ট ওয়ার্নিং দেখায় — chুপচাপ silent-broken ইনবক্স না।
- ফ্রন্টএন্ড: WABA ID ফিল্ড এখন required + hint টেক্সট (কোথায় পাওয়া যাবে)।
- ২টা নতুন টেস্ট যোগ হয়েছে (subscribe fail-but-save-succeeds, waba_id ছাড়া reject)।

## ২. আর্কিটেকচার — Facebook + SMS automation প্যাটার্নের সরাসরি reuse

**নতুন কিছু বানাতে হয়নি:**
- `PlatformFacebookSetting` (app_id/app_secret/webhook_verify_token/graph_version) — WhatsApp Cloud API একই Meta App-এর অংশ, আলাদা কোনো "platform WhatsApp setting" টেবিল লাগেনি।
- `/facebook/webhook` GET verify + POST receive route, `FacebookWebhookController` — Meta App-এর **একটাই** webhook callback URL/verify token থাকে (প্রোডাক্ট-প্রতি আলাদা URL না) — `page` বনাম `whatsapp_business_account` payload-এর নিজের `object` ফিল্ড দিয়েই আলাদা হয়। `receive()`-এ একটা নতুন branch যোগ হয়েছে: `object === 'whatsapp_business_account'` → `WhatsappMessageCaptureService::handle()`।
- `OrderStatusService::transition()`-এ (`app/Services/OrderStatusService.php`) `smsAutomationService`-এর ঠিক পাশে `whatsappAutomationService->handleOrderStatusChanged()` কল যোগ হয়েছে।
- `StaffPermission::MODULE_KEYS`-এ নতুন `'whatsapp'` এন্ট্রি — connection/credential owner-only (Pattern B, `FacebookConnectController`-এর মতো), automation rules + inbox Pattern A shared (`staff_permission:whatsapp`, `FacebookLeadController`-এর মতো)।

**নতুন: `App\Services\Whatsapp\WhatsappCloudApiClient`** — `sendTemplateMessage()` (automation-এর জন্য, ২৪ ঘণ্টার উইন্ডোর বাইরে টেমপ্লেট মেসেজই একমাত্র অপশন), `sendTextMessage()` (ইনবক্স রিপ্লাই, শুধু ২৪ ঘণ্টার উইন্ডোর ভিতরে কাজ করে), `verifySignature()` (`FacebookGraphClient`-এর হুবহু HMAC লজিক, একই app secret)।

**নতুন টেবিল**: `whatsapp_business_connections` (seller-pasted phone_number_id + access_token, encrypted — OAuth না, Pixel/CAPI-র মতোই App-Review-free), `whatsapp_messages` (inbound+outbound দুটোই এক টেবিলে, `wa_id` = কাস্টমারের আসল WhatsApp নম্বর হওয়ায় customer auto-link Facebook-এর regex-guess-এর চেয়ে নির্ভরযোগ্য), `whatsapp_automation_rules`/`whatsapp_automation_logs` (`sms_automation_*`-এর হুবহু কাঠামো, একই partial-unique-index race-safety pattern)।

**গুরুত্বপূর্ণ UX পার্থক্য SMS automation থেকে**: সেলার এখানে free-form মেসেজ টাইপ করতে পারে না — WhatsApp টেমপ্লেট Meta-approved হতে হয়। আমাদের rule ফর্ম শুধু ইতিমধ্যে approved টেমপ্লেটের নাম রেফারেন্স করে + আমাদের ভ্যারিয়েবল (`customer_name`, `order_number`, ইত্যাদি — `SmsAutomationService::renderTemplate()`-এর একই ভোকাবুলারি) টেমপ্লেটের `{{1}},{{2}}...` স্লটে পজিশনালি ম্যাপ করে। টেমপ্লেট তৈরি/সাবমিট করা এই ফেজের স্কোপে নেই।

## ৩. একটা রিয়েল ট্রানজেকশন-সেফটি বাগ পাওয়া গেছে ও ফিক্স হয়েছে (টেস্ট লেখার সময়)

`WhatsappAutomationService::handleOrderStatusChanged()`-এ duplicate-trigger ধরার জন্য `UniqueConstraintViolationException` catch করে fallback insert করা হয় (`SmsAutomationService`-এর হুবহু প্যাটার্ন)। কিন্তু Postgres-এ: একটা transaction-এর ভেতরে কোনো constraint violation ঘটলে **পুরো transaction abort** হয়ে যায় — catch ব্লকের পরের যেকোনো query "current transaction is aborted" দিয়ে fail করে, যতক্ষণ না rollback হয়। Production-এ এটা সমস্যা করে না (`OrderStatusService::transition()` তার নিজের `DB::transaction()` বন্ধ হওয়ার **পরে** এই কল করে, তাই কোনো ambient transaction থাকে না) — কিন্তু ভবিষ্যতে কেউ যদি এটা কোনো transaction-এর ভেতর থেকে কল করে (অথবা RefreshDatabase দিয়ে টেস্ট লেখার সময়, যেটা পুরো টেস্টকে একটা transaction-এ wrap করে), এটা ভাঙবে।

**ফিক্স**: প্রথম (risky) insert-টাকে নিজের `DB::transaction(fn () => ...)`-এ wrap করা হয়েছে — Postgres/Laravel তখন একটা SAVEPOINT ব্যবহার করে, তাই caught violation শুধু সেই savepoint-এ rollback করে, পুরো connection poison হয় না। `WhatsappAutomationService`-এ ফিক্স করা হয়েছে। **`SmsAutomationService`-এ একই latent bug এখনো আছে** — আলাদা background task হিসেবে flag করা হয়েছে (out of scope এই PR-এর জন্য, কিন্তু একই কারণে একদিন ভাঙতে পারে)।

## ৪. API সারফেস

Owner-only (`whatsapp/connection`): `GET`/`PUT` (masked, blank access_token = অপরিবর্তিত), `POST /test-send` (Meta-র নিজের বিনামূল্যের `hello_world` টেমপ্লেট ব্যবহার করে, App Review ছাড়াই self-serve verify), `DELETE` (soft disconnect)।

`staff_permission:whatsapp` (`whatsapp/automation/rules`, `/logs`, `whatsapp/messages`, `/thread/{waId}`, `/thread/{waId}/reply`) — `SmsAutomationController`/`FacebookLeadController`-এর শেপ হুবহু।

## ৫. Frontend

`dashboard/settings/whatsapp` (owner-only connect ফর্ম + self-serve test-send), `dashboard/whatsapp/automation` (rule CRUD, template-name + comma-separated variable-mapping ইনপুট), `dashboard/whatsapp/inbox` (thread list — client-side গ্রুপিং, কোনো আলাদা "list threads" backend endpoint লাগেনি — + রিপ্লাই প্যানেল, ২৪ ঘণ্টার উইন্ডো সতর্কতা)। Sidebar-এ WhatsApp Inbox আলাদা top-level entry (unread badge সহ, Facebook Leads-এর প্যাটার্নে), WhatsApp Automation "sms" গ্রুপের ভেতরে, WhatsApp connect "settings" গ্রুপে (owner-only, পুরো গ্রুপ ইতিমধ্যে owner-only)।

## ৬. Non-goals (v1)

WhatsApp টেমপ্লেট তৈরি/সাবমিট (সেলার নিজে Meta WhatsApp Manager-এ করবে), Embedded Signup/OAuth কানেক্ট ফ্লো (deferred, credential-paste বেছে নেওয়া হয়েছে), WhatsApp send-এর জন্য কোনো billing/credit brokering (Meta সরাসরি সেলারের নিজের Business account-কে বিল করে), এক সেলারের একাধিক WhatsApp নম্বর (v1-এ এক ইউজারে এক connection)।

## ৭. টেস্ট

`backend/tests/Feature/WhatsappTest.php` — ১৬টা টেস্ট: connection save/masking + owner-only gating (subscribed_apps ফেইল হলেও save হয়, waba_id ছাড়া reject), test-send failure path, inbound capture + wa_id customer auto-link, redelivery dedupe, delivery-status update on existing outbound row, unrelated-object no-op, order-status automation send + duplicate-trigger skip (savepoint ফিক্সের পরে pass করেছে) + not-connected clean failure, reply within/outside window, staff permission gating। Full backend suite (isolated pgsql schema): pre-existing ৪টা unrelated baseline failure (`AuthApiTest`, `CollectionHistoryApiTest`, `CourierFraudCheckApiTest`, `ProductMediaApiTest`) ছাড়া সব পাস। Frontend: `tsc --noEmit` + `next build` ক্লিন।

## ৮. Deploy নোট

এই রিপো সরাসরি `bsol.zyrotechbd.com` সার্ভ করে — migration + `deploy-safe.sh` (frontend build+restart+smoke-test) দুটোই এই সেশনেই লাইভে অ্যাপ্লাই করা হয়েছে এবং ভেরিফাই করা হয়েছে (`/dashboard/settings/whatsapp`, `/dashboard/whatsapp/automation`, `/dashboard/whatsapp/inbox` সবগুলো 200)।
