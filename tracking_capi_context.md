# BSOL Tracking Platform — Server-side + Browser-side Event Tracking (Facebook CAPI) Context

এই ফাইলটা BSOL-এর **Tracking/Attribution মডিউল**-এর একক source of truth। উদ্দেশ্য তিনটা:

1. **ফেক/অনুপস্থিত কাস্টমার কমানো** — Meta-র ad algorithm-কে "কে ফর্ম সাবমিট করেছে" নয়, "কার অর্ডার আসলে ডেলিভারি হয়েছে" সেই সিগন্যাল দেওয়া (COD মার্কেটে সবচেয়ে বড় লিভার)।
2. **আসল কাস্টমার ট্র্যাকিং** — browser (Pixel) + server (Conversions API) দুই দিক থেকে একই ইভেন্ট, `event_id` দিয়ে dedup, উচ্চ Event Match Quality।
3. **SaaS ফিচার হিসেবে বিক্রয়যোগ্য** — সেলার নিজের WordPress/WooCommerce সাইট বা BSOL landing page-এ এক ক্লিকে ট্র্যাকিং চালু করবে, প্যাকেজ অনুযায়ী দৈনিক ইভেন্ট লিমিট।

**অবস্থা (২০২৬-০৮-১৬):** **T1, T2, T5, T6, T4, T3, T7 সম্পন্ন ও লাইভ** — পরিকল্পিত পুরো ট্র্যাকিং প্ল্যাটফর্ম এখন সম্পূর্ণ। পাইপলাইন দুই কেসেই (নিজের WordPress সাইট আর BSOL সাবডোমেইন) কাজ করছে: Meta Pixel base code, browser+server funnel ইভেন্ট, order-flow ইভেন্ট BSOL সার্ভার থেকে, quota/dedup/log, dashboard থেকেই একাধিক pixel ম্যানেজ করা যায় (§6.3), **আর এখন সেলার/স্টাফ নিজেই event log ও match-quality দেখতে পারে, অ্যাডমিন এক স্ক্রিনে সব সেলারের ব্যবহার দেখতে পারে, আর অর্ডার-ডিটেইলে ট্র্যাকিং সিগন্যাল দেখা যায় (§6.4, T7)**। T4-এ একটা critical gap-ও ধরা পড়েছিল ও ঠিক হয়েছে — dashboard-এর একমাত্র Pixel-সেটিংস UI T1-এর পর থেকে পুরনো টেবিলে লিখছিল (§7.2)। একই দিনে আরেকটা gap ধরা পড়েছে ও ঠিক হয়েছে — Purchase-এর Event Match Quality কম ছিল কারণ ডুপ্লিকেট ইভেন্ট merge না হয়ে drop হতো, fbp/fbc হারিয়ে যেত (§11.4, plugin v1.18.0)। রোডম্যাপে কোনো ট্র্যাকিং ফেজ বাকি নেই — বাকি যা আছে (fraud score-এ ওজন বসানো, TikTok/GA4 destination) নতুন কাজ হিসেবে আলাদা অনুরোধ লাগবে।

> ⚠️ **প্রোডাকশনে এখন প্রতিটি প্যাকেজে `max_tracking_events_per_day = NULL` (আনলিমিটেড)।** Migration ইচ্ছাকৃতভাবে কোনো মান বসায়নি — চালু প্যাকেজে নীরবে লিমিট বসানো মানে সেলারের ইভেন্ট হারানো। **Admin → Packages** থেকে বাস্তব মান বসাতে হবে; seeder-এর প্রস্তাব: Free Trial 2,000 · Starter 5,000 · Growth 15,000 · Business আনলিমিটেড।

**পড়ার ক্রম:** §1 কেন (ব্যবসায়িক যুক্তি) · §2 আজ কী আছে/নেই · §3–§7 ডিজাইন · **§8 ডোমেইন মডেল** (সেলার কোন ডোমেইনে আছে তার উপর ট্র্যাকিং নির্ভর করে) · §10 ফেজ · §11 সিদ্ধান্ত।

**সম্পর্কিত ডকুমেন্ট:** `custom_domain_context.md` (**আগে পড়ো** — per-seller সাবডোমেইন; এই ডকের §8 তার উপর দাঁড়িয়ে), `CONTEXT.md` (§৩১ staff-role ও §৩২ সাবডোমেইন বাধ্যতামূলক চেকলিস্ট), `SAAS_MODULE_CONTEXT.md`, `facebook_integration_context.md` (§8 item 4 — বর্তমান CAPI implementation), `wordpress_connect_context.md` (§7.1 item 1 — deferred full-funnel item, এই ডকেই resolve হবে), `landing_page_context.md`, `subscription_billing_context.md`, `domain_security_audit.md`।

---

## 1. সমস্যা বিবৃতি — কেন এটা শুধু "pixel বসানো" নয়

বাংলাদেশি COD ই-কমার্সে Meta ad-এর মূল সমস্যা: Pixel-এর কাছে "Purchase" মানে **অর্ডার ফর্ম সাবমিট**। কিন্তু সেই অর্ডারের ৩০-৫০% ফেক/বাতিল/রিটার্ন হয়। ফলে Meta যে অডিয়েন্স খুঁজে আনে সেটা "ফর্ম সাবমিট করে এমন লোক", "টাকা দিয়ে পণ্য নেয় এমন লোক" নয় — অর্থাৎ ad spend নিজেই ফেক অর্ডার উৎপাদন করে।

BSOL-এর কাছে যা আছে অথচ কোনো সাধারণ pixel প্লাগইনের কাছে নেই: **অর্ডারের চূড়ান্ত পরিণতি** (courier delivery status, fraud score, blacklist, repeat-order history)। এই ডেটা CAPI-তে ফেরত পাঠানোই মূল differentiator:

| Meta-কে যা পাঠাই | কখন | কী শেখায় |
|---|---|---|
| `Purchase` ✅ | অর্ডার তৈরি হওয়ার সময় (T2) | কে ফর্ম ভরে |
| `OrderConfirmed` ✅ | `status → confirmed` (T5) | কে সত্যিই কিনতে চায় |
| `OrderDelivered` ✅ (value = total − shipping) | `status → delivered` (T5) | **কে আসলে টাকা দেয়** ← optimization target |
| `OrderReturned` ✅ (value ঋণাত্মক) | `status → returned` (T5) | কাকে বাদ দিতে হবে |
| `OrderShipped`, `OrderCanceled` ✅ | `status → shipped` / `cancelled` (T5) | funnel-এর বাকি ধাপ, `Canceled`-এও ঋণাত্মক value |

এটাই "ফেক কাস্টমার কমানো"-র প্রকৃত মেকানিজম — ব্লক করে নয়, **ad targeting-কে ঠিক লোকের দিকে ঘোরানোর মাধ্যমে**। সাথে §9-এর fraud feedback loop (session behavior → risk score) দ্বিতীয় স্তর।

**✅ T5-এ সম্পন্ন (২০২৬-০৮-১৫):** পাঁচটাই লাইভ, `OrderStatusService::transition()`-এ hook করে — এটাই এই ডকের মূল প্রতিশ্রুতি ছিল, এখন বাস্তব। বিস্তারিত §6.1, §7, §11.1।

---

## 2. বর্তমান অবস্থা — verified ground truth (কোড পড়ে যাচাই, ২০২৬-০৮-১৪)

### 2.1 যা আছে

| জিনিস | ফাইল | বাস্তব অবস্থা |
|---|---|---|
| CAPI HTTP client | `backend/app/Services/Facebook/FacebookCapiClient.php` | **একবারে একটাই ইভেন্ট** (`'data' => [$eventData]`), `access_token` body-তে, timeout 10s, ব্যর্থ হলে শুধু `Log::warning` + `false` — কোনো persistence/retry নেই |
| Purchase job | `backend/app/Jobs/SendFacebookCapiPurchaseEventJob.php` | `ShouldQueue`, `tries=3`, `backoff [10,30,60]`। শুধু `Purchase`। `event_id = 'order_'.$order->id`। `user_data`-তে শুধু `ph` (sha256) + `client_ip_address` + `client_user_agent` — **`fbp`/`fbc` নেই**, `em`/`fn`/`ln`/`ct`/`zp` নেই। currency hardcoded `BDT` |
| Dispatch sites | `LandingPageController.php:115`, `Connect/ConnectOrderController.php:211` | শুধু এই দুইটা — landing-page checkout ও WooCommerce order sync (create branch only) |
| Per-seller config | `backend/app/Models/FacebookPixelSetting.php` + migration | `pixel_id`, `access_token` (encrypted), `test_event_code`, `enabled`, `last_sent_at`, `last_error`। **`unique('user_id')` — এক সেলার = এক Pixel** |
| Route | `backend/routes/api.php:482` | `facebook/pixel` group, `owner_only` middleware (Pattern B) |
| Dashboard UI | `frontend/src/app/dashboard/settings/facebook/page.tsx` | Pixel ID / token / test event code / enable toggle / "Send Test Event" বাটন |
| Queue infra | `hybrid-queue-worker.service` (systemd, active), `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis` | চালু ও verified |
| Landing page visit analytics | `landing_page_visits`, `landing_page_statistics` টেবিল, `TrackLandingPageVisit` middleware | server-side page hit রেকর্ড হয়, কিন্তু Meta-তে যায় না |
| Multi-site WooCommerce | `platform_api_keys` (multi-row per user), `orders.platform_api_key_id` | Phase 16-এ হয়েছে — ট্র্যাকিং ইভেন্টও per-site tag করতে হবে |
| **Per-seller সাবডোমেইন** | `shop_profiles.subdomain`, `LandingPageResolver`, `SubdomainPolicy`, `FrontendUrl`, `src/proxy.ts` | **D1–D5, লাইভ ২০২৬-০৮-১৫** — §8-এর ভিত্তি বদলে দিয়েছে, §8.0 দেখো |
| **ল্যান্ডিং পেজের ঠিকানা** | `{seller}.zyrotechbd.com/{slug}`, `LandingPage::canonicalUrl()` (**nullable**) | `/lp/` মুছে ফেলা; slug per-shop unique; publish-এ সাবডোমেইন বাধ্যতামূলক |

### 2.2 যা নেই (gap)

> **T1-এ যা তৈরি হয়েছে:** নিচের ৪, ৫, ৬ নম্বরের **ভিত্তি** — `tracking_destinations` (multi-pixel), `tracking_events` (log + idempotency), `tracking_usage_daily` + `TrackingQuotaService` (quota), `TrackingIngestService`, `TrackingUserDataBuilder`।
> **T2-এ যা তৈরি হয়েছে:** `MetaCapiDriver` (আসল Meta HTTP call), `DispatchTrackingEventsJob` (fan-out + retry + log), আর `SendFacebookCapiPurchaseEventJob` নতুন পাইপলাইনের thin wrapper হয়ে গেছে — তার দুই লাইভ call site অপরিবর্তিত, শুধু ভেতরের রাস্তা বদলেছে। **Purchase এখন সত্যিই Meta-তে যাচ্ছে।**
> **T5-এ যা তৈরি হয়েছে:** `OrderStatusService::transition()`-এ hook — Confirmed/Shipped/Delivered/Returned/Canceled পাঁচটাই এখন Meta-তে যাচ্ছে, deterministic `order_{id}_{event}` id দিয়ে, P0 অগ্রাধিকারে কখনো drop হয় না। **§1-এর মূল লিভার এখন বাস্তব।**
> **T6-এ যা তৈরি হয়েছে:** সেলার সাবডোমেইনের ল্যান্ডিং পেজে Meta Pixel base code (`frontend/src/lib/tracking.ts::useBsolTracking()`), PageView/ViewContent (মাউন্টে) + InitiateCheckout/Lead (checkout ফর্মে) + Purchase (থ্যাংক ইউ পেজে) — browser + server একই `event_id`। `POST /api/public/track` (`PublicTrackingController`), host থেকে সেলার resolve, `LandingPageController::publicShow()` প্রতিটা পেজের জন্য একটামাত্র resolved `{enabled, pixel_id}` ফেরত দেয় (access token কখনো নয়)। ড্যাশবোর্ড এডিটরে per-page টগল।
> **T4-এ যা তৈরি হয়েছে (২০২৬-০৮-১৬):** WordPress প্লাগইনে `Bsol_Tracking` মডিউল (v1.17.0) — কেস A (সেলারের নিজের WordPress) এখন Full tracking পায়। `ConnectTrackingController` (batched ingest + cached config)। সাথে `FacebookPixelSettingController`-এর critical fix (§7.2)। **এখন দুটো কেসেই (A, C2) পুরো funnel + order-flow ট্র্যাকিং লাইভ** — বাকি শুধু T3 (multi-destination UI) আর T7 (event log/admin view)।

1. ~~**কোনো client-side Pixel নেই কোথাও।**~~ ✅ **T6-এ সম্পন্ন, ল্যান্ডিং পেজে** — WooCommerce সাইটে এখনো নেই (T4)।
2. ~~**Funnel-এর মাত্র শেষ ধাপ ট্র্যাক হয়।**~~ ✅ **T6-এ সম্পন্ন, ল্যান্ডিং পেজে** (AddToCart প্রযোজ্য নয় — ল্যান্ডিং পেজে আলাদা কার্ট ধাপ নেই)। WooCommerce-এ এখনো শুধু Purchase (T4)।
3. ~~**Order-flow ইভেন্ট নেই।**~~ ✅ **T5-এ সম্পন্ন** — Delivered/Returned/Confirmed/Shipped/Canceled সবই Meta-তে যাচ্ছে।
4. ~~**এক সেলার এক Pixel।**~~ ✅ **T3-এ সম্পন্ন** — একাধিক destination, dashboard CRUD, per-page/per-site scope।
5. ~~**কোনো event log নেই।**~~ ✅ **T7-এ সম্পন্ন** — dashboard-এ ফিল্টার/পেজিনেটেড event log, match-quality সারসংক্ষেপ, অ্যাডমিনের per-seller usage ভিউ, অর্ডার-ডিটেইলে ট্র্যাকিং সিগন্যাল (§6.4)।
6. **কোনো quota/rate control নেই।** একটা busy WooCommerce সাইট দিনে লাখো PageView পাঠালে BSOL-এর queue ও Meta rate limit দুটোই ভাঙবে, খরচ প্ল্যাটফর্মের ঘাড়ে পড়বে। ← **user-এর মূল requirement**। *(T1-এ সম্পূর্ণ — quota tiering, Redis কাউন্টার, দৈনিক টেবিল, সেলারের মিটার লাইভ।)*
7. **Batching এখনো ব্যবহৃত হয় না।** `MetaCapiDriver::send()` একাধিক ইভেন্ট এক HTTP call-এ পাঠাতে পারে (T2-তে বানানো), কিন্তু `DispatchTrackingEventsJob` প্রতিটা accepted ইভেন্টের জন্য আলাদাভাবে ডাকা হয় (real-time), তাই আজ প্রতি call-এ একটাই ইভেন্ট যায়। প্লাগইনের ব্যাচ রিলে (T4) বা ভবিষ্যতের retry sweep চাইলে driver-টা আজই batch নিতে পারে — কোনো বদল ছাড়া।

### 2.3 প্রাসঙ্গিক legacy prior art (`oldproject/`, `zyro/`) — পড়া হয়েছে, কপি করা হবে না

| ফাইল | কী শেখার আছে | কী কপি করা যাবে না |
|---|---|---|
| `oldproject/sales-booster-pro.2.0/includes/browser/sbsp-browser-tracking.php` | `wp_head`-এ pixel base code, default PageView suppress করে JS থেকে `eventID` সহ পাঠানো, consent + DNT চেক, thank-you পেজে PageView ব্লক, PYS/facebook-for-woocommerce ডুপ্লিকেট ডিটেকশন | সব option `get_option()`-এ hardcoded, per-seller ধারণা নেই |
| `oldproject/sales-booster-pro.2.0/assets/js/sbsp-browser-tracking.js` | **event_id কুকি প্যাটার্ন** (`sbsp_eid_{event}` — browser ও server একই id পড়ে, এটাই dedup-এর মূল), AddToCart-এর ৪টা fallback binding (single button / loop button / `added_to_cart` / `form.cart` submit), scroll-depth ও time-on-page কাস্টম ইভেন্ট | jQuery নির্ভর, `pingServer` সরাসরি admin-ajax-এ, কোনো batching/quota নেই |
| `oldproject/sales-booster-pro.2.0/includes/fb/class-sbsp-fb-capi.php` | `fbclid` → `_fbc` কুকি synthesis, `_fbp` না থাকলে নিজে বানানো, multi-pixel group loop | `CURLOPT_SSL_VERIFYPEER => false` (**নিরাপত্তা ত্রুটি, কখনো নয়**), টোকেন `get_option`-এ plaintext, `error_log` ছাড়া কোনো observability |
| `oldproject/sales-booster-pro.2.0/includes/fb/sbsp-fb-hooks.php` | **order-status → ইভেন্ট ম্যাপিং** (`OrderConfirmed`/`OrderShipping`/`OrderDelivered`/`OrderReturned`/`OrderCanceled`), AddToCart ডুপ্লিকেট ঠেকাতে ৩ সেকেন্ডের transient lock | একটাই বিশাল লাইনে minify করা কোড, hashing helper ক্লাস-নির্ভর |
| `zyro/wordpress_plugin/zayroo-connect/assets/js/fb-pixel-enhanced.js` | funnel ইভেন্ট সিকোয়েন্স | Pixel ID hardcoded ছিল একটা নির্দিষ্ট সাইটের (zisan.me, Website ID 12) — as-is অব্যবহারযোগ্য |
| `oldproject/customer-leads-manager/includes/api/class-clm-facebook-capi.php` | minimal CAPI sender | কিছুই নতুন না |

**সিদ্ধান্ত:** প্যাটার্ন (event_id কুকি, hook binding, status→event map, fbclid synthesis) নেওয়া হবে; কোড নেওয়া হবে না। BSOL-এর thin-client নীতি অনুযায়ী সব credential ও লজিক সার্ভারে থাকবে, প্লাগইন শুধু সিগন্যাল তোলে ও রিলে করে।

---

## 3. আর্কিটেকচার সিদ্ধান্ত

### 3.1 ইভেন্ট কোন পথে যাবে

```
ব্রাউজার (ক্রেতা)
   │  ১. fbq('track', 'ViewContent', {...}, {eventID: E})    → সরাসরি Meta (browser-side)
   │
   │  ২. POST /wp-json/bsol-connect/v1/t   (same-origin, সেলারের নিজের ডোমেইন)
   ▼
WordPress প্লাগইন (Bsol_Tracking)
   │  server-side enrich: fbp/fbc কুকি, IP, UA, hashed PII, product/cart data
   │  ৩. POST /api/connect/v1/tracking/events  (X-API-KEY, batched)
   ▼
BSOL Backend  ── quota check (Redis) ── log (DB) ── queue
   │  ৪. POST graph.facebook.com/{v}/{pixel}/events   (batched, eventID = E)
   ▼
Meta  → E দিয়ে browser ও server ইভেন্ট dedupe করে একটাই ইভেন্ট গণনা করে
```

**কেন প্লাগইনকে সরাসরি Meta-তে না পাঠিয়ে BSOL হয়ে পাঠানো:**
- Quota enforcement একটাই জায়গায় (প্যাকেজ লিমিট — user-এর মূল requirement)।
- সেলারের CAPI টোকেন WordPress `wp_options`-এ plaintext-এ রাখতে হয় না (legacy প্লাগইনগুলোর বড় দুর্বলতা) — টোকেন BSOL-এ encrypted থাকে।
- একটাই unified event log — সেলার ও admin দুজনেই দেখতে পায় কী গেল কী ব্যর্থ হলো।
- Retry/backoff/batching সার্ভারে, WordPress cron-এর ভরসায় নয়।
- ভবিষ্যতে TikTok/GA4 destination যোগ করলে প্লাগইন আপডেট লাগে না (BSOL-এর thin-client নীতি, `wordpress_connect_context.md §8` item 1 "delegate, don't duplicate")।

**খরচ:** BSOL সার্ভারে ট্রাফিক বাড়ে। প্রশমন: §5-এর quota + sampling + batching + `Purchase`-অগ্রাধিকার।

**কেন ব্রাউজার→WordPress same-origin (BSOL-এ সরাসরি নয়):** ad blocker ও Safari ITP third-party রিকোয়েস্ট ব্লক করে; সেলারের নিজের ডোমেইনে first-party POST প্রায় কখনোই ব্লক হয় না। এটাই "world-class" অংশ — যে ট্রাফিক browser pixel হারায়, সেটা এই পথে টিকে যায়।

### 3.2 Dedup — একমাত্র কঠিন অংশ, প্রথমেই ঠিক করতে হবে

Meta browser ও server ইভেন্ট মেলায় `event_name` + `event_id` দিয়ে (৪৮ ঘণ্টার উইন্ডো)। ভুল হলে দুই রকম বিপর্যয়: id আলাদা হলে সব ইভেন্ট **ডবল গোনা** হয়, id একই থাকলে (যেমন সব PageView-তে একই id) সব **এক গোনা** হয়।

নিয়ম:
- `event_id` **ব্রাউজারে একবার তৈরি হবে** (UUIDv4), কুকি `bsol_eid_{event}[_{bucket}]`-এ TTL সহ বসবে, এবং একই রিকোয়েস্টে সার্ভারে যাবে। সার্ভার নিজে কখনো নতুন id বানাবে না যদি ব্রাউজার একটা দেয়।
- TTL: `PageView` — page load প্রতি নতুন (কুকি নয়, in-memory); `ViewContent`/`AddToCart` — ১ ঘণ্টা bucket, product id সহ (`bsol_eid_addtocart_{productId}`); `Purchase`/order-flow — **অর্ডার-কেন্দ্রিক deterministic id**: `order_{orderId}` (বর্তমান behavior, বজায় থাকবে) এবং order-flow-এর জন্য `order_{orderId}_{event}` (একই অর্ডারের Delivered ও Purchase আলাদা ইভেন্ট, আলাদা id)।
- Server-only ইভেন্ট (যেমন `OrderDelivered`, যার কোনো browser counterpart নেই) — সার্ভারই id বানাবে, deterministic, যাতে retry-তে ডুপ্লিকেট না হয়।
- **Idempotency:** `tracking_events` টেবিলে `unique(user_id, event_id, event_name)` — একই ইভেন্ট দুবার ingest হলে দ্বিতীয়টা নিঃশব্দে drop, দুবার Meta-তে যাবে না।

### 3.3 Match quality (কে আসল কাস্টমার সেটা Meta-কে চেনানো)

প্রতি ইভেন্টে যতটা সম্ভব `user_data` — সব PII **sha256 হ্যাশ, normalize করার পরে**:

| ফিল্ড | উৎস | normalize নিয়ম |
|---|---|---|
| `ph` | order/checkout phone | digits only, `880` prefix (বর্তমান `normalizePhone()` reuse) |
| `em` | checkout email | lowercase, trim |
| `fn`/`ln` | customer name | lowercase, শুধু অক্ষর |
| `ct`/`st`/`zp`/`country` | shipping address | lowercase, space বাদ; `country` = ISO-2 (`bd`) |
| `external_id` | BSOL `customers.id` বা `phone` hash | সেলার-স্কোপড stable id |
| `fbp` | `_fbp` কুকি | হ্যাশ **নয়**, raw |
| `fbc` | `_fbc` কুকি; না থাকলে `fbclid` query থেকে `fb.1.{ms}.{fbclid}` তৈরি | raw |
| `client_ip_address` / `client_user_agent` | ব্রাউজারের আসল IP/UA (WordPress সার্ভারের নয় — §3.1-এর রিলে চেইনে এটা বহন করতে হবে) | raw |

**সতর্কতা (Phase 10-এ একবার ধরা পড়েছে):** WooCommerce থেকে আসা ইভেন্টে `$request->ip()` হলো **WordPress সার্ভারের IP**, ক্রেতার নয় — ক্রেতার IP/UA প্লাগইনকেই payload-এ পাঠাতে হবে।

**দ্বিতীয় গ্যাপ, ২০২৬-০৮-১৬-তে ধরা পড়েছে ও ঠিক করা হয়েছে — §11.4 দেখুন:** `fbp`/`fbc` এখন `orders.fbp`/`orders.fbc`-তে persist হয় (checkout-এর সময়), শুধু ইভেন্ট payload-এ transient হিসেবে থাকে না — কারণ order-flow ইভেন্ট (Confirmed/Shipped/Delivered/Returned/Canceled, §7-এ বর্ণিত) ব্রাউজার রিকোয়েস্টের অনেক পরে fire হয়, তখন কুকি পড়ার কোনো live request থাকে না।

### 3.4 Provider abstraction

টেবিল ও পাইপলাইন provider-agnostic হবে (`tracking_destinations.provider` = `meta` | ভবিষ্যতে `tiktok`/`ga4`), কিন্তু **এই রাউন্ডে শুধু `meta` implement হবে**। কারণ: পরে TikTok যোগ করতে migration নয়, শুধু একটা নতুন `TrackingDestinationDriver` লাগবে — courier provider abstraction-এ ঠিক এই প্যাটার্নই কাজ করেছে (`CourierFactory`)।

---

## 4. ডেটা মডেল

### 4.1 `tracking_destinations` ✅ **T1-এ তৈরি** (`facebook_pixel_settings`-এর উত্তরসূরি)

```
id
user_id            → shop owner (Pattern B, owner-only)
provider           string(20) default 'meta'
label              string       — সেলারের নিজের নাম, যেমন "Main Pixel", "Brand B"
pixel_id           string
access_token       text, encrypted
test_event_code    string nullable
enabled            boolean default false
scope_type         string(20) nullable  — null = shop-wide | 'landing_page' | 'platform_api_key'
                                          ('landing_domain' T8b-তে যোগ হবে, §4.4)
scope_id           bigint nullable      — কোন landing page / কোন WP site
consent_mode       string(20) default 'off'   — 'off' | 'required' (GDPR-ইশ সাইটের জন্য)
last_sent_at, last_error
timestamps
index (user_id, enabled), index (scope_type, scope_id)
```

**Migration নোট:** `facebook_pixel_settings`-এর বিদ্যমান row গুলো এখানে backfill হবে (`provider='meta'`, `label='Default'`, `scope_type=null`)। **backfill T1-এ, টেবিল তৈরির সাথে একই migration-এ** (আগের পরিকল্পনায় এটা T3-তে ছিল) — নাহলে মাঝখানে একটা ফেজ ধরে দুটো টেবিলই আংশিক সত্য বহন করত, আর সেই সময়ে লেখা প্রতিটা কোডকে "কোনটা পড়ব" ঠিক করতে হতো। পুরনো টেবিল **drop করা হবে না** — `SendFacebookCapiPurchaseEventJob` T2-তে wrapper হওয়ার আগ পর্যন্ত ওটাই পড়ে, আর রোলব্যাকের নিরাপত্তা হিসেবে অন্তত এক ফেজ থাকবে।

### 4.2 `tracking_events` ✅ **T1-এ তৈরি** (ingest log + idempotency + audit)

```
id
user_id                → shop owner
tracking_destination_id nullable (fan-out হলে একাধিক row, নাকি একটা row + per-destination result JSON — §11 open question)
platform_api_key_id    nullable  → কোন WooCommerce সাইট (Phase 16 প্যাটার্ন)
landing_page_id        nullable  → কোন landing page
order_id               nullable  → order-flow ইভেন্ট হলে
event_name             string(50)
event_id               string(100)
event_time             timestamp
action_source          string(20)  — 'website' | 'system_generated'
event_source_url       text nullable
custom_data            jsonb
user_data_hashed       jsonb   — শুধু হ্যাশ, কাঁচা PII কখনো নয়
status                 string(20) — 'queued' | 'sent' | 'failed' | 'dropped_quota' | 'duplicate'
attempts               smallint default 0
response_code          smallint nullable
error_message          text nullable
sent_at                timestamp nullable
timestamps
unique (user_id, event_name, event_id)
index (user_id, created_at), index (user_id, status), index (order_id)
```

**Retention:** ৯০ দিনের পুরনো row নিয়মিত purge (নতুন scheduled command) — নাহলে busy সেলারে এই টেবিলই সবচেয়ে বড় হয়ে যাবে। কাঁচা PII না রাখার সিদ্ধান্তও এই কারণেই (স্টোরেজ + প্রাইভেসি দুটোই)।

### 4.3 `tracking_usage_daily` ✅ **T1-এ তৈরি** (quota-র authoritative রেকর্ড)

```
id
user_id
date                 date
accepted_count       integer default 0   — quota-র বিপরীতে গোনা হয়
dropped_count        integer default 0   — quota শেষ হওয়ায় বাদ
sent_count           integer default 0   — Meta সফলভাবে নিয়েছে
failed_count         integer default 0
timestamps
unique (user_id, date)
```

Redis হলো hot counter, এই টেবিল হলো সত্য/বিলিং/UI-র উৎস — Redis উড়ে গেলেও ইতিহাস থাকে।

### 4.4 `landing_domains` (**T8b-তে স্থগিত** — কাস্টম ডোমেইন রেজিস্ট্রি)

> **আপডেট (২০২৬-০৮-১৫):** প্ল্যাটফর্ম সাবডোমেইনের জন্য এই টেবিল **আর দরকার নেই** — `shop_profiles.subdomain` (+ `subdomain_status`, `subdomain_tombstones`, `reserved_subdomains`) ইতিমধ্যেই সেই রেজিস্ট্রির কাজ করছে, এবং সেটাই একমাত্র সত্য। এখানে দ্বিতীয় একটা host রেজিস্ট্রি বানালে দুই জায়গায় সত্য থাকবে — ঠিক যেটা §8.0 নিষেধ করে। **এই টেবিল শুধু T8b-তে (সেলারের নিজের ডোমেইন, `lp.sellershop.com`) তৈরি হবে**, তখন `type` কলামেরও দরকার থাকবে না (`seller_owned` ছাড়া কিছু থাকবে না)। নিচের স্কিমা সেদিনের জন্য রাখা।


```
id
user_id             → shop owner (Pattern B)
hostname            string(190) unique   — 'shop.example.com' বা 'zareen.bsolpages.com' (normalized: lowercase, no port, no www-stripping — www আলাদা host)
type                string(20)  — 'seller_owned' | 'platform_subdomain'
landing_page_id     nullable    — null = সেলারের সব পেজ এই host-এ পাওয়া যাবে (path দিয়ে), সেট থাকলে host-টা একটা পেজের জন্য ডেডিকেটেড
verification_method string(20)  — 'dns_txt' | 'http_file'
verification_token  string(64)
verified_at         timestamp nullable
ssl_status          string(20)  — 'pending' | 'issued' | 'failed' | 'renewing'
ssl_last_error      text nullable
status              string(20)  — 'pending' | 'active' | 'disabled'
timestamps
index (user_id, status)
```

`landing_pages` টেবিলে আজ কোনো domain কলাম নেই (verified) — এই টেবিলটাই সেই ফাঁক পূরণ করে, এবং `platform_api_keys.domain`-এর (WooCommerce সাইট) সমান্তরাল ভূমিকা পালন করে।

### 4.5 `subscription_packages`-এ নতুন কলাম ✅ **T1-এ তৈরি**

```
max_tracking_events_per_day   unsignedInteger nullable   (null = unlimited)
```

`max_orders`/`max_staff`-এর হুবহু একই প্যাটার্ন (`AdminController` validation + admin packages UI + seeder)। প্রস্তাবিত ডিফল্ট: Free Trial 2,000 · Starter 5,000 · Growth 15,000 · Business null (unlimited)। মান admin UI থেকে বদলানো যাবে, কোডে hardcode নয়।

---

## 5. Quota ও ট্রাফিক নিয়ন্ত্রণ ✅ **T1-এ বাস্তবায়িত** (user-এর মূল requirement)

### 5.1 গণনার নিয়ম

- **একক:** BSOL যতগুলো ইভেন্ট *গ্রহণ* করে (accepted), প্রতিটা destination-এ fan-out আলাদা করে গোনা **হবে না** — নাহলে ৩টা pixel-ওয়ালা সেলারের কোটা ৩ গুণ দ্রুত শেষ হবে, যা বোধগম্য নয়।
- **উইন্ডো:** ক্যালেন্ডার দিন, `Asia/Dhaka` টাইমজোন (সেলারের দিন), UTC নয় — সেলার "আজকের লিমিট" বলতে যা বোঝে তার সাথে মিলবে।
- **স্কোপ:** shop owner প্রতি (staff-এর নিজস্ব কোটা নেই — Pattern B, `shopOwnerId()`)।
- **কাউন্টার:** Redis `INCR tracking:q:{ownerId}:{Ymd}` + `EXPIRE` ৪৮ ঘণ্টা। প্রতি ~৫০ ইভেন্ট বা প্রতি মিনিটে `tracking_usage_daily`-তে flush।

### 5.2 লিমিট শেষ হলে কী হবে — সব ইভেন্ট সমান নয়

এটাই ডিজাইনের সবচেয়ে গুরুত্বপূর্ণ সিদ্ধান্ত। সরল "লিমিট শেষ → সব বন্ধ" করলে সবচেয়ে দামি ইভেন্ট (Purchase/Delivered) হারিয়ে যাবে, অর্থাৎ কোটা ফুরানোর দিনগুলোতে সেলারের ad ট্র্যাকিং পুরো অন্ধ হয়ে যাবে — সেটা প্রোডাক্ট হিসেবে অগ্রহণযোগ্য।

**তিন স্তরের অগ্রাধিকার:**

| স্তর | ইভেন্ট | কোটার আচরণ |
|---|---|---|
| P0 — critical | `Purchase`, `OrderConfirmed`, `OrderDelivered`, `OrderReturned`, `Lead` | **কখনো drop হবে না**, কোটার ১০০% পেরোলেও যায়; শুধু গোনা হয় (overage হিসেবে) |
| P1 — funnel | `InitiateCheckout`, `AddToCart`, `ViewContent` | কোটার ৮০% পার হলে ৫০% sampling, ১০০% পার হলে drop |
| P2 — ambient | `PageView`, `Search`, `Scroll`, `TimeOnPage` | কোটার ৬০% পার হলে ৫০% sampling, ৮০% পার হলে drop |

Drop হলে: `tracking_events`-এ `status='dropped_quota'` লেখা হবে না (তাতে quota বাঁচানোর উদ্দেশ্যই ব্যর্থ হয় — টেবিল ঠিকই ভরে) — শুধু `tracking_usage_daily.dropped_count` বাড়বে, আর দিনে একবার একটা সারসংক্ষেপ log line।

**সেলারকে জানানো:** dashboard-এ quota মিটার (আজকের ব্যবহার / লিমিট), ৮০% পার হলে ব্যানার + notification, ১০০% পার হলে "আপনার P1/P2 ইভেন্ট আজ বন্ধ, P0 চলছে — আপগ্রেড করুন" — সরাসরি upsell পয়েন্ট।

> **বাস্তবায়িত (২০২৬-০৮-১৫, T1-এর সাথে):** `GET /tracking/usage` → **Settings → Facebook Page**-এ quota কার্ড (আজকের ব্যবহার/লিমিট, রঙিন বার, dropped ও overage, গত ৭ দিন)। ইভেন্ট পাঠানো শুরুর **আগেই** বানানো হয়েছে ইচ্ছাকৃতভাবে — T2-তে আসল ট্র্যাফিক যাওয়া শুরু করলে quota ভুল করলে সেটা দেখার কোনো উপায় না থাকা সবচেয়ে খারাপ অবস্থা হতো।
> - `state` ব্যাকএন্ডে হিসাব হয় (`ok`/`sampling`/`critical`/`exhausted`/`unlimited`/`not_in_package`), যাতে ড্যাশবোর্ড আর পরের admin ভিউ threshold নিয়ে দ্বিমত করতে না পারে।
> - মিটার **১০০%-এ থামে**; overage আলাদা সংখ্যা হিসেবে দেখায় (§11.2)।
> - ✅ **T7-এ (২০২৬-০৮-১৬):** রুট `owner_only` থেকে `staff_permission:tracking`-এ সরানো হয়েছে (§6.2 Pattern A), নতুন `tracking` module key যোগ — `Marketing → Facebook CAPI`-এর মিটারটা owner-only থেকেই যায় (destination CRUD সেই পেজেই আছে), কিন্তু একই ডেটা `Analytics → Tracking Log`-এ (§6.4) staff-এর জন্যও এখন দেখা যায়।
> - ✅ **admin-এর per-seller usage ভিউ — T7-এ সম্পন্ন**, `GET /admin/tracking/usage` + `/admin/tracking` পেজ (§6.4)।

**Admin-এর জন্য:** per-seller override (প্যাকেজ লিমিটের উপরে একটা `tracking_events_daily_override` কলাম users-এ) — বড় সেলারের সাথে আলাদা চুক্তি হলে প্যাকেজ না বদলে ছাড় দেওয়া যায়।

### 5.3 অপব্যবহার প্রতিরোধ

- Ingest রুটে `throttle:600,1` (প্রতি মিনিটে ৬০০ রিকোয়েস্ট, প্রতিটায় ৫০ পর্যন্ত ইভেন্ট batch) — API key প্রতি।
- Batch-এ সর্বোচ্চ ৫০ ইভেন্ট, payload সর্বোচ্চ ২৫৬KB।
- ব্রাউজার→WordPress ধাপে প্লাগইন নিজেই debounce করবে (একই event+bucket ৩ সেকেন্ডে একবার — sbsp-এর transient lock প্যাটার্ন)।
- একই `event_id` পুনরায় এলে `unique` constraint-এ ধরা পড়ে `duplicate` হিসেবে গণনা, quota-তে গোনা হবে না।

---

## 6. Backend ডিজাইন

### 6.1 নতুন ক্লাস

| ক্লাস | দায়িত্ব |
|---|---|
| ✅ `App\Services\Tracking\TrackingIngestService` | validate → **destination আছে কি না** → dedup → quota check/sample → `tracking_events` insert → queue dispatch। একমাত্র প্রবেশপথ (landing page, WooCommerce, internal order-flow সবাই এটাই ডাকবে)। **ক্রমটাই মূল**: destination না থাকলে কিছুই খরচ হয় না, duplicate কোটা খায় না, drop হওয়া ইভেন্ট row হয় না |
| ✅ `App\Services\Tracking\TrackingQuotaService` | `check(ownerId, priority): bool`, `record(ownerId, n)`, `usageToday(ownerId): array`। Redis + `tracking_usage_daily` |
| ✅ `App\Services\Tracking\Destinations\MetaCapiDriver` | ইভেন্ট → Meta payload map, batched POST নিতে পারে (আজ ব্যবহার ১-এ, §2.2 আইটেম ৭), response parse — Meta per-event status ফেরত দেয় না, তাই batch-এর সবগুলোকে একই ফলাফল ধরা হয় |
| ✅ `App\Services\Tracking\TrackingUserDataBuilder` | normalize + sha256 হ্যাশিং, fbp/fbc, external_id — একটাই জায়গায়, যাতে হ্যাশ নিয়ম কখনো দুই রকম না হয় |
| ✅ `App\Jobs\DispatchTrackingEventsJob` | একটা accepted ইভেন্ট → প্রযোজ্য প্রতিটা destination-এ পাঠায় (§11.1 fan-out সিদ্ধান্ত), অন্তত একটা সফল হলেই `status='sent'`, সবগুলো ব্যর্থ হলে exception ছুঁড়ে retry (`tries=3`, backoff `[10,30,60]`), শেষমেশ ব্যর্থ হলে `failed()`-এ `status='failed'` |
| ✅ `App\Console\Commands\PurgeOldTrackingEvents` | ৯০ দিনের বেশি পুরনো row মুছে। Job নয়, artisan command — `routes/console.php`-এ প্রতিদিন ০৩:৩০-এ শিডিউলড। Postgres-এ `DELETE ... LIMIT` নেই, তাই id select করে chunk-এ মোছে |
| ✅ `App\Services\OrderStatusService::submitTrackingEvent()` (T5) | `transition()`-এর শেষে hook — status→event ম্যাপ (`confirmed`→`OrderConfirmed` ইত্যাদি, §7), value = `total − shipping_charge`, `returned`/`cancelled`-এ ঋণাত্মক (§1)। নিজের try/catch-এ মোড়ানো — ট্র্যাকিং ব্যর্থ হলেও অর্ডার স্ট্যাটাস বদল আটকাবে না |
| ✅ `App\Http\Controllers\Api\PublicTrackingController` (T6) | `POST /public/track` — Host থেকে সেলার resolve (`LandingPageResolver`), `slug` (ঐচ্ছিক) থেকে পেজ scope, client IP/UA request থেকেই নেয় (body-র মান কখনো নয়), `fbclid`→`fbc` synthesis। অজানা host নিঃশব্দে `{success:true}` — host-enumeration oracle এড়াতে |
| ✅ `App\Support\LandingPageResolver::shopOwnerIdForLabel()` (T6) | নতুন resolver নয় — বিদ্যমান ক্লাসেই যোগ, `shopUserIdsForLabel()`-এর ভিত্তি হিসেবে refactor (§8.0) |
| ✅ `frontend/src/lib/tracking.ts::useBsolTracking()` (T6) | Pixel base code (default PageView suppressed), PageView/ViewContent (মাউন্টে), InitiateCheckout/Lead/Purchase (caller-triggered), সব ইভেন্টে browser+server একই `event_id` |
| ✅ `App\Http\Controllers\Api\Connect\ConnectTrackingController` (T4) | `ingest()` — batched (≤৫০), `TrackingIngestService::ingestBatch()`-এ ডেলিগেট, প্রতি ইভেন্টের status আলাদা রিপোর্ট করে। `config()` — resolved `{enabled, pixel_id}`, WooCommerce প্লাগইনের জন্য (landing page-র জন্য `LandingPageController::publicShow()`-এর সমান্তরাল) |
| ✅ `wordpress-plugin/bsol-connect/includes/modules/tracking/class-bsol-tracking.php` (T4) | `wp_head` Pixel inject, `wp_enqueue_scripts` context, `wp_ajax_bsol_track_event` (+nopriv) ব্যাচ রিলে। **REST route নয়, admin-ajax.php** — §7-এর বিচ্যুতি নোট দেখো |
| ✅ `App\Http\Controllers\Api\TrackingDestinationController` (T3) | Dashboard CRUD — `index`/`store`/`update`/`destroy`/`testEvent`, `owner_only` (Pattern B)। `scope_id` সবসময় owner-এর নিজের landing page/site কিনা যাচাই হয় (§6.3) — অন্যথায় এক সেলার আরেক সেলারের পেজে pixel পিন করতে পারত |

**`FacebookCapiClient` ও `SendFacebookCapiPurchaseEventJob` ✅ T2-তে সম্পন্ন।** `FacebookCapiClient` মোছা হয়নি কিন্তু আর ডাকা হয় না (legacy, রোলব্যাক-নিরাপত্তা হিসেবে রাখা)। `SendFacebookCapiPurchaseEventJob` এখন `TrackingIngestService::ingest()`-এর পাতলা wrapper — constructor ও দুই লাইভ dispatch call-site (`LandingPageController.php`, `ConnectOrderController.php`) অপরিবর্তিত, `FacebookPixelSetting` lookup আর সরাসরি Meta HTTP call ভেতর থেকে সরে গেছে। বাড়তি সুবিধা যেটা আগে ছিল না: এখন একই অর্ডারের জন্য দুবার dispatch হলে `tracking_events`-এর unique constraint দ্বিতীয়টা নিঃশব্দে বাতিল করে — আগে প্রতিবার সরাসরি Meta-তে যেত, ডুপ্লিকেট-প্রতিরোধ ছিল না।

### 6.2 নতুন রুট

```php
// connect/v1 group (X-API-KEY + active_subscription), WooCommerce plugin থেকে — ✅ T4-এ লাইভ
Route::post('/tracking/events', [ConnectTrackingController::class, 'ingest'])->middleware('throttle:600,1');
Route::get('/tracking/config',  [ConnectTrackingController::class, 'config'])->middleware('throttle:60,1');
//   config = {enabled, pixel_id} — consent mode/quota অবস্থা এখনো এই রেসপন্সে নেই (T7-এ প্রয়োজনমতো), প্লাগইন ক্যাশ করে (১ ঘণ্টা)

// public (landing page browser থেকে), API-key ছাড়া — সেলার resolve হয় Host থেকে (§8.0)
// slug-ভিত্তিক রুট নয়: slug এখন per-shop unique, তাই slug একা কোনো শপ নির্দেশ করে না
Route::post('/public/track', [PublicTrackingController::class, 'ingest'])->middleware('throttle:300,1'); // ✅ T6-এ লাইভ

// dashboard (owner_only — Pattern B, credential) — ✅ T3-এ লাইভ
Route::prefix('tracking/destinations')->middleware('owner_only')->group(function () {
    Route::get('/', ...); Route::post('/', ...);
    Route::put('/{id}', ...); Route::delete('/{id}', ...);
    Route::post('/{id}/test-event', ...);
});
// dashboard read-only (Pattern A — staff দেখতে পারে) — ✅ T7-এ লাইভ
Route::middleware('staff_permission:tracking')->group(function () {
    Route::get('/tracking/events', [TrackingEventController::class, 'index']); // event log, filter/paginate + match-quality
    Route::get('/tracking/usage', [TrackingUsageController::class, 'show']);   // quota meter + দৈনিক গ্রাফ (T1-এ তৈরি, T7-এ এখানে সরানো)
});

// admin — সব সেলারের আজকের ব্যবহার এক স্ক্রিনে — ✅ T7-এ লাইভ
Route::middleware('is_admin')->get('/admin/tracking/usage', [AdminTrackingController::class, 'usage']);
```

**✅ T1-এ তৈরি, T7-এ Pattern A-তে সরানো:** `GET /tracking/usage` — quota মিটার, `Marketing → Facebook CAPI`-এর কার্ডে (owner) এবং `Analytics → Tracking Log`-এ (owner + granted staff) দুই জায়গাতেই দেখায় (আজকের ব্যবহার/লিমিট, রঙিন বার, dropped ও overage, গত ৭ দিন)। `state` (`ok`/`sampling`/`critical`/`exhausted`/`unlimited`/`not_in_package`) ব্যাকএন্ডে হিসাব হয়, যাতে ড্যাশবোর্ড আর admin ভিউ threshold নিয়ে দ্বিমত করতে না পারে।

**destination CRUD এখনো `owner_only`ই** — access token সহ credential, কোনো staff grant-এই খোলে না। §6.4-এ পুরো T7 বর্ণনা।

### 6.3 ✅ T3-এ সম্পন্ন — Multi-destination dashboard UI (২০২৬-০৮-১৬)

**ব্যবহারকারীর বাস্তবতা যেটা এই ফেজের মূল প্রশ্ন ছিল:** একজন সেলারের একাধিক Pixel ID থাকতে পারে, আর একেক ল্যান্ডিং পেজে আলাদা Pixel ব্যবহার করতে পারে। এই দুটোই T1-এর স্কিমা থেকেই সমর্থিত ছিল (`tracking_destinations.scope_type`/`scope_id`) — T3 শুধু সেটার জন্য UI বানিয়েছে, নতুন কোনো ডেটা মডেল লাগেনি।

- **Settings → Facebook Page**-এর একক-পিক্সেল ফর্ম প্রতিস্থাপিত হয়েছিল একটা লিস্ট UI দিয়ে (Facebook Page connections-এর একই কার্ড-লিস্ট প্যাটার্ন) — প্রতিটা destination আলাদা কার্ড, নিজস্ব label/Dataset ID/token/enable/scope, এডিট/টেস্ট/ডিলিট বাটন, আর "নতুন ডেস্টিনেশন যোগ করুন"। **⚠️ পাতা বদলেছে, নিচে দেখো।**
- **Scope selector তিনটা অপশন:** পুরো দোকান (ডিফল্ট, `scope_type=null`) / একটা নির্দিষ্ট ল্যান্ডিং পেজ (dropdown, বিদ্যমান `GET /landing/pages` রিইউজ) / একটা নির্দিষ্ট WooCommerce সাইট (dropdown, বিদ্যমান `GET /wordpress/api-keys` রিইউজ) — দুটোই নতুন এন্ডপয়েন্ট বানাতে হয়নি।
- **Ownership যাচাই সার্ভার-সাইডে বাধ্যতামূলক:** `scope_id` client থেকে এলেও `TrackingDestinationController::assertOwnsScope()` সবসময় নিশ্চিত করে সেটা এই owner-এরই পেজ/সাইট — নাহলে এক সেলার আরেক সেলারের পেজে pixel পিন করে তার ইভেন্ট চুরি করতে পারত।
- **`FacebookPixelSettingController` (§7.2) অপরিবর্তিত থেকেছে** — একই টেবিলের একই shop-wide row (`scope_type IS NULL`), শুধু ভিন্ন UI-গুলো এখন একই ডেটা দেখায়/এডিট করে, কোনো migration বা sync দরকার হয়নি।
- **"Dataset ID (আগের নাম: Pixel ID)" লেবেল** — §11.2-এর সিদ্ধান্ত অনুযায়ী, এই ফর্মেই প্রথম প্রয়োগ হলো।
- Test event প্রতিটা destination-এর নিজস্ব credential দিয়ে (কোনো ইনগেস্ট পাইপলাইন/কোটা খরচ হয় না — ad-hoc connectivity check)।

**⚠️ আপডেট (২০২৬-০৮-১৬, একই দিনে): নিজস্ব মেইন মেনুতে সরানো হয়েছে।** ব্যবহারকারীর সিদ্ধান্ত — CAPI/Pixel কনফিগারেশন Settings → Facebook Page-এ না রেখে আলাদা **মার্কেটিং → Facebook CAPI** মেনুতে সরানো। বাস্তবায়ন:
- নতুন পেজ `frontend/src/app/dashboard/marketing/facebook-capi/page.tsx` — destination CRUD (এই সেকশনে বর্ণিত) **এবং** quota/usage মিটার (§5.2) দুটোই এখানে সরে গেছে, কারণ usage মিটার pixel-নির্ভর তথ্য, লিড-ক্যাপচার পেজে রাখার যুক্তি ছিল না।
- `dashboard/settings/facebook/page.tsx` এখন **শুধু** Facebook Page OAuth connect/disconnect (লিড ক্যাপচার) — CAPI/usage সেকশন সম্পূর্ণ সরানো, কোনো ডুপ্লিকেট কোড রাখা হয়নি।
- `user-shell.tsx`-এ নতুন টপ-লেভেল গ্রুপ `marketing` (📣), সন্তান `facebook-capi` — `OWNER_ONLY_MENU_KEYS`-এ যোগ (destination CRUD credential, Pattern B, `settings`-এর মতোই staff-এর কাছে সম্পূর্ণ অদৃশ্য)।
- ব্যাকএন্ড/রুট/মডেল **অপরিবর্তিত** — `/api/tracking/destinations` ও `/api/tracking/usage` একই আছে, শুধু কোন dashboard পেজ থেকে কল হচ্ছে সেটা বদলেছে।

**Staff-role চেকলিস্ট (CONTEXT.md §৩১ — বাধ্যতামূলক, T7-এ):**
- `tracking_destinations` = **Pattern B** (owner-only credential, `shopOwnerId()`), `owner_only` middleware।
- `tracking_events` / `tracking_usage_daily` পড়া = **Pattern A** (team-shared, `whereIn(shopUserIds())`), নতুন module key `tracking`।
- `StaffPermission::MODULE_KEYS` + `frontend/src/lib/dashboard-client.ts::STAFF_MODULE_KEYS` + `user-shell.tsx::MODULE_KEY_BY_MENU_ITEM` + `settings/staff/page.tsx::MODULE_KEYS` — চার জায়গাতেই `tracking` যোগ করতে হবে।
- Verification-এ owner + granted staff + non-granted staff — তিনটাই টেস্ট করতে হবে।

### 6.4 ✅ T7-এ সম্পন্ন — Event log, match-quality, admin usage view, অর্ডার fraud সিগন্যাল (২০২৬-০৮-১৬)

রোডম্যাপের শেষ ফেজ। কোনো নতুন migration নেই — `tracking_events`/`tracking_usage_daily` T1-এ তৈরি, এই ফেজ শুধু তার উপর read-only ভিউ বানিয়েছে।

**ব্যাকএন্ড:**
- `App\Http\Controllers\Api\TrackingEventController::index()` — `GET /tracking/events`, `staff_permission:tracking` (Pattern A)। ফিল্টার: `status`, `event_name`, `order_id`, `from`/`to`, পেজিনেটেড (ডিফল্ট ২০/পেজ, সর্বোচ্চ ১০০)। প্রতিটা row-এ raw `user_data_hashed` পাঠানো হয় না — শুধু `has_fbp`/`has_fbc` বুলিয়ান বের করে দেওয়া হয়, destination label/landing page/site name eager-loaded।
- একই কল-এ `match_quality` — সাম্প্রতিক ৫০০টা (ফিল্টার-স্কোপড) ইভেন্টের মধ্যে কতগুলোতে `fbp`/`fbc`/`ph` ছিল, শতাংশ হিসেবে। পুরো টেবিল স্ক্যান না করে ৫০০-এর sample নেওয়া ইচ্ছাকৃত — এটা দিকনির্দেশক স্বাস্থ্য-সূচক, বিলিং সংখ্যা নয়।
- `App\Http\Controllers\Api\Admin\AdminTrackingController::usage()` — `GET /admin/tracking/usage`, `is_admin`। প্রতিটা সেলারের আজকের (Asia/Dhaka) `accepted`/`dropped`/`overage`/`sent`/`failed` + প্যাকেজ লিমিট + destination সংখ্যা, এক ফ্ল্যাট লিস্টে (staff sub-account বাদ, `AdminSmsCreditController::listUserCredits()`-এর হুবহু একই shape/কনভেনশন — এই স্কেলে pagination লাগেনি)।
- `Order::trackingEvents(): HasMany` + `OrderController::show()`-এ trimmed `tracking_events` (`event_name`, `event_time`, `status`, `has_fbp`, `has_fbc`) — §৯-এর fraud feedback loop-এর প্রথম ধাপ (শুধু দেখানো, স্কোরে ওজন বসানো এখনো স্থগিত)। কোনো ইভেন্ট না থাকা নিজেই একটা সিগন্যাল, তাই খালি হলেও স্পষ্ট বার্তা দেখায়।
- Routes: `/tracking/usage` `owner_only` থেকে `staff_permission:tracking`-এ সরানো হয়েছে (§6.2)।

**ফ্রন্টএন্ড:**
- নতুন `Analytics → Tracking Log` (`/dashboard/analytics/tracking`) — usage মিটার (Marketing → Facebook CAPI-এর মতোই, একই এন্ডপয়েন্ট, staff-দের জন্যও দৃশ্যমান কারণ এই পেজ owner-only নয়) + match-quality কার্ড + ফিল্টারযোগ্য/পেজিনেটেড event log টেবিল। `user-shell.tsx`-এ `analytics` গ্রুপের নতুন সন্তান `tracking-log`, module key `tracking`।
- নতুন `/admin/tracking` — `admin-menu.tsx`-এ নতুন আইটেম, `AdminSmsCreditController`-এর মতোই ফ্ল্যাট টেবিল UI।
- `dashboard/orders/[id]/page.tsx` — Status Timeline-এর পরে নতুন "ট্র্যাকিং সিগন্যাল" প্যানেল, প্রতিটা ইভেন্ট একটা chip (নাম, সময়, fbp/fbc ব্যাজ); কোনো ইভেন্ট না থাকলে সতর্কতা বার্তা।
- `Marketing → Facebook CAPI` পেজ **অপরিবর্তিত** — destination CRUD ও usage মিটার সেখানেই থাকে (owner-only), এই ফেজ শুধু staff-দের জন্য একটা সমান্তরাল read-only ভিউ যোগ করেছে, ডুপ্লিকেট কোড নয় (দুটো পেজই একই `/tracking/usage` কল করে)।

---

## 7. WordPress প্লাগইন ডিজাইন (`Bsol_Tracking` মডিউল) ✅ **T4-এ সম্পন্ন (২০২৬-০৮-১৬, plugin v1.17.0)**

`includes/modules/tracking/class-bsol-tracking.php`, `class-bsol-master.php`-এর connected + WooCommerce-active gate-এ instantiate (বিদ্যমান ১৯টা মডিউলের মতোই — এই প্লাগইন এখন v1.16.0-এ, মূল ডিজাইনের সময়ের চেয়ে অনেক দূর এগিয়েছে; সবচেয়ে আপডেট তথ্যের জন্য `wordpress_connect_context.md` দেখো, এই ফাইল নয়)।

### ⚠️ বাস্তবায়নে একটা ইচ্ছাকৃত বিচ্যুতি — `register_rest_route()` নয়, `admin-ajax.php` রিলে

মূল পরিকল্পনায় ছিল একটা first-party REST endpoint (`register_rest_route('bsol-connect/v1', '/t')`, public `permission_callback`)। কোড লেখার সময় দেখা গেল প্লাগইনের **প্রতিটা** storefront-facing মডিউল (checkout-otp, abandoned-checkout — দুটোই storefront JS থেকে BSOL-এ ডেটা পাঠায়) ইতিমধ্যেই একটা ভিন্ন, প্রমাণিত প্যাটার্নে দাঁড়িয়ে আছে: `admin-ajax.php` + nonce + `nopriv` hook pair, PHP-সাইড `Bsol_Api` দিয়ে BSOL-এ রিলে।

**সিদ্ধান্ত: সেই বিদ্যমান প্যাটার্নই অনুসরণ করা হয়েছে, নতুন REST route বানানো হয়নি।** কারণ:
- মূল পরিকল্পনার same-origin যুক্তি (ad blocker/Safari ITP এড়ানো) **অক্ষুণ্ণ থাকে** — `admin-ajax.php` সেলারের নিজের ডোমেইনেই, browser-এর কাছে এটাও same-origin।
- API key কখনো ব্রাউজারে পৌঁছায় না — PHP-সাইড রিলে-ই সেটা নিশ্চিত করে, একটা নতুন REST endpoint বানালেও একই গ্যারান্টি লাগত, তাই দ্বিতীয় প্যাটার্ন যোগ করার কোনো লাভ ছিল না।
- একই প্লাগইনে দুই রকম storefront-relay প্যাটার্ন (কিছু REST route দিয়ে, কিছু admin-ajax দিয়ে) রক্ষণাবেক্ষণের জটিলতা বাড়াত — একটাই কনভেনশন সহজ।

**দায়িত্ব (বাস্তবায়িত):**
1. `wp_head` — Pixel base code inject, pixel id `Bsol_Api::get_tracking_config()`-এর ক্যাশড (১ ঘণ্টা hit / ৫ মিনিট miss — `Bsol_Update_Checker`-এর একই TTL-ভিন্ন প্যাটার্ন) রেসপন্স থেকে, **কখনো hardcoded নয়**। ডিফল্ট `fbq('track','PageView')` নেই — JS নিজে eventID সহ পাঠায়।
2. `wp_enqueue_scripts` — `assets/js/bsol-tracking.js` + localized context (page type, product/purchase ডেটা, currency, nonce, ajax_url, DNT flag)। **jQuery-নির্ভর** — মূল পরিকল্পনায় "vanilla JS" লেখা ছিল, কিন্তু প্লাগইনের প্রতিটা বিদ্যমান storefront/admin JS ফাইল (checkout-otp, abandoned-checkout, admin.js) ইতিমধ্যেই jQuery ব্যবহার করে (WordPress core dependency, বাড়তি payload নয়) — সামঞ্জস্য রাখা হয়েছে।
3. `wp_ajax_bsol_track_event` + `_nopriv_` — ব্যাচ রিলে (উপরের নোট দেখো)। এখানে server-side enrichment হয় (`$_COOKIE['_fbp']`/`_fbc`, real client IP `Bsol_Helpers::client_ip()`-এ নতুন, UA)।
4. **Server-side hook থেকে কোনো order-flow ইভেন্ট নয়** — নিচে দেখো, এটা মূল পরিকল্পনা থেকে সবচেয়ে বড় সরল করা।
5. Batch buffer — একই page load-এর PageView+ViewContent একসাথে; একটা ৫০ms debounce timer (JS-সাইড, `setTimeout`), `pagehide`-এ flush। ৫ সেকেন্ডের `wp_schedule_single_event`-ভিত্তিক সার্ভার-সাইড ব্যাচিং লাগেনি — client-side debounce যথেষ্ট, আর সরল।
6. Duplicate-pixel ডিটেকশন (PixelYourSite/Facebook-for-WooCommerce warning) — **স্থগিত**, নিচে §7.1 দেখো।
7. Consent/DNT — **শুধু DNT বাস্তবায়িত** (`DNT: 1` হলে JS কিছুই পাঠায় না)। `consent_mode='required'` গেটিং UI **স্থগিত** — বাংলাদেশে আইনি বাধ্যবাধকতা নেই (§11.1 #5), আর কোনো seller এখনো এই টগল চায়নি।

**ইভেন্ট → WooCommerce hook ম্যাপ (বাস্তবায়িত):**

| ইভেন্ট | ব্রাউজার ট্রিগার |
|---|---|
| PageView | সব পেজে (order-received বাদে) |
| ViewContent | `is_product()`, ১ ঘণ্টা কুকি-bucket (product id-ভিত্তিক) |
| AddToCart | ২টা binding — `form.cart` submit (single-product ক্লাসিক) + WooCommerce-এর নিজস্ব `added_to_cart` jQuery ইভেন্ট (AJAX loop button)। মূল পরিকল্পনার ৪টার মধ্যে বাকি দুটো (non-AJAX loop button, `woocommerce_ajax_added_to_cart` PHP hook) **স্থগিত** — এই দুটোই বাস্তবে বিরল কেস কভার করে |
| InitiateCheckout | `is_checkout()`, পেজ লোডে একবার, ১ ঘণ্টা bucket |
| Lead | `#billing_phone`/`#billing_email` blur/change-এ valid হলে, একবার |
| Purchase | order-received পেজে, `order_{bsolOrderId}` (নিচে দেখো) |

**⚠️ Order-flow ইভেন্ট (Confirmed/Shipped/Delivered/Returned/Canceled) এই মডিউল থেকে যায় না — সম্পূর্ণ বাদ, `woocommerce_order_status_changed` hook নেই।** T5-এ `OrderStatusService::transition()` এগুলো ইতিমধ্যেই পাঠায়, BSOL-এর courier-verified স্ট্যাটাস দিয়ে — WooCommerce-এর নিজস্ব স্ট্যাটাস (courier delivery-র চেয়ে পিছিয়ে থাকে) থেকে ডুপ্লিকেট/ভুল সিগন্যাল পাঠানোর কোনো কারণ নেই।

**Purchase-এর দুই কপি, ইচ্ছাকৃতভাবে:**
- **Authoritative:** `ConnectOrderController::sync()`-এর create branch, order sync-এর সময়েই সার্ভার-সাইড (T2, আগে থেকেই লাইভ)। `class-bsol-order-sync.php` সেই রেসপন্স থেকে `_bsol_order_id` মেটা লেখে (T4-এ নতুন — এই মেটা না থাকলে browser-side Purchase-এর eventID বানানো যেত না)।
- **Browser copy:** `bsol-tracking.js`, order-received পেজে, একই `order_{id}` eventID দিয়ে। BSOL-এর নিজস্ব `tracking_events` unique index-এ ডুপ্লিকেট ধরা পড়ে (বিনামূল্যে no-op, দ্বিতীয়বার গোনা হয় না) — এর একমাত্র মূল্য fbp/fbc match-quality enrichment আর ব্রাউজার Pixel এক্সটেনশন visibility, কোনো নতুন conversion নয়।

### 7.1 এই রাউন্ডে যা স্থগিত

- **Duplicate-pixel detection** (PixelYourSite/Facebook-for-WooCommerce সক্রিয় থাকলে admin notice) — polish আইটেম, ফিচার কাজ করার জন্য জরুরি নয়।
- **Consent-mode গেটিং UI** — কোনো ব্যবহারকারী এখনো চায়নি, আইনি বাধ্যবাধকতাও নেই।
- **AddToCart-এর বাকি ২টা binding** (উপরে দেখো)।

কোনোটাই স্থাপত্যগত বাধা নয় — যেকোনোটা পরে যোগ করা যাবে একটা ছোট, স্বয়ংসম্পূর্ণ ফেজে।

### 7.2 ⚠️ একটা critical gap ধরা পড়েছে এবং সাথে সাথে ঠিক করা হয়েছে — dashboard-এর একমাত্র Pixel-সেটিংস UI পুরনো টেবিলে লিখছিল

T4 বানানোর সময় দেখা গেল: `FacebookPixelSettingController` (Settings → Facebook Page-এর `GET`/`PUT /facebook/pixel`) T1-এর পরেও **এখনো `facebook_pixel_settings`-এ পড়ছিল ও লিখছিল**, `tracking_destinations`-এ নয়। T1-এর backfill migration-time-এ একবারই চলেছিল — তারপর থেকে দাশবোর্ড দিয়ে Pixel কনফিগার করা **যেকোনো সেলারের জন্য** `tracking_destinations`-এ কোনো row তৈরিই হতো না, মানে T2/T5/T6/T4 পুরো পাইপলাইনটাই তাদের জন্য নীরবে `no_destination` থাকত। এটাই এই মুহূর্তে একমাত্র UI যেটা দিয়ে একটা destination তৈরি করা যায় (T3-এর ফুল CRUD এখনো হয়নি), তাই এই বাগ থাকা অবস্থায় T4 বানানোর কোনো ব্যবহারিক মূল্য ছিল না — **একই পাসে ঠিক করা হয়েছে**।

**ফিক্স:** কন্ট্রোলার এখন `TrackingDestination` (scope_type IS NULL, shop-wide) পড়ে/লেখে। Frontend অপরিবর্তিত — `masked()`-এর আউটপুট shape (`pixel_id`, `access_token_set`, `test_event_code`, `enabled`, `last_sent_at`, `last_error`) `FacebookPixelSetting::masked()`-এর হুবহু superset, তাই কোনো ফ্রন্টএন্ড বদল লাগেনি। `facebook_pixel_settings` টেবিল/মডেল স্পর্শ করা হয়নি (রোলব্যাক-নিরাপত্তা, T1-এর কনভেনশন), শুধু আর কেউ লেখে না। প্রোডাকশনে দুটো টেবিলই খালি ছিল (যাচাই করা হয়েছে) — কোনো ডেটা-মিসম্যাচ ঠিক করার দরকার হয়নি, শুধু ভবিষ্যতের জন্য পথ বন্ধ করা হয়েছে।

---

## 8. Origin/Domain মডেল — কোন সেলার কোন ডোমেইনে, ট্র্যাকিং কীভাবে বদলায়

ট্র্যাকিং-এর গুণমান নির্ভর করে **ব্রাউজার কোন ডোমেইনে দাঁড়িয়ে আছে** তার উপর — `_fbp`/`_fbc` কুকি ডোমেইন-স্কোপড, আর Meta-র domain verification ডোমেইন-ভিত্তিক।

**আজ বাস্তবে দুটো কেস** (সাবডোমেইন ফিচার আসার পর, ২০২৬-০৮-১৫):

| কেস | কোথায় | কারা | অবস্থা |
|---|---|---|---|
| **A** | সেলারের নিজের WordPress/WooCommerce সাইট | **সংখ্যাগরিষ্ঠ** — যারা নিজের সাইটে বিজ্ঞাপন চালায় | **লাইভ**, ট্র্যাকিং T4-এ (plugin v1.17.0) |
| **C2** | `{seller}.zyrotechbd.com` | যারা শুধু BSOL ল্যান্ডিং পেজ ব্যবহার করে | **লাইভ**, ট্র্যাকিং T6-এ |

**দুটোতেই Full tracking** — browser Pixel + server CAPI, `event_id` dedup। কেস B (শেয়ার্ড প্ল্যাটফর্ম ডোমেইন) বিলুপ্ত, কেস C1 (সেলারের নিজের ডোমেইন) T8b-তে।

### 8.0 হোস্ট রেজলিউশন — নতুন resolver লেখা যাবে না

**নিয়ম: ইভেন্ট কোন সেলারের, সেটা সবসময় রিকোয়েস্টের `Host` থেকে সার্ভার নিজে বের করবে — ক্লায়েন্টের পাঠানো `destination_id`/`user_id` কখনো বিশ্বাস করা হবে না।**

**কেন এটা নিরাপত্তার প্রশ্ন, শুধু পরিপাটি নয়:** ক্লায়েন্ট-সরবরাহকৃত id বিশ্বাস করলে সেলার A সেলার B-র quota শেষ করে দিতে পারবে, বা B-র Pixel-এ ভুয়া ইভেন্ট ঢোকাতে পারবে।

```
Host → (user_id, scope) → প্রযোজ্য tracking_destinations
   ├── platform_api_keys.domain    → WooCommerce সাইট  (বিদ্যমান, Phase 16)
   ├── shop_profiles.subdomain     → সেলারের সাবডোমেইন (বিদ্যমান, D2)
   └── landing_domains.hostname    → সেলারের নিজের ডোমেইন (T8b)
```

**⚠️ এটা ইতিমধ্যেই তৈরি — নতুন `TrackingHostResolver` ক্লাস বানানো যাবে না।** সাবডোমেইনের কাজেই হয়ে গেছে; ট্র্যাকিং নিচেরগুলোই ব্যবহার করবে:

| যা ব্যবহার করতে হবে | কী দেয় |
|---|---|
| `App\Support\LandingPageResolver` | Host → শপ → ওই শপের slug। প্রতিটি পাবলিক ল্যান্ডিং endpoint এখান দিয়েই যায় |
| `App\Support\SubdomainPolicy` | label বৈধতা, reserved ও tombstone চেক |
| `GET /api/public/shop-by-subdomain/{label}` | Next.js proxy যেটা ডাকে |
| `AuthenticatePlatformApiKey::matchesDomain()` | WooCommerce API key ইতিমধ্যেই domain-bound — একই নীতি |

**⚠️ `x-bsol-shop-subdomain` হেডারের উপর কোনো অনুমোদন সিদ্ধান্ত নেওয়া যাবে না।** proxy ইনবাউন্ড কপি মুছে দেয় (`domain_security_audit.md` M-1), কিন্তু ব্যাকএন্ডের সিদ্ধান্ত সবসময় `$request->getHost()` থেকেই হবে।

**দুটো আলাদা সত্যের উৎস রাখা যাবে না** — এটাই এই সেকশনের মূল কথা।

### 8.1 কেস A — সেলারের নিজের WordPress সাইট (সংখ্যাগরিষ্ঠ)

ব্রাউজার সেলারের নিজের ডোমেইনে (`shop.example.com`)। কোনো আপস নেই:

- `_fbp`/`_fbc` first-party, অন্য সেলারের সাথে মেশে না।
- সেলার নিজের Business Manager-এ **নিজের ডোমেইন verify করতে পারে** (সে-ই মালিক)।
- `event_source_url` তার নিজের verified ডোমেইনেই।
- Ingest same-origin (`/wp-json/bsol-connect/v1/t`) → ad blocker ও Safari ITP প্রায় ছুঁতে পারে না। **এটাই সবচেয়ে বড় কারিগরি সুবিধা** — যে ট্র্যাফিক browser pixel হারায়, এই পথে টিকে যায়।

**আচরণ: Full tracking**, §7-এর ডিজাইন অনুযায়ী (T4)।

### 8.2 কেস B — শেয়ার্ড প্ল্যাটফর্ম ডোমেইন — ⛔ বিলুপ্ত

`/lp/{slug}` মুছে ফেলা হয়েছে; প্ল্যাটফর্ম host-এ ল্যান্ডিং পেজ resolve করাই বন্ধ। **এই কেসটা আর অস্তিত্বে নেই।**

মূল ডকে এই কেসের জন্য "Basic tracking" (server-only) আর `bsol_fbp_{destinationId}` namespaced কুকির একটা পুরো মেকানিজম ডিজাইন করা ছিল — **সবটাই বাতিল**। শেয়ার্ড ডোমেইনের যে দুটো correctness bug সেগুলো ঠেকাতে বানানো হয়েছিল (`_fbc` ক্রস-কন্টামিনেশন: A-র বিজ্ঞাপন-ক্লিক B-র ক্যাম্পেইনে attribute হয়ে যাওয়া; `_fbp` শেয়ার্ড নেমস্পেস), সেগুলো এখন **কাঠামোগতভাবে অসম্ভব** — আলাদা origin, exact-host কুকি। অ্যাপ্লিকেশন-স্তরে namespace বানানোর দরকারই নেই।

শেয়ার্ড ডোমেইনের **একটাই সমস্যা টিকে আছে: রেপুটেশন** — §8.6 দেখো।

### 8.3 কেস C2 — `{seller}.zyrotechbd.com` (লাইভ)

ডিজাইন ও বাস্তবায়ন: `custom_domain_context.md`। ট্র্যাকিং-এর দিক থেকে যা জানা দরকার:

- ✅ **কুকি exact host-এ**, `domain=` অ্যাট্রিবিউট ছাড়া — এটা একটা **হার্ড কনস্ট্রেইন্ট** (`custom_domain_context.md §2`), শুধু সুপারিশ নয়। `SESSION_DOMAIN=null`-ও একই কারণে অপরিবর্তনীয়।
- ✅ **Full tracking** — browser Pixel + server CAPI, `event_id` dedup।
- ✅ **domain verification:** সেলার নিজে সাবডোমেইন verify করতে পারে না (Meta শুধু root নেয়), কিন্তু **আমরা `zyrotechbd.com` একবার verify করলেই সব সাবডোমেইন ঢেকে যায়** — per-seller কাজ শূন্য। সেলারের বিজ্ঞাপন এতে আটকায় না (§11-এর নিষ্পত্তি তালিকা দেখো)।
- ✅ **AEM কোনো ঘাটতি নয়** — Meta ২০২৫-এর জুনে web ইভেন্টের ম্যানুয়াল AEM কনফিগারেশন তুলে দিয়েছে, এখন স্বয়ংক্রিয়। কনফিগার করার মতো কিছু **কারও** হাতেই নেই।
- ⚠️ **রেপুটেশন শেয়ার্ড** — §8.6। এটাই C2-র একমাত্র প্রকৃত সীমাবদ্ধতা।

**সারমর্ম: সাবডোমেইনে বিজ্ঞাপন চালানোয় ট্র্যাকিং-এর কোনো বাস্তব সীমাবদ্ধতা নেই।**

#### ⚠️ C2-র নিজস্ব শর্ত — Pixel কখনো ড্যাশবোর্ডে লোড হবে না

সাবডোমেইনে **ল্যান্ডিং পেজ ও ড্যাশবোর্ড একই origin-এ** (`{seller}.zyrotechbd.com/{slug}` ও `/dashboard/...`)। তাই Pixel base code **শুধু পাবলিক ল্যান্ডিং রুটে**, `/dashboard/*`-এ **কখনো নয়**:

1. সেলারের নিজের ড্যাশবোর্ড ব্রাউজিং PageView ইভেন্ট হয়ে **নিজের কোটা খাবে** ও audience নষ্ট করবে — সেলার নিজেই "সবচেয়ে engaged ভিজিটর" হয়ে যাবে।
2. ড্যাশবোর্ড URL-এ order id ও ক্রেতার ফোন থাকে; `event_source_url` হিসেবে Meta-তে পাঠানো মানে ক্রেতার ডেটা অপ্রয়োজনে বাইরে যাওয়া।

*টোকেন-চুরির দিক থেকে এটা নতুন ঝুঁকি নয়* — সেলার আগে থেকেই `html_sections`/`custom_css` দিয়ে ওই origin-এ যা খুশি JS চালাতে পারে, আর ঝুঁকিটা তার **নিজের** অ্যাকাউন্টেই সীমাবদ্ধ (`domain_security_audit.md`-এ গৃহীত)। উপরের কারণ দুটো correctness ও প্রাইভেসির, নিরাপত্তার নয়।

### 8.4 কেস C1 — সেলারের নিজের ডোমেইন (T8b, পরে)

`lp.sellershop.com` CNAME → আমাদের সার্ভার। কেস A-র সমান: সম্পূর্ণ first-party, সেলার নিজে Meta-তে verify করতে পারে, নিজের রেপুটেশন।

**বিক্রয়-যুক্তি: ব্র্যান্ডিং + রেপুটেশন আলাদা রাখা** — AEM নয় (সেটা এখন সবার জন্যই স্বয়ংক্রিয়)।

লাগবে: `landing_domains` টেবিল (§4.4), catch-all nginx block (`server_name _;` → অজানা host-এ 444), DNS TXT verification (`_bsol-verify.{host}`), verified হওয়ার পর queued job থেকে per-domain Certbot HTTP-01, আর `ssl_status` স্টেট মেশিন **সেলারকে UI-তে দেখানো** — নীরব ব্যর্থতা এখানে সবচেয়ে খারাপ ফল, কারণ পেজই খুলবে না।

### 8.5 কেসগুলোর তুলনা

| | কেস A (নিজের WP) | কেস C2 (আমাদের সাবডোমেইন) | কেস C1 (নিজের ডোমেইন, T8b) |
|---|---|---|---|
| অবস্থা | লাইভ, ট্র্যাকিং T4-এ | **লাইভ**, ট্র্যাকিং T6-এ | পরে |
| Browser Pixel | ✅ | ✅ (ল্যান্ডিং রুটে, ড্যাশবোর্ডে নয়) | ✅ |
| Server CAPI | ✅ | ✅ | ✅ |
| `fbp`/`fbc` আইসোলেশন | পূর্ণ | পূর্ণ (exact-host কুকি) | পূর্ণ |
| সেলার নিজে domain verify | পারে | পারে না (আমরা apex verify করি, সব কভার) | পারে |
| AEM | স্বয়ংক্রিয় | স্বয়ংক্রিয় | স্বয়ংক্রিয় |
| Ad blocker/ITP প্রতিরোধ | সর্বোচ্চ (same-origin relay) | সর্বোচ্চ (same-origin) | সর্বোচ্চ |
| রেপুটেশন | সেলারের নিজের | **শেয়ার্ড** ← একমাত্র পার্থক্য | সেলারের নিজের |
| ট্র্যাকিং টিয়ার | **Full** | **Full** | **Full** |

**প্রোডাক্ট ফ্রেমিং:** পুরনো পরিকল্পনা ছিল "Basic ফ্রি, Full কাস্টম ডোমেইনের সাথে"। সেটা আর খাটে না — **সবাই Full পায়**। বিক্রির যুক্তি সরে গেছে **ইভেন্ট কোটায়** (§5), যা ব্যবহারের সাথে রৈখিকভাবে বাড়ে বলে upsell হিসেবে বেশি স্বাভাবিক।

### 8.6 ⚠️ একমাত্র প্রকৃত সীমাবদ্ধতা — শেয়ার্ড রেপুটেশন

সেলার সাবডোমেইন `zyrotechbd.com`-এই, যেখানে ড্যাশবোর্ড, API ও প্রতিষ্ঠানের মূল সাইটও আছে। কোনো সেলারের ল্যান্ডিং পেজ Meta বা Google Safe Browsing-এ ফ্ল্যাগ হলে **parent domain-এর reputation প্রভাবিত হতে পারে**, আর তাতে সবাই একসাথে ভুগবে।

মূল ডিজাইনে আলাদা apex (`bsolpages.com`) সুপারিশ করা হয়েছিল ঠিক এই কারণে; বাস্তবায়নে একই apex ব্যবহার হয়েছে। **এখন আর সস্তায় বদলানো যাবে না** — সেলাররা সাবডোমেইন নিয়ে ফেলেছে, আর host বদলানো মানে প্রত্যেকের `_fbp`/`_fbc` হারানো (§8.7)। যদি কখনো সরাতেই হয়, সেটা **বিজ্ঞাপন শুরুর আগে এবং একবারেই সবার জন্য**।

**প্রশমন (আলাদা apex ছাড়াই):** ল্যান্ডিং পেজ কনটেন্ট মডারেশন, publish-এ abuse রিপোর্টের পথ, আর Meta-য় ডোমেইন-স্তরের সতর্কতা এলে দ্রুত সাড়া দেওয়ার জন্য admin-এ দৃশ্যমানতা। এগুলো ট্র্যাকিং ফেজের অংশ নয়, কিন্তু ঝুঁকিটা লিখে রাখা দরকার।

### 8.7 ⚠️ সেলারকে যা অবশ্যই জানাতে হবে — ঠিকানা বদলালে ট্র্যাকিং রিসেট হয়

সাবডোমেইন বদলানো যায় (পুরনোটা tombstone-এ যায়, শপের বর্তমান ঠিকানায় 301 হয়)। কিন্তু ট্র্যাকিং-এর দিক থেকে এর **তিনটে পরিণতি**:

1. **`_fbp`/`_fbc` রিসেট** — নতুন host মানে নতুন কুকি ডোমেইন; প্রতিটা ফিরতি ভিজিটর Meta-র কাছে নতুন ব্যক্তি।
2. **`event_source_url` বদলে যায়** — Meta-র কাছে ভিন্ন ডোমেইন।
3. ⚠️ **retired label-এ ingest POST নীরবে ব্যর্থ হবে** — বেশিরভাগ HTTP ক্লায়েন্ট ও `fetch` 301-এ POST-কে GET-এ নামায়। পুরনো host-এ খোলা থাকা ব্রাউজার থেকে ইভেন্ট আর পৌঁছাবে না, অথচ কোনো ত্রুটিও দেখা যাবে না।

**করণীয়:** সাবডোমেইন বদলানোর UI-তে ট্র্যাকিং-সচেতন সতর্কতা (T6), আর ingest ব্যর্থতা মাপার ব্যবস্থা — **নীরব শূন্যতা এখানে সবচেয়ে খারাপ ফল**। সুপারিশ: বিজ্ঞাপন চালুর আগেই ঠিকানা চূড়ান্ত করা।

### 8.8 ল্যান্ডিং পেজে কারিগরি বাস্তবায়ন ✅ **T6-এ সম্পন্ন (২০২৬-০৮-১৫)**

Landing page BSOL-এর Next.js-এ: পাবলিক ঠিকানা `{seller}.{apex}/{slug}`, আর `src/proxy.ts` সেটাকে ভেতরে `/lp/{slug}`-এ rewrite করে (rewrite proxy-কে পুনরায় ডাকে না, তাই যেকোনো host-এ সরাসরি `/lp/...` চাওয়া 404)।

- **`event_source_url`** — মূল পরিকল্পনায় ছিল সার্ভার-সাইড `LandingPage::canonicalUrl()` (nullable) দিয়ে বানানো। বাস্তবায়নে সহজ ও শক্তিশালী: প্রতিটা ইভেন্টে ব্রাউজার নিজেই `window.location.href` পাঠায় (`frontend/src/lib/tracking.ts`) — ব্রাউজার যেখানে দাঁড়িয়ে সেটাই আসল পাবলিক ঠিকানা, তাই `canonicalUrl()`-এর nullability-র সমস্যাটাই আর ওঠে না। (সার্ভার-সাইড Purchase-এর জন্য `canonicalUrl()` এখনো ব্যবহৃত হয় — T2/`LandingPageController::publicSubmitOrder()`, অপরিবর্তিত।)
- `LandingPageController::publicShow()` প্রতিটা রেসপন্সে একটা resolved `tracking: {enabled, pixel_id}` object যোগ করে (`trackingConfigFor()`) — **access token কখনো নয়**, আর কখনো একাধিক destination-এর তালিকা নয় (§11.3 আইটেম ৪ নিষ্পত্তি — নিচে §11.1)। Owner resolution `User::find($page->user_id)?->shopOwnerId()` দিয়ে, কারণ `LandingPage.user_id` staff-ও হতে পারে (Pattern A)।
- **base code শুধু পাবলিক ল্যান্ডিং রুটে**, `/dashboard/*`-এ কখনো নয় (§8.3) — এডিটরের live-preview-ও `disabled: previewMode` দিয়ে বাদ, কারণ preview iframe ড্যাশবোর্ডেরই ভেতরে রেন্ডার হয়।
- `useBsolTracking()` (`frontend/src/lib/tracking.ts`) — PageView / ViewContent (মাউন্টে) / InitiateCheckout (checkout ফর্মের প্রথম ইনপুট) / Lead (ফোন valid হলে) / Purchase (thank-you)। AddToCart প্রযোজ্য নয় — ল্যান্ডিং পেজে আলাদা কার্ট ধাপ নেই, পুরো পেজটাই "content"। `fbq` + server POST একই `event_id` দিয়ে; PageView প্রতি মাউন্টে নতুন (in-memory), ViewContent/InitiateCheckout/Lead ১ ঘণ্টার কুকি-bucket-এ (§3.2), Purchase deterministic `order_{id}` (server-side Purchase-এর সাথে dedup pair)।
- Ingest রুট **host-ভিত্তিক**: `POST /api/public/track` (`PublicTrackingController`), Host থেকে `LandingPageResolver::shopOwnerIdForLabel()` দিয়ে resolve (নতুন resolver নয়, বিদ্যমান ক্লাসে যোগ)। **slug-ভিত্তিক রুট বানানো হয়নি** — body-তে ঐচ্ছিক `slug` শুধু কোন পেজ তা নির্দেশ করে, সেলার কে সেটা নয়। সাবডোমেইনে API same-origin, তাই CORS-এর প্রশ্নও নেই। অজানা host নিঃশব্দে গ্রহণ করে কিছু না লিখেই — 404/422 দিলে সেটাই host-enumeration oracle হয়ে যেত।
- client IP/UA — Phase 10-এর WooCommerce সতর্কতা (§3.3) এখানে প্রযোজ্য নয়: ব্রাউজার সরাসরি BSOL-এর নিজের API-তে POST করছে, তাই `$request->ip()`/`userAgent()` ব্রাউজারেরই — body-তে client যা পাঠায় তা উপেক্ষা করে সার্ভার নিজে বসায়।
- `landing_pages.content.settings.tracking_enabled` — per-page toggle, ডিফল্ট `true` (ভাষা-নির্ভর নয়, তাই `getDefaultSettings()`-এর বাইরে)। ড্যাশবোর্ড এডিটরে ("Meta (Facebook) ট্র্যাকিং") OTP টগলের ঠিক নিচে।
- বিদ্যমান `landing_page_visits` টেবিল **অপরিবর্তিত** (BSOL-এর নিজস্ব analytics) — tracking pipeline-এর সাথে মেশানো হয়নি, উদ্দেশ্য আলাদা।

## 9. Fraud feedback loop — "ফেক কাস্টমার কমানো"-র দ্বিতীয় স্তর

ট্র্যাকিং যে session সিগন্যাল তোলে, সেগুলো BSOL-এর বিদ্যমান fraud স্কোরিং-এ ইনপুট হিসেবে দেওয়া যায় (এটা কোনো pixel প্লাগইন পারে না, কারণ তাদের অর্ডার ডেটা নেই):

| সিগন্যাল | ইঙ্গিত |
|---|---|
| অর্ডারের আগে কোনো session ইভেন্টই নেই | বট/স্ক্রিপ্টেড অর্ডার, বা তৃতীয় পক্ষ ফর্ম ভরেছে |
| Page dwell < ৫ সেকেন্ড, scroll ~0%, তবু অর্ডার | দায়সারা/ফেক অর্ডারের শক্তিশালী ইঙ্গিত |
| একই `fbp` থেকে আলাদা ফোনে একাধিক অর্ডার | একই ব্যক্তির multiple ফেক অর্ডার |
| `fbc` আছে (আসল ad click) | ইতিবাচক সিগন্যাল, ঝুঁকি কমায় |
| ViewContent → AddToCart → Checkout স্বাভাবিক সময় ব্যবধানে | ইতিবাচক |

**স্কোপ:** ✅ **T7-এ সম্পন্ন** — অর্ডার-ডিটেইলে ট্র্যাকিং ইভেন্ট + fbp/fbc উপস্থিতি দেখানো পর্যন্ত (§6.4)। fraud score-এ ওজন বসানো এখনো আলাদা, ভবিষ্যতের কাজ — বাস্তব ডেটা জমার পরে ক্যালিব্রেট করতে হবে, অন্ধভাবে ওজন বসালে ভালো অর্ডার ব্লক হবে, যা COD ব্যবসায় বেশি ক্ষতিকর।

---

## 10. ফেজ পরিকল্পনা

**ক্রম পরিবর্তন (২০২৬-০৮-১৫):** T5 এগিয়ে আনা হয়েছে (আগে T4-এর পরে ছিল), আর T3-এর backfill T1-এ ঢুকেছে। কারণ **§1-এর মূল লিভার (`OrderDelivered` → Meta) সম্পূর্ণ server-side** — এর জন্য ব্রাউজার কোড, প্লাগইন বা Meta domain verification কিছুই লাগে না। তাই তিন ফেজেই (T1→T2→T5) বিক্রয়যোগ্য differentiator দাঁড়িয়ে যায়, বাকি সব তার উপর মান যোগ করে।

| ফেজ | পরিধি | নির্ভরতা |
|---|---|---|
| **T1** ✅ | ডেটা মডেল (৩ টেবিল + package কলাম) + `TrackingQuotaService` + `TrackingIngestService` + `TrackingUserDataBuilder` + `app:purge-tracking-events` + admin package UI-তে লিমিট ফিল্ড। **`facebook_pixel_settings` → `tracking_destinations` backfill এখানেই** (§4.1)। **সম্পন্ন ২০২৬-০৮-১৫** | — |
| **T2** ✅ | `MetaCapiDriver` + `DispatchTrackingEventsJob` (fan-out/retry/log) + `SendFacebookCapiPurchaseEventJob`-কে নতুন পাইপলাইনে wrapper করা (behavior অপরিবর্তিত, দুটো লাইভ call-site অস্পৃশ্য)। **সম্পন্ন ২০২৬-০৮-১৫**, migration নেই | T1 |
| **T5** ✅ | **Order-flow ইভেন্ট** — `OrderStatusService::transition()`-এ hook, Confirmed/Shipped/Delivered/Returned/Canceled, deterministic `order_{id}_{event}`, ব্যর্থতা status transition আটকায় না। ← **এখানেই প্রোডাক্টের মূল মূল্য, এখন লাইভ। সম্পন্ন ২০২৬-০৮-১৫**, migration নেই | T2 |
| **T6** ✅ | Landing page ট্র্যাকিং (Next.js), সেলার সাবডোমেইনে **Full tracking** (browser Pixel + CAPI, `event_id` dedup) + per-page toggle। host resolution বিদ্যমান `LandingPageResolver`-এ (§8.0)। **সম্পন্ন ২০২৬-০৮-১৫**, migration নেই | T2 |
| **T4** ✅ | WordPress প্লাগইন `Bsol_Tracking` মডিউল — base code, browser JS (jQuery), `admin-ajax.php` batch relay, funnel ইভেন্ট। **সম্পন্ন ২০২৬-০৮-১৬** (plugin v1.17.0), migration নেই। সাথে `FacebookPixelSettingController`-এর critical fix (§7.2) | T2 |
| **T3** ✅ | Multi-destination **UI** — dashboard CRUD, scope selector (শপ-ওয়াইড/ল্যান্ডিং পেজ/WooCommerce সাইট), একাধিক pixel। **সম্পন্ন ২০২৬-০৮-১৬**, migration নেই | T1 |
| **T7** ✅ | Dashboard: event log, quota মিটার, match-quality সারাংশ; fraud signal অর্ডার-ডিটেইলে প্রদর্শন; অ্যাডমিন per-seller usage ভিউ; `tracking` staff module key। **সম্পন্ন ২০২৬-০৮-১৬**, migration নেই | T2–T6 |
| **T8b** | সেলারের নিজের ডোমেইন (§8.4) — `landing_domains` টেবিল, DNS verification, per-domain Certbot, catch-all nginx। **বিক্রয়-যুক্তি ব্র্যান্ডিং + রেপুটেশন আলাদা রাখা** — AEM আর যুক্তি নয়, কারণ AEM এখন সবার জন্যই স্বয়ংক্রিয় (§11.2) | T6 |

**T8a** — ✅ সম্পন্ন (per-seller সাবডোমেইন), `custom_domain_context.md` দেখো।

### 10.1 কেন এই ক্রম — ডোমেইনের কাজ ট্র্যাকিং আটকায়নি

T8a (per-seller সাবডোমেইন) ট্র্যাকিং শুরুর **আগেই** সম্পূর্ণ হয়ে গেছে, ট্র্যাকিং-এর জন্য নয়, নিজের কারণে। ফলে "কাস্টম ডোমেইন আগে লাগবে কি না" প্রশ্নটা নিজে থেকেই মিটে গেছে, এবং যে ডিজাইন-শর্তটা নিয়ে দুশ্চিন্তা ছিল — **host-ভিত্তিক resolution প্রথম দিন থেকেই** — সেটা এখন বিনামূল্যে পূরণ (§8.0)। **একমাত্র ফাঁদ: ভুল করে দ্বিতীয় একটা resolver লিখে ফেলা।**

**T8b (সেলারের নিজের ডোমেইন) ট্র্যাকিং আটকাবে না** — এবং এখন আগের চেয়ে জোরালোভাবে, কারণ:

1. §1-এর মূল লিভার (`OrderDelivered` → Meta) **সম্পূর্ণ server-side** — ডোমেইনের উপর কোনো নির্ভরতা নেই।
2. **কেস A ও C2 দুটোই আজ Full tracking পায়** (§8.5), তাই T8b কোনো ট্র্যাকিং-ক্ষমতা আনলক করে না — শুধু ব্র্যান্ডিং ও আলাদা রেপুটেশন।
3. T8b একটা **স্বতন্ত্র ops প্রকল্প** (catch-all nginx, DNS verification, per-domain Certbot + renewal মনিটরিং, ব্যর্থতার state machine) — ট্র্যাকিং-এর উপ-অংশ নয়।

**প্রতি ফেজের বাধ্যতামূলক চেকলিস্ট** (প্রতিষ্ঠিত কনভেনশন):

- isolated Postgres schema-তে টেস্ট (create → `DB_SCHEMA=xxx php artisan test` → drop)
- **২টা পরিচিত pre-existing failure baseline** (`AuthApiTest`, `CourierFraudCheckApiTest`) মিলিয়ে দেখা
- `php artisan migrate --force` প্রোডাকশনে (**এই checkout-ই প্রোডাকশন**)
- frontend বদলালে `deploy-safe.sh`; প্লাগইন বদলালে `php -l` + hook/nonce/AJAX-action cross-check + `SETUP.md`-এ QA সেকশন
- staff-role তিন-কেস verification (§6.2) — `CONTEXT.md §৩১`
- **`CONTEXT.md §৩২`-এর সাবডোমেইন চেকলিস্ট** — Host থেকে সিদ্ধান্ত নিচ্ছি কি না, `LandingPageResolver`/`FrontendUrl` ব্যবহার করছি কি না, নতুন top-level রুট হলে proxy-র `APP_PATHS`-এ যোগ হয়েছে কি না

---

## 11. সিদ্ধান্ত

### 11.1 নিষ্পত্তি হয়ে গেছে

| # | প্রশ্ন | সিদ্ধান্ত | কখন/কীভাবে |
|---|---|---|---|
| ১ | **Fan-out মডেল** — এক ইভেন্ট একাধিক destination-এ গেলে কয়টা row? | **একটা row**, fan-out হয় dispatch-এ (T2)। quota গোনা হয় ingest-প্রতি, destination-প্রতি নয় — দুটো সামঞ্জস্যপূর্ণ থাকে, আর ৩টা pixel-ওয়ালা সেলারের কোটা ৩ গুণ দ্রুত শেষ হয় না | T1-এ বাস্তবায়িত |
| ২ | **P0 overage কি quota-তে গোনা হবে?** | **না, আলাদা `overage_count` কলামে**। একসাথে গুনলে মিটার ১০০% পেরিয়ে যেত অথচ কিছুই ব্লক হয়নি — বাগ মনে হতো | T1-এ বাস্তবায়িত |
| ৫ | **Consent ডিফল্ট** | **`off`**, তবে per-destination টগল আছে (`consent_mode`)। বাংলাদেশে কুকি-কনসেন্ট আইনি বাধ্যবাধকতা নয়; আন্তর্জাতিক ট্র্যাফিকওয়ালা সেলারকে চালু করার সুপারিশ থাকবে | T1-এ স্কিমায় |
| ৬ | **শেয়ার্ড ডোমেইনে browser Pixel চালানো হবে?** | **প্রশ্নটাই বিলুপ্ত** — শেয়ার্ড ডোমেইনে আর ল্যান্ডিং পেজ নেই (§8.2)। সেলার সাবডোমেইনে Pixel **চালানো হবে**, শুধু পাবলিক ল্যান্ডিং রুটে | ২০২৬-০৮-১৫ |
| ৪ | **ল্যান্ডিং পেজের public payload-এ dataset id enumerate করা যাবে কি না** | **যাবে না** — `publicShow()` প্রতিটা রেসপন্সে একটামাত্র resolved `{enabled, pixel_id}` দেয়, host/slug-স্কোপড; কোনো এন্ডপয়েন্ট সেলারের destination-এর তালিকা ফেরত দেয় না | T6-এ বাস্তবায়িত |
| ৭ | **Meta domain verification সাবডোমেইনে?** | **সেলার পারবে না** — Meta শুধু root ডোমেইন নেয়। নিচের ১১.২ দেখো | Business Manager-এ যাচাই |
| ৯ | **`landing_pages.slug` global নাকি per-seller unique?** | **per-seller** (`unique(user_id, slug)`)। `/lp/` ও `legacy_slug` মুছে ফেলায় alias টেবিলের জটিলতা লাগেনি | বাস্তবায়িত |
| ১০ | **DNS Cloudflare-এ সরানো হবে?** | **হয়েছে** — wildcard DNS + DNS-01 auto-renew চালু | বাস্তবায়িত |
| ১১ | **একই apex নাকি আলাদা?** | **একই apex** (সুপারিশের বিপরীতে)। রেপুটেশন ঝুঁকি বহাল ও গৃহীত — §8.6 | বাস্তবায়িত |
| ৩ | **`OrderDelivered`-এর `value` কী হবে** — অর্ডারের মোট, নাকি ডেলিভারি চার্জ বাদে? | **পণ্যের মূল্য, shipping বাদে** — `total − shipping_charge`। ROAS হিসাবে shipping revenue হিসেবে গোনা হয় না | T5-এ বাস্তবায়িত |
| ১২ | **`OrderReturned`/`OrderCanceled`-এর `value`** — §1-এ শুধু "negative/exclusion audience" লেখা ছিল, সংখ্যা নির্দিষ্ট ছিল না | **ঋণাত্মক** — Delivered-এর একই সূত্রের বিপরীত চিহ্ন (`-(total − shipping_charge)`), ০ হলে ঋণাত্মক করা হয় না। এটা একটা modeling সিদ্ধান্ত, ডেটা জমার পর দরকার হলে বদলানো যাবে — কোনো migration লাগে না, শুধু payload ফিল্ড | T5-এ বাস্তবায়িত |

### 11.2 Meta domain verification — বিস্তারিত (২০২৬-০৮-১৫, Business Manager-এ সরাসরি যাচাই)

Meta-র "Add a domain" ডায়ালগ:
> *"You can only verify the root domain (example.com), not a subdomain (store.example.com)."*
> *"Domains can only be added to one business but can be shared with designated partners."*

| প্রশ্ন | উত্তর |
|---|---|
| সেলার নিজের সাবডোমেইন verify করতে পারবে? | **না** — সাবডোমেইন verification মেকানিজমই নেই |
| তাহলে আমরা কী করব? | **`zyrotechbd.com` (root) একবার verify করব** — root verify করলে সব সাবডোমেইন ঢেকে যায়, per-seller কাজ শূন্য |
| verify করলে সেলারের বিজ্ঞাপন আটকাবে? | **না।** Meta-র ডক: verification নিয়ন্ত্রণ করে *"who can edit link descriptions on ads pointing to your domain"* — **সম্পাদনা, লিংক দেওয়া নয়** |
| partner-sharing কী দেয়? | **শুধু "Link to domain"** — লিংক-প্রিভিউ টেক্সট/ক্রিয়েটিভ কাস্টমাইজ করার অধিকার। **AEM নয়।** কোনো সেলার নিজের প্রিভিউ কাস্টমাইজ করতে চাইলে তখন তাকে partner করা যাবে — বিরল, চাহিদামতো |
| AEM প্রায়োরিটি কে সেট করবে? | **কেউ না।** Meta ২০২৫-এর জুনে web ইভেন্টের ম্যানুয়াল AEM কনফিগারেশন (৮-ইভেন্ট র‍্যাংকিং) তুলে দিয়েছে; এখন স্বয়ংক্রিয়। **আমাদের Business Manager-এ যাচাই করা — Events Manager-এ ট্যাবটাই নেই।** ৮-ইভেন্টের মডেল টিকে আছে শুধু iOS **app** ক্যাম্পেইনে, যা আমাদের সেলাররা চালায় না |

**করণীয় (এককালীন, T6-এর আগে):** Cloudflare-এ TXT রেকর্ড দিয়ে `zyrotechbd.com` verify করা। zone আমাদের, তাই apex অন্য সার্ভারে (`.198`) থাকলেও সমস্যা নেই।

**📝 পরিভাষা — "Pixel" এখন "Dataset":** Meta UI-তে pixel-কে এখন Dataset বলে (Events Manager → Datasets)। **API অপরিবর্তিত** (`/{pixel_id}/events`), তাই `tracking_destinations.pixel_id` কলাম ও কোড ঠিকই আছে। **কিন্তু সেলার-মুখী লেবেল বদলাতে হবে** — "Pixel ID" লেখা থাকলে সেলার Events Manager-এ ওই নামে কিছু পাবে না। T3-এর ফর্মে: **"Dataset ID (পুরনো নাম: Pixel ID)"** + পথনির্দেশ।

### 11.3 এখনো খোলা

| # | প্রশ্ন | কখন লাগবে | প্রাথমিক ঝোঁক |
|---|---|---|---|
| ৮ | **T8b-তে DNS পদ্ধতি** — CNAME (সহজ, apex-এ চলে না) বনাম A রেকর্ড (apex-এ চলে, সার্ভার IP বদলালে সব সেলারকে বদলাতে হয়) | **T8b** | সাবডোমেইনে CNAME বাধ্যতামূলক (`lp.sellershop.com`), apex সাপোর্ট নয় |

### 11.4 ⚠️ Purchase-এর Event Match Quality কম ছিল — root cause ধরা পড়েছে ও ঠিক করা হয়েছে (২০২৬-০৮-১৬)

সেলার একটা Meta Events Manager স্ক্রিনশট দিয়ে জানালেন Purchase-এর EMQ 3.8/10, Browser ID (fbp) মাত্র ৩৩% ইভেন্টে যাচ্ছে। কোড পড়ে root cause বের হলো:

**`tracking_events`-এর dedup (`unique(user_id, event_name, event_id)`) শুধু ডুপ্লিকেট ঠেকাত, merge করত না।** প্রতিটা অর্ডারে Purchase-এর জন্য দুইটা সোর্স একই `event_id` (`order_{id}`) দিয়ে পাঠানোর চেষ্টা করে — সার্ভার-সাইড (checkout submit-এই dispatch, ph+IP+UA আছে কিন্তু fbp/fbc নেই — job-এর constructor-এ সেগুলো নেওয়ারই ব্যবস্থা ছিল না) আর ব্রাউজার-সাইড pixel কল (thank-you/order-received পেজে, fbp/fbc আছে কিন্তু ad-blocker-এ প্রায়ই ব্লক হয়ে যায় এবং সার্ভার ইভেন্টের অনেক পরে fire হয়)। দুটোই একই event_id-তে ঢুকতে চাইলে **দ্বিতীয়টা silently drop হতো** — অথচ কোডের দুটো আলাদা জায়গার কমেন্টেই ("free duplicate", "enrichment") ধরে নেওয়া হয়েছিল merge হয়। বাস্তবে হতো না — বিজয়ী (প্রায় সবসময় সার্ভার-সাইড) ইভেন্টেই fbp/fbc কখনো পৌঁছাতই না।

**ফিক্স, তিন স্তরে:**

1. **`TrackingIngestService::mergeIfStillQueued()`** (নতুন) — ডুপ্লিকেট event_id এলে, আর row এখনো `queued` (dispatch হয়নি) থাকলে, নতুন কপির যেসব ফিল্ড প্রথম কপিতে নেই সেগুলো ভরে দেয় (gap-fill only — যেটা প্রথমেই ছিল সেটাই জেতে)। যেকোনো ভবিষ্যৎ client-vs-server race-এর জন্য জেনেরিক backstop।
2. **`orders.fbp` / `orders.fbc`** (নতুন কলাম, raw pass-through — কখনো hash হয় না, TrackingUserDataBuilder-এর RAW ক্লাসিফিকেশনের মতোই) — checkout submit-এর সময়ই persist হয় (landing page: `$request->cookie('_fbp')`/`('_fbc')`, same-origin request; WooCommerce: `$_COOKIE` প্লাগইনের `build_order_payload()`-এ, একই request-এ যেখানে `client_ip`/`user_agent` আগে থেকেই forward হচ্ছিল)। এটাই আসল ফিক্স — race-এর ফলাফলের ওপর নির্ভর করে না।
3. **`SendFacebookCapiPurchaseEventJob`** ও **`OrderStatusService::submitTrackingEvent()`** (order-flow ইভেন্ট) দুটোই এখন `$order->fbp`/`$order->fbc` পড়ে পাঠায় — order-flow ইভেন্টের (Confirmed/Shipped/Delivered/Returned/Canceled) কোনো browser counterpart কখনোই থাকে না, তাই এদের জন্য persist করা ছাড়া fbp/fbc পাওয়ার আর কোনো উপায়ই ছিল না — এতদিন শুধু `ph` পাঠানো হতো।

WordPress প্লাগইন v1.18.0 — শুধু `build_order_payload()`-এ দুটো ফিল্ড যোগ, কোনো নতুন hook/JS লাগেনি (কুকি আগে থেকেই `Bsol_Tracking::ajax_track()`-এ পড়া হচ্ছিল, এখানে শুধু order-sync payload-এও যোগ করা হলো)।

---

## 12. যা এই রাউন্ডে **নয়** (স্পষ্টভাবে scope-এর বাইরে)

- TikTok / GA4 / Snap destination (স্কিমা প্রস্তুত থাকবে, ড্রাইভার নয়)।
- Facebook Lead Ads (`leadgen` webhook) — আলাদা ফিচার, `facebook_integration_context.md §6` item 3।
- Meta Ads Manager থেকে spend/ROAS টেনে আনা (Ads Insights API, `ads_read` permission + নতুন App Review রাউন্ড লাগে)।
- Server-side GTM / নিজস্ব tag manager।
- A/B টেস্টিং বা attribution modeling।
