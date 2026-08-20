# WhatsApp Business Integration — Context

শেষ আপডেট: 2026-08-20 — **Phase 1 সম্পূর্ণ ও লাইভ: order-status automation + 2-way ইনবক্স।** `feature_roadmap_context.md` আইটেম #২। কোড deploy করা হয়েছে (migration + backend + frontend সব লাইভ, `bsol.zyrotechbd.com`-এ verify করা হয়েছে), কিন্তু **`whatsapp_business_messaging` এখনো App Review-এ যায়নি** — বিস্তারিত §১-এ।

## ১. 🔴 লাইভ ব্লকার — real customer-দের জন্য এখনো ব্যবহারযোগ্য না

`facebook_integration_context.md`-এ ডকুমেন্টেড Facebook App Review **আংশিক পাস** হয়েছে, কিন্তু সেটা `pages_*` পারমিশন (Messenger/Page comment)-এর জন্য — WhatsApp Cloud API-র `whatsapp_business_messaging` **সম্পূর্ণ আলাদা পারমিশন**, এখনো Review-এ সাবমিটই করা হয়নি। এই পারমিশনের Advanced Access পাস না হওয়া পর্যন্ত (Standard Access-এ) শুধু Meta App dashboard-এ **verified tester** হিসেবে যোগ করা সর্বোচ্চ ৫টা নম্বরেই মেসেজ পাঠানো যাবে — real কাস্টমার নম্বরে পাঠাতে গেলে Meta রিজেক্ট করবে। এটা code-এর সমস্যা না, Meta-সাইড hard cap। ঠিক Facebook CAPI Purchase event-এর মতোই ("কোড শেষ, App Review বাকি") অবস্থা — `facebook_integration_context.md §3`।

**পরবর্তী পদক্ষেপ (business/Meta-side, কোড না)**: `whatsapp_business_messaging` App Review-এ সাবমিট করা।

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

`backend/tests/Feature/WhatsappTest.php` — ১৪টা টেস্ট: connection save/masking + owner-only gating, test-send failure path, inbound capture + wa_id customer auto-link, redelivery dedupe, delivery-status update on existing outbound row, unrelated-object no-op, order-status automation send + duplicate-trigger skip (savepoint ফিক্সের পরে pass করেছে) + not-connected clean failure, reply within/outside window, staff permission gating। Full backend suite (isolated pgsql schema): pre-existing ৪টা unrelated baseline failure (`AuthApiTest`, `CollectionHistoryApiTest`, `CourierFraudCheckApiTest`, `ProductMediaApiTest`) ছাড়া সব পাস। Frontend: `tsc --noEmit` + `next build` ক্লিন।

## ৮. Deploy নোট

এই রিপো সরাসরি `bsol.zyrotechbd.com` সার্ভ করে — migration + `deploy-safe.sh` (frontend build+restart+smoke-test) দুটোই এই সেশনেই লাইভে অ্যাপ্লাই করা হয়েছে এবং ভেরিফাই করা হয়েছে (`/dashboard/settings/whatsapp`, `/dashboard/whatsapp/automation`, `/dashboard/whatsapp/inbox` সবগুলো 200)।
