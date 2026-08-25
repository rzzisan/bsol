# BSOL নিজের অ্যাকুইজিশন ফানেল ট্র্যাকিং (Facebook Pixel + CAPI)

Master context: `SAAS_MODULE_CONTEXT.md §25`। ডিজাইন করা হয়েছে user-এর প্রশ্নের উত্তরে: *"সেলারদের জন্য এত সুবিধা করলাম, আমাদের নিজেদের জন্য কি করলাম? বিজ্ঞাপন দিতে হলে ট্র্যাকিং কীভাবে করব, সঠিক কাস্টমারের কাছে কীভাবে দেখাব?"*

## ১. এটা `tracking_capi_context.md`-এর থেকে আলাদা কেন

`tracking_capi_context.md`-এর পুরো পাইপলাইন (`TrackingDestination`/`TrackingIngestService`/`tracking_events`) **সেলারদের নিজের** স্টোরফ্রন্ট/ল্যান্ডিং পেজের জন্য — প্রতিটা সেলার নিজের Pixel কানেক্ট করে, নিজের কাস্টমারের ইভেন্ট নিজের বিজ্ঞাপন অ্যাকাউন্টে পাঠায়, কোটা প্যাকেজ অনুযায়ী।

এখানে বিজ্ঞাপনদাতা **BSOL নিজে** — একটাই অ্যাডভার্টাইজার, কোনো `user_id`-scoped destination না, কোনো কোটা না। তাই পুরো আলাদা, ছোট একটা পাইপলাইন: `PlatformMarketingEventService` → `PlatformMarketingEvent` → `SendPlatformMarketingEventJob`। যা রিইউজ করা হয়েছে তা সত্যিই জেনেরিক অংশ — `TrackingUserDataBuilder` (hashing) হুবহু একই ক্লাস, এবং Meta Graph API-তে POST করার শেপ `MetaCapiDriver`-এর মতোই।

## ২. আর্কিটেকচার

**দুটো ইভেন্ট, একটা অ্যাট্রিবিউশন রেকর্ড:**
- **`CompleteRegistration`** — রেজিস্ট্রেশন সম্পন্ন হলে (`OtpController::verifyRegistrationOtp()`)।
- **`Subscribe`** — পেইড প্যাকেজ activate হলে (`SubscriptionActivationService::activate()`), `custom_data.value` = payment amount। এটাই আসল conversion সিগন্যাল — শুধু সাইনআপ (CompleteRegistration) প্রমাণ করে না কেউ আসলে পেইং কাস্টমার হয়েছে।

**First-touch attribution** — হোমপেজে (`page.tsx`) প্রথমবার `utm_source/medium/campaign/content/term`/`fbclid` URL-এ পাওয়া গেলে `localStorage`-এ একবার সেভ হয় (পরের ভিজিটে ওভাররাইট হয় না)। রেজিস্ট্রেশনের সময় (`/otp/register`) সেটা POST বডিতে যায়, `pending_data`-তে স্টেজ থাকে, ইউজার তৈরির সময় (`verifyRegistrationOtp`) `users.signup_*` কলামে পার্মানেন্ট হয়। সপ্তাহ পরে পেমেন্ট approve হলেও `Subscribe` ইভেন্ট সেই একই fbp/fbc ব্যবহার করে — অ্যাট্রিবিউশন হারায় না।

**Dedup** — ক্লায়েন্ট Pixel আর সার্ভার CAPI একই `event_id` শেয়ার করে (Meta-র নিজস্ব ডকুমেন্টেড প্যাটার্ন): রেজিস্ট্রেশনে `reg_{otp_token}`, সাবস্ক্রিপশনে `sub_{payment_id}`। `PlatformMarketingEventService::track()`-এ ইনসার্টের আগে `event_id` চেক করা হয় (শুধু try/catch না) — কারণ Postgres-এ একটা ব্যর্থ unique-constraint insert পুরো wrapping transaction-কে abort করে দেয়; PHPUnit টেস্টে এটা ধরা পড়েছিল এবং ফিক্স হয়েছে।

**ক্রেডেনশিয়াল** — বিদ্যমান `PlatformFacebookSetting` মডেলেই (single-row admin settings, আগে থেকেই app_id/app_secret রাখত) নতুন ৩টা কলাম: `marketing_pixel_id`, `marketing_capi_access_token` (encrypted), `marketing_test_event_code`। নতুন টেবিল বানানো হয়নি — এটা ইতিমধ্যেই "প্ল্যাটফর্মের নিজস্ব Meta কনফিগ, admin-editable, env-fallback" এর জন্যই বানানো মডেল।

## ৩. ফাইল ম্যাপ

- Backend: migration ৩টা (`users.signup_*`, `platform_facebook_settings`-এ নতুন কলাম, নতুন `platform_marketing_events` টেবিল), `PlatformFacebookSetting.php`, `PlatformMarketingEvent.php`, `PlatformMarketingEventService.php`, `SendPlatformMarketingEventJob.php`, `OtpController.php` (দুই মেথডেই ওয়্যারিং), `SubscriptionActivationService.php`, `PlatformFacebookSettingsController.php` (admin UI + নতুন `marketingEvents()` endpoint), নতুন public `PublicMarketingPixelController.php` (`GET /api/public/marketing-pixel` — শুধু Pixel ID এক্সপোজ করে, CAPI টোকেন কখনো না)।
- Frontend: `components/meta-pixel-script.tsx` (হোমপেজ + `/verify-phone`-এ মাউন্ট, dashboard/storefront-এ কখনো না), `page.tsx` (UTM ক্যাপচার + register payload), `verify-phone/page.tsx` (client-side CompleteRegistration fire), `admin/settings/facebook/page.tsx` ("Marketing Pixel" সেকশন + সাম্প্রতিক ইভেন্ট লিস্ট)।
- Test: `backend/tests/Feature/PlatformMarketingTrackingTest.php` — attribution capture, dedup, Subscribe value/currency, no-credential graceful failure, admin blank-means-unchanged।

## ৪. Ads Manager-এ আসলে কীভাবে ব্যবহার করবেন — "সঠিক কাস্টমারের কাছে কীভাবে দেখাব"

1. ক্যাম্পেইনের **optimization/conversion event হিসেবে `Subscribe` বেছে নিন, `CompleteRegistration` না** — একজন সাইন-আপ করা মানেই ভালো কাস্টমার না, যে পেইড হয়ে টিকে থাকে সে-ই আসল সিগন্যাল।
2. Events Manager → Custom Conversions-এ `Subscribe`-এর ওপর একটা Custom Conversion বানান (`value` field-সহ, যাতে ROAS দেখা যায়)।
3. সেই Custom Conversion থেকে একটা **Lookalike Audience** বানান — এতে Meta শুধু ক্লিক-করা মানুষ না, বরং যারা আসলে পেইড সেলার হয়েছে তাদের মতো মানুষ খুঁজে বের করবে।
4. প্রথম কয়েক সপ্তাহ Test Events (`marketing_test_event_code`) দিয়ে ভেরিফাই করুন — তারপর সেটা admin UI থেকে খালি করে দিন (test code সেট থাকলে real campaign-এ কাউন্ট হয় না)।

## ৫. এই রাউন্ডে যা নেই

- `Lead`/`ViewContent` ইভেন্ট (শুধু CompleteRegistration/Subscribe — ফানেলের শুরু আর আসল conversion, মাঝেরটা স্কিপ করা হয়েছে scope রাখতে)।
- GA4/অন্য কোনো analytics provider — শুধু Meta।
- `platform_marketing_events`-এর জন্য কোনো purge/retention policy (৯০ দিন পর মুছে ফেলার মতো `tracking_events`-এর যা আছে তা এখানে নেই — ভলিউম অনেক কম বলে এখনই দরকার নেই)।
