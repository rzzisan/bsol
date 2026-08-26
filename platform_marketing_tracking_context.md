# BSOL নিজের অ্যাকুইজিশন ফানেল ট্র্যাকিং (Facebook Pixel + CAPI)

Master context: `SAAS_MODULE_CONTEXT.md §25`। ডিজাইন করা হয়েছে user-এর প্রশ্নের উত্তরে: *"সেলারদের জন্য এত সুবিধা করলাম, আমাদের নিজেদের জন্য কি করলাম? বিজ্ঞাপন দিতে হলে ট্র্যাকিং কীভাবে করব, সঠিক কাস্টমারের কাছে কীভাবে দেখাব?"*

সবশেষ আপডেট: ২০২৬-০৮-২৬ — অ্যাডমিন ইভেন্ট লগ + এনগেজমেন্ট সিগন্যাল + ad-blocker fallback relay, সব লাইভ ও ভেরিফাইড।

## ১. এটা `tracking_capi_context.md`-এর থেকে আলাদা কেন

`tracking_capi_context.md`-এর পুরো পাইপলাইন (`TrackingDestination`/`TrackingIngestService`/`tracking_events`) **সেলারদের নিজের** স্টোরফ্রন্ট/ল্যান্ডিং পেজের জন্য — প্রতিটা সেলার নিজের Pixel কানেক্ট করে, নিজের কাস্টমারের ইভেন্ট নিজের বিজ্ঞাপন অ্যাকাউন্টে পাঠায়, কোটা প্যাকেজ অনুযায়ী।

এখানে বিজ্ঞাপনদাতা **BSOL নিজে** — একটাই অ্যাডভার্টাইজার, কোনো `user_id`-scoped destination না, কোনো কোটা না। তাই পুরো আলাদা, ছোট একটা পাইপলাইন: `PlatformMarketingEventService` → `PlatformMarketingEvent` → `SendPlatformMarketingEventJob`। যা রিইউজ করা হয়েছে তা সত্যিই জেনেরিক অংশ — `TrackingUserDataBuilder` (hashing) হুবহু একই ক্লাস, এবং Meta Graph API-তে POST করার শেপ `MetaCapiDriver`-এর মতোই। যেখানে সেলার-পাইপলাইনের নিজস্ব সমাধান সরাসরি রিইউজযোগ্য প্যাটার্ন (same-origin relay, §৬ দ্রষ্টব্য), সেখান থেকেই কপি করা হয়েছে, কোড শেয়ার না করে — কারণ দুই পাইপলাইনের অ্যাডভার্টাইজার/কোটা মডেল ভিন্ন।

## ২. আর্কিটেকচার — conversion পাইপলাইন (server-side, CAPI)

**দুটো ইভেন্ট, একটা অ্যাট্রিবিউশন রেকর্ড:**
- **`CompleteRegistration`** — রেজিস্ট্রেশন সম্পন্ন হলে (`OtpController::verifyRegistrationOtp()`)।
- **`Subscribe`** — পেইড প্যাকেজ activate হলে (`SubscriptionActivationService::activate()`), `custom_data.value` = payment amount। এটাই আসল conversion সিগন্যাল — শুধু সাইনআপ (CompleteRegistration) প্রমাণ করে না কেউ আসলে পেইং কাস্টমার হয়েছে।

**First-touch attribution** — হোমপেজে (`page.tsx`) প্রথমবার `utm_source/medium/campaign/content/term`/`fbclid` URL-এ পাওয়া গেলে `localStorage`-এ একবার সেভ হয় (পরের ভিজিটে ওভাররাইট হয় না)। রেজিস্ট্রেশনের সময় (`/otp/register`) সেটা POST বডিতে যায়, `pending_data`-তে স্টেজ থাকে, ইউজার তৈরির সময় (`verifyRegistrationOtp`) `users.signup_*` কলামে পার্মানেন্ট হয়। সপ্তাহ পরে পেমেন্ট approve হলেও `Subscribe` ইভেন্ট সেই একই fbp/fbc ব্যবহার করে — অ্যাট্রিবিউশন হারায় না।

**Dedup** — ক্লায়েন্ট Pixel আর সার্ভার CAPI একই `event_id` শেয়ার করে (Meta-র নিজস্ব ডকুমেন্টেড প্যাটার্ন): রেজিস্ট্রেশনে `reg_{otp_token}`, সাবস্ক্রিপশনে `sub_{payment_id}`, এনগেজমেন্ট ইভেন্টে একটা random UUID (§৩)। `PlatformMarketingEventService::track()`-এ ইনসার্টের আগে `event_id` চেক করা হয় (শুধু try/catch না) — কারণ Postgres-এ একটা ব্যর্থ unique-constraint insert পুরো wrapping transaction-কে abort করে দেয়; PHPUnit টেস্টে এটা ধরা পড়েছিল এবং ফিক্স হয়েছে।

**ক্রেডেনশিয়াল** — বিদ্যমান `PlatformFacebookSetting` মডেলেই (single-row admin settings, আগে থেকেই app_id/app_secret রাখত) নতুন ৩টা কলাম: `marketing_pixel_id`, `marketing_capi_access_token` (encrypted), `marketing_test_event_code`। নতুন টেবিল বানানো হয়নি — এটা ইতিমধ্যেই "প্ল্যাটফর্মের নিজস্ব Meta কনফিগ, admin-editable, env-fallback" এর জন্যই বানানো মডেল। লাইভ Dataset: **`BSOL_PLATFROM`** (ID `1584562686445497`, Zareen Natural Foods business portfolio-এর অধীনে, admin-এর নিজস্ব Meta Business Manager-এ তৈরি করা)।

## ৩. আর্কিটেকচার — এনগেজমেন্ট সিগন্যাল (browser + same-origin relay)

Anonymous ভিজিটরের জন্য (রেজিস্টার করার আগেই) — retargeting/lookalike Custom Audience-এর জন্য, conversion পাইপলাইনের সাথে সরাসরি সম্পর্কহীন কিন্তু **একই `PlatformMarketingEventService`/`PlatformMarketingEvent` টেবিলেই লগ হয়** (relay দিয়ে পাঠানো অংশটুকু — নিচে দেখুন)। `frontend/src/lib/homepage-engagement-tracking.ts`:

- **`PageView`** — হোমপেজে মাউন্ট হলেই একবার। `MetaPixelScript`-এর base snippet-এর নিজস্ব auto-PageView সাপ্রেস করা হয়েছে (`autoPageView={false}`, শুধু হোমপেজে — `/verify-phone`-এ এখনো auto-fire) — নাহলে একই ভিজিটর দুইবার (দুই আলাদা event_id-এ) গোনা হতো।
- **`ViewContent`** (Meta standard) — Problems/Features/Payments/How-it-works সেকশনে ~৫০% দৃশ্যমান হয়ে ~১ সেকেন্ড থাকলে একবার ফায়ার (`content_name` দিয়ে কোন সেকশন)। দ্রুত স্ক্রল-করে-চলে-যাওয়া বাউন্স স্বয়ংক্রিয়ভাবে বাদ পড়ে — কোনো page-wide dwell timer লাগে না।
- **`ScrollDepth`** (custom event) — পেজের ৭৫%/৯০% পর্যন্ত স্ক্রল করলে একবার।
- **`Lead`** (Meta standard) — রেজিস্ট্রেশন ট্যাব খুললে (CTA বাটন বা AuthSection-এর নিজস্ব ট্যাব — দুটো পথই `authTab === "register"` effect দিয়ে একসাথে কভার করা)।

**ব্যবহার:** এই সিগন্যালগুলো দিয়ে Ads Manager-এ একটা "engaged visitor" Custom Audience বানিয়ে retargeting চালানো যায় (ভিজিট করেছে, রেজিস্টার করেনি), এবং Subscribe-এর চেয়ে বড় sample থেকে একটা broader lookalike বানানো যায় prospecting-এর জন্য যতদিন না Subscribe sample যথেষ্ট বড় হয়।

### ৩.১ Ad-blocker fallback — কেন relay লাগে

লাইভ পরীক্ষায় ধরা পড়েছে: `connect.facebook.net` (Pixel script-এর নিজের ডোমেইন) হলো ওয়েবের সবচেয়ে বেশি ad-blocker-blocklisted ডোমেইনগুলোর একটা — verify করা হয়েছে যে সাধারণ ইন্টারনেট এমনকি `graph.facebook.com`-ও চলে, কিন্তু ওই একটা ডোমেইন specifically `fetch()`-এ "Failed to fetch" দিয়ে ব্যর্থ হয় (classic ad-blocker signature)। বাস্তব ভিজিটরদের ~১৫-৩০% ad-blocker ব্যবহার করে — তাদের জন্য browser Pixel কখনোই কাজ করবে না।

**সমাধান — সেলারদের জন্য যা আগে থেকেই আছে তার হুবহু কপি:** `frontend/src/lib/tracking.ts`-এর `sendEvent()` (সেলারের ল্যান্ডিং পেজ) প্রতিটা ইভেন্ট দুইভাবে পাঠায় — `fbq(...)` সরাসরি (ব্লক হলে হারায়) **এবং** নিজের ডোমেইনে (`/api/public/track`) একটা POST, যেটা `PublicTrackingController` → `TrackingIngestService` হয়ে সার্ভার-সাইড Meta-তে যায়। same-origin request কোনো পরিচিত ট্র্যাকিং ডোমেইন না বলে ad-blocker এটা ধরতে পারে না।

BSOL-এর নিজের হোমপেজেও হুবহু এই প্যাটার্ন:
- প্রতিটা এনগেজমেন্ট ইভেন্ট একটা shared random `event_id`-সহ **দুইবার** পাঠানো হয় — `fbq(...)` + `POST /api/public/marketing-track`।
- `PublicMarketingTrackController` — Host-based owner resolution লাগে না (একটাই advertiser)। `event_name` একটা allowlist-এ আটকানো (`PageView|ViewContent|ScrollDepth|Lead` — `CompleteRegistration`/`Subscribe` কখনো client-triggerable না, ওগুলো শুধু `OtpController`/`SubscriptionActivationService` থেকেই আসে)। এরপর সরাসরি বিদ্যমান `PlatformMarketingEventService::track()` কল করে — তাই dedup/logging/admin-log সব একই পাইপলাইনে যায়, `platform_marketing_events`-এ একটা রো হিসেবে।
- Meta `event_id` মিলিয়ে দুই কপি ডিডুপ করে — ব্লক-না-হওয়া ভিজিটরের জন্য duplicate count হয় না, ব্লক-হওয়া ভিজিটরের জন্য শুধু relay কপিটাই পৌঁছায় (fbp/fbc দুর্বল — Pixel-ই লোড হয়নি বলে সেই কুকি সেট হয়নি — কিন্তু IP/UA দিয়ে ইভেন্টটা তবু গণনা হয়)।

## ৪. অ্যাডমিন — সেটিংস ও ইভেন্ট লগ

- **Admin → Settings → Facebook → "Marketing Pixel" সেকশন** (`/admin/settings/facebook`) — `marketing_pixel_id`/`marketing_capi_access_token`/`marketing_test_event_code` এখান থেকেই বসানো হয়, একই "blank মানে অপরিবর্তিত" কনভেনশনে যা `app_secret`/`webhook_verify_token`-এর জন্য আগে থেকেই আছে।
- **Admin → "মার্কেটিং ইভেন্ট" (`/admin/marketing-events`)** — সেলার-facing `dashboard/analytics/tracking`-এর হুবহু super-admin কাউন্টারপার্ট: filter (status/event_name), pagination, match quality (fbp/fbc/phone coverage %), প্রতিটা রো-তে কোন ইউজার (যদি থাকে)/কত value। `PlatformMarketingEventController::index()` (`GET /admin/marketing-events`) দিয়ে চালিত — সরাসরি `TrackingEventController`-এর শেপ মিরর করা।

## ৫. ফাইল ম্যাপ

**Backend:**
- Migration ৩টা — `users.signup_*`, `platform_facebook_settings`-এ নতুন কলাম, নতুন `platform_marketing_events` টেবিল।
- মডেল/সার্ভিস/জব — `PlatformFacebookSetting.php`, `PlatformMarketingEvent.php`, `Services/Marketing/PlatformMarketingEventService.php`, `Jobs/SendPlatformMarketingEventJob.php`।
- Conversion ওয়্যারিং — `OtpController.php` (দুই মেথডেই), `SubscriptionActivationService.php`।
- Admin — `Api/Admin/PlatformFacebookSettingsController.php` (Pixel/token CRUD), `Api/Admin/PlatformMarketingEventController.php` (ইভেন্ট লগ, নতুন)।
- Public — `Api/PublicMarketingPixelController.php` (`GET /public/marketing-pixel` — শুধু Pixel ID, কখনো টোকেন না), `Api/PublicMarketingTrackController.php` (`POST /public/marketing-track` — এনগেজমেন্ট রিলে, নতুন)।
- Test — `tests/Feature/PlatformMarketingTrackingTest.php` — attribution capture, dedup, Subscribe value/currency, no-credential graceful failure, admin blank-means-unchanged, public pixel endpoint, relay endpoint (allowlist, fbclid→fbc synthesis)।

**Frontend:**
- `components/meta-pixel-script.tsx` — হোমপেজ + `/verify-phone`-এ মাউন্ট (dashboard/storefront-এ কখনো না), `autoPageView` prop।
- `lib/homepage-engagement-tracking.ts` — dual-fire (`fbq` + relay) helper + ৪টা এক্সপোর্ট (`usePageViewTracking`, `useViewContentOnVisible`, `useScrollDepthTracking`, `trackLead`)।
- `page.tsx` — UTM ক্যাপচার + register payload attribution + engagement hooks-এর ওয়্যারিং (section refs)।
- `verify-phone/page.tsx` — client-side CompleteRegistration fire (server CAPI-এর সাথে dedup)।
- `admin/settings/facebook/page.tsx` — "Marketing Pixel" সেকশন, ফুল লগের লিংক।
- `admin/marketing-events/page.tsx` — ফুল ইভেন্ট লগ পেজ (নতুন)।
- `lib/admin-menu.ts` — sidebar-এ "মার্কেটিং ইভেন্ট" এন্ট্রি (নতুন)।

## ৬. Ads Manager-এ আসলে কীভাবে ব্যবহার করবেন — "সঠিক কাস্টমারের কাছে কীভাবে দেখাব"

1. ক্যাম্পেইনের **optimization/conversion event হিসেবে `Subscribe` বেছে নিন, `CompleteRegistration` না** — একজন সাইন-আপ করা মানেই ভালো কাস্টমার না, যে পেইড হয়ে টিকে থাকে সে-ই আসল সিগন্যাল।
2. Events Manager → Custom Conversions-এ `Subscribe`-এর ওপর একটা Custom Conversion বানান (`value` field-সহ, যাতে ROAS দেখা যায়)।
3. সেই Custom Conversion থেকে একটা **Lookalike Audience** বানান — এতে Meta শুধু ক্লিক-করা মানুষ না, বরং যারা আসলে পেইড সেলার হয়েছে তাদের মতো মানুষ খুঁজে বের করবে।
4. Subscribe sample যথেষ্ট বড় না হওয়া পর্যন্ত, `ViewContent`/`Lead` (§৩) থেকে একটা broader "engaged visitor" Custom Audience/Lookalike দিয়ে prospecting চালিয়ে যান — retargeting-এর জন্যও এই audience সরাসরি ব্যবহারযোগ্য।
5. প্রথম কয়েক সপ্তাহ Test Events (`marketing_test_event_code`) দিয়ে ভেরিফাই করুন — তারপর সেটা admin UI থেকে খালি করে দিন (test code সেট থাকলে real campaign-এ কাউন্ট হয় না)।

## ৭. এই রাউন্ডে যা নেই

- GA4/অন্য কোনো analytics provider — শুধু Meta।
- `platform_marketing_events`-এর জন্য কোনো purge/retention policy (৯০ দিন পর মুছে ফেলার মতো `tracking_events`-এর যা আছে তা এখানে নেই)। এনগেজমেন্ট রিলে চালু হওয়ার পর ভলিউম উল্লেখযোগ্যভাবে বাড়বে (প্রতিটা হোমপেজ ভিজিটে সম্ভাব্য ৪-৫টা রো) — ট্রাফিক বাড়লে এটা পুনর্বিবেচনা করা উচিত।
- Engagement relay endpoint (`/public/marketing-track`)-এ কোনো per-visitor rate-limit নেই, শুধু per-IP `throttle:300,1` — একজন ম্যালিশিয়াস visitor ৩০০/মিনিট পর্যন্ত সিন্থেটিক ইভেন্ট পাঠাতে পারে (allowlist-এর বাইরের নাম আটকানো আছে, কিন্তু ভলিউম-abuse না)।
