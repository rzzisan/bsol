# BSOL Tracking Platform — Server-side + Browser-side Event Tracking (Facebook CAPI) Context

এই ফাইলটা BSOL-এর **Tracking/Attribution মডিউল**-এর একক source of truth। উদ্দেশ্য তিনটা:

1. **ফেক/অনুপস্থিত কাস্টমার কমানো** — Meta-র ad algorithm-কে "কে ফর্ম সাবমিট করেছে" নয়, "কার অর্ডার আসলে ডেলিভারি হয়েছে" সেই সিগন্যাল দেওয়া (COD মার্কেটে সবচেয়ে বড় লিভার)।
2. **আসল কাস্টমার ট্র্যাকিং** — browser (Pixel) + server (Conversions API) দুই দিক থেকে একই ইভেন্ট, `event_id` দিয়ে dedup, উচ্চ Event Match Quality।
3. **SaaS ফিচার হিসেবে বিক্রয়যোগ্য** — সেলার নিজের WordPress/WooCommerce সাইট বা BSOL landing page-এ এক ক্লিকে ট্র্যাকিং চালু করবে, প্যাকেজ অনুযায়ী দৈনিক ইভেন্ট লিমিট।

**অবস্থা (২০২৬-০৮-১৫):** **T1 সম্পন্ন ও লাইভ** — ডেটা মডেল, quota ও ingest পাইপলাইন দাঁড়িয়ে গেছে। **এখনো কোনো call-site ইভেন্ট জমা দেয় না** (সেটা T2/T5/T6/T4)। পরের ফেজ **T2** (`MetaCapiDriver`)।

> ⚠️ **প্রোডাকশনে এখন প্রতিটি প্যাকেজে `max_tracking_events_per_day = NULL` (আনলিমিটেড)।** Migration ইচ্ছাকৃতভাবে কোনো মান বসায়নি — চালু প্যাকেজে নীরবে লিমিট বসানো মানে সেলারের ইভেন্ট হারানো। **Admin → Packages** থেকে বাস্তব মান বসাতে হবে; seeder-এর প্রস্তাব: Free Trial 2,000 · Starter 5,000 · Growth 15,000 · Business আনলিমিটেড।

**পড়ার ক্রম:** §1 কেন (ব্যবসায়িক যুক্তি) · §2 আজ কী আছে/নেই · §3–§7 ডিজাইন · **§8 ডোমেইন মডেল** (সেলার কোন ডোমেইনে আছে তার উপর ট্র্যাকিং নির্ভর করে) · §10 ফেজ · §11 সিদ্ধান্ত।

**সম্পর্কিত ডকুমেন্ট:** `custom_domain_context.md` (**আগে পড়ো** — per-seller সাবডোমেইন; এই ডকের §8 তার উপর দাঁড়িয়ে), `CONTEXT.md` (§৩১ staff-role ও §৩২ সাবডোমেইন বাধ্যতামূলক চেকলিস্ট), `SAAS_MODULE_CONTEXT.md`, `facebook_integration_context.md` (§8 item 4 — বর্তমান CAPI implementation), `wordpress_connect_context.md` (§7.1 item 1 — deferred full-funnel item, এই ডকেই resolve হবে), `landing_page_context.md`, `subscription_billing_context.md`, `domain_security_audit.md`।

---

## 1. সমস্যা বিবৃতি — কেন এটা শুধু "pixel বসানো" নয়

বাংলাদেশি COD ই-কমার্সে Meta ad-এর মূল সমস্যা: Pixel-এর কাছে "Purchase" মানে **অর্ডার ফর্ম সাবমিট**। কিন্তু সেই অর্ডারের ৩০-৫০% ফেক/বাতিল/রিটার্ন হয়। ফলে Meta যে অডিয়েন্স খুঁজে আনে সেটা "ফর্ম সাবমিট করে এমন লোক", "টাকা দিয়ে পণ্য নেয় এমন লোক" নয় — অর্থাৎ ad spend নিজেই ফেক অর্ডার উৎপাদন করে।

BSOL-এর কাছে যা আছে অথচ কোনো সাধারণ pixel প্লাগইনের কাছে নেই: **অর্ডারের চূড়ান্ত পরিণতি** (courier delivery status, fraud score, blacklist, repeat-order history)। এই ডেটা CAPI-তে ফেরত পাঠানোই মূল differentiator:

| Meta-কে যা পাঠাই | কখন | কী শেখায় |
|---|---|---|
| `Purchase` | অর্ডার তৈরি হওয়ার সময় (বর্তমান behavior) | কে ফর্ম ভরে |
| `OrderConfirmed` | ফোনে/OTP-তে কনফার্ম হলে | কে সত্যিই কিনতে চায় |
| `OrderDelivered` (value = আসল টাকা) | courier delivered হলে | **কে আসলে টাকা দেয়** ← optimization target |
| `OrderReturned` (value negative/exclusion audience) | রিটার্ন হলে | কাকে বাদ দিতে হবে |

এটাই "ফেক কাস্টমার কমানো"-র প্রকৃত মেকানিজম — ব্লক করে নয়, **ad targeting-কে ঠিক লোকের দিকে ঘোরানোর মাধ্যমে**। সাথে §9-এর fraud feedback loop (session behavior → risk score) দ্বিতীয় স্তর।

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

> **T1-এ যা তৈরি হয়েছে (২০২৬-০৮-১৫):** নিচের ৪, ৫, ৬ নম্বরের **ভিত্তি** দাঁড়িয়ে গেছে — `tracking_destinations` (multi-pixel), `tracking_events` (log + idempotency), `tracking_usage_daily` + `TrackingQuotaService` (quota), `TrackingIngestService`, `TrackingUserDataBuilder`। কিন্তু **কোনো call-site এখনো ইভেন্ট জমা দেয় না** এবং **কিছুই Meta-তে যায় না** (T2)। তাই তালিকাটা কার্যকরভাবে এখনো সত্য।

1. **কোনো client-side Pixel নেই কোথাও।** `grep -rn "fbq\|connect.facebook.net\|gtag\|dataLayer" frontend/src/` → শূন্য ম্যাচ। BSOL landing page-এ Meta Pixel base code বসে না, তাই আজ `fbp`/`fbc` কুকি কখনোই তৈরি হয় না — অর্থাৎ বর্তমান CAPI ইভেন্টগুলোর Event Match Quality কাঠামোগতভাবেই দুর্বল।
2. **Funnel-এর মাত্র শেষ ধাপ ট্র্যাক হয়।** PageView / ViewContent / AddToCart / InitiateCheckout / Lead — কিছুই নেই।
3. **Order-flow ইভেন্ট নেই।** Delivered/Returned/Confirmed Meta-তে যায় না — §1-এর মূল লিভারটাই অব্যবহৃত।
4. **এক সেলার এক Pixel** — `facebook_pixel_settings.unique('user_id')`; একাধিক ব্র্যান্ড/সাইটের সেলার আটকে যায়। *(T1-এ `tracking_destinations` টেবিল তৈরি ও backfill হয়েছে; CRUD UI T3-এ।)*
5. **কোনো event log নেই।** কোন ইভেন্ট গেল, Meta কী উত্তর দিল, কেন ব্যর্থ হলো — কেউ দেখতে পায় না, শুধু `last_error` string। *(T1-এ `tracking_events` টেবিল তৈরি; UI T7-এ।)*
6. **কোনো quota/rate control নেই।** একটা busy WooCommerce সাইট দিনে লাখো PageView পাঠালে BSOL-এর queue ও Meta rate limit দুটোই ভাঙবে, খরচ প্ল্যাটফর্মের ঘাড়ে পড়বে। ← **user-এর মূল requirement**। *(T1-এ সম্পূর্ণ — quota tiering, Redis কাউন্টার, দৈনিক টেবিল, সেলারের মিটার লাইভ।)*
7. **Batching নেই।** Meta একটা রিকোয়েস্টে ১০০০ ইভেন্ট নেয়; আমরা প্রতি ইভেন্টে একটা HTTP call করি।

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
> - রুট এখন `owner_only`, কারণ একমাত্র সার্ফেসটাই owner-only। §6.2-এর Pattern A + `tracking` module key **T7-এ**, event log UI-র সাথে — তার আগে staff grant দিলে খোলার মতো কিছু থাকত না।
> - **admin-এর per-seller usage ভিউ এখনো নেই** — T7।

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
| ⬜ `App\Services\Tracking\Destinations\MetaCapiDriver` (T2) | ইভেন্ট → Meta payload map, **batched** POST (১০০০ পর্যন্ত, আমরা ৫০-এ রাখব), response parse, per-event success/failure |
| ✅ `App\Services\Tracking\TrackingUserDataBuilder` | normalize + sha256 হ্যাশিং, fbp/fbc, external_id — একটাই জায়গায়, যাতে হ্যাশ নিয়ম কখনো দুই রকম না হয় |
| ⬜ `App\Jobs\DispatchTrackingEventsJob` (T2) | queued, batch করে destination driver ডাকে, `tracking_events` status আপডেট, retry |
| ✅ `App\Console\Commands\PurgeOldTrackingEvents` | ৯০ দিনের বেশি পুরনো row মুছে। Job নয়, artisan command — `routes/console.php`-এ প্রতিদিন ০৩:৩০-এ শিডিউলড। Postgres-এ `DELETE ... LIMIT` নেই, তাই id select করে chunk-এ মোছে |

**বিদ্যমান `FacebookCapiClient` ও `SendFacebookCapiPurchaseEventJob`:** মুছে ফেলা হবে না। `SendFacebookCapiPurchaseEventJob` নতুন পাইপলাইনে ইভেন্ট জমা দেওয়ার একটা পাতলা wrapper-এ পরিণত হবে (behavior একই, dispatch call-site দুটো অপরিবর্তিত) — এটাই সবচেয়ে কম-ঝুঁকির পথ, কারণ ওই দুই call-site এখন প্রোডাকশনে চলছে।

### 6.2 নতুন রুট

```php
// connect/v1 group (X-API-KEY + active_subscription), WooCommerce plugin থেকে
Route::post('/tracking/events', [ConnectTrackingController::class, 'ingest'])->middleware('throttle:600,1');
Route::get('/tracking/config',  [ConnectTrackingController::class, 'config'])->middleware('throttle:60,1');
//   config = কোন pixel id, কোন ইভেন্ট চালু, consent mode, quota অবস্থা — প্লাগইন ক্যাশ করবে (১ ঘণ্টা)

// public (landing page browser থেকে), API-key ছাড়া — সেলার resolve হয় Host থেকে (§8.0)
// slug-ভিত্তিক রুট নয়: slug এখন per-shop unique, তাই slug একা কোনো শপ নির্দেশ করে না
Route::post('/public/track', [PublicTrackingController::class, 'ingest'])->middleware('throttle:300,1');

// dashboard (owner_only — Pattern B, credential)
Route::prefix('tracking')->middleware('owner_only')->group(function () {
    Route::get('/destinations', ...); Route::post('/destinations', ...);
    Route::put('/destinations/{id}', ...); Route::delete('/destinations/{id}', ...);
    Route::post('/destinations/{id}/test-event', ...);
});
// dashboard read-only (Pattern A — staff দেখতে পারে), T7-এ
Route::middleware('staff_permission:tracking')->group(function () {
    Route::get('/tracking/events', ...);   // event log, filter/paginate
    Route::get('/tracking/usage', ...);    // quota meter + দৈনিক গ্রাফ
});
```

**✅ যা ইতিমধ্যে লাইভ (T1):** `GET /tracking/usage` — quota মিটার, **এখন `owner_only`**, Settings → Facebook Page-এর কার্ডে দেখায় (আজকের ব্যবহার/লিমিট, রঙিন বার, dropped ও overage, গত ৭ দিন)। `state` (`ok`/`sampling`/`critical`/`exhausted`/`unlimited`/`not_in_package`) ব্যাকএন্ডে হিসাব হয়, যাতে ড্যাশবোর্ড আর পরের admin ভিউ threshold নিয়ে দ্বিমত করতে না পারে।

**কেন `owner_only`, §6.2-এর Pattern A নয়:** এখন এটা রেন্ডার করে একমাত্র owner-only Pixel settings পেজ; staff-কে permission দিলে খোলার মতো কিছুই থাকত না। **T7-এ event log UI-র সাথে** `tracking` module key যোগ হবে এবং রুটটা `staff_permission:tracking`-এ সরবে — নিচের চার-জায়গার চেকলিস্ট তখনই প্রযোজ্য।

**Staff-role চেকলিস্ট (CONTEXT.md §৩১ — বাধ্যতামূলক, T7-এ):**
- `tracking_destinations` = **Pattern B** (owner-only credential, `shopOwnerId()`), `owner_only` middleware।
- `tracking_events` / `tracking_usage_daily` পড়া = **Pattern A** (team-shared, `whereIn(shopUserIds())`), নতুন module key `tracking`।
- `StaffPermission::MODULE_KEYS` + `frontend/src/lib/dashboard-client.ts::STAFF_MODULE_KEYS` + `user-shell.tsx::MODULE_KEY_BY_MENU_ITEM` + `settings/staff/page.tsx::MODULE_KEYS` — চার জায়গাতেই `tracking` যোগ করতে হবে।
- Verification-এ owner + granted staff + non-granted staff — তিনটাই টেস্ট করতে হবে।

---

## 7. WordPress প্লাগইন ডিজাইন (`Bsol_Tracking` মডিউল)

নতুন মডিউল `includes/modules/tracking/class-bsol-tracking.php`, `class-bsol-master.php`-এর connected + WooCommerce-active gate-এ instantiate (বিদ্যমান ১২টা মডিউলের মতোই)।

**দায়িত্ব:**
1. `wp_head` — Pixel base code inject (pixel id `Bsol_Api::get_tracking_config()`-এর ক্যাশড রেসপন্স থেকে, **কখনো hardcoded নয়**), default PageView suppress করে JS-কে `eventID` সহ পাঠাতে দেওয়া।
2. `wp_enqueue_scripts` — `assets/js/bsol-tracking.js` + একটা localized context object (page type, product, cart, currency, nonce, rest url)। **vanilla JS, jQuery নির্ভরতা নেই** (প্লাগইনের বিদ্যমান `bsol-abandoned-checkout.js`-এর মতো)।
3. `register_rest_route('bsol-connect/v1', '/t')` — first-party ingest endpoint (`permission_callback` = public, কারণ ক্রেতা লগইন করা নেই; nonce + origin চেক + rate limit)। এখানে server-side enrichment হয় (fbp/fbc কুকি, আসল client IP/UA, cart/product ডেটা `WC()->cart` থেকে — DOM scraping কখনো নয়, Phase 17-এর প্রতিষ্ঠিত নীতি)।
4. Server-side hook থেকে সরাসরি ইভেন্ট: `woocommerce_add_to_cart`, `woocommerce_order_status_changed` (order-flow ম্যাপিং), `woocommerce_thankyou`।
5. Batch buffer — একই page load-এর একাধিক ইভেন্ট একসাথে BSOL-এ পাঠানো; `shutdown` hook বা ৫ সেকেন্ডের `wp_schedule_single_event`।
6. Duplicate-pixel ডিটেকশন — PixelYourSite / Facebook for WooCommerce সক্রিয় থাকলে admin notice ("দুটো একসাথে চললে ইভেন্ট ডবল গোনা হবে"), base code inject বন্ধ রাখার অপশন সহ। legacy sbsp এই চেকটা করত, এটা বাস্তব সমস্যা।
7. Consent/DNT — `consent_mode='required'` হলে কুকি-কনসেন্ট না পাওয়া পর্যন্ত কিছুই পাঠাবে না; `DNT: 1` সবসময় সম্মান করা হবে।

**ইভেন্ট → WooCommerce hook ম্যাপ:**

| ইভেন্ট | ব্রাউজার ট্রিগার | সার্ভার ট্রিগার |
|---|---|---|
| PageView | সব পেজে (thank-you বাদে) | — |
| ViewContent | `is_product()` | `woocommerce_before_single_product` |
| AddToCart | ৪টা binding (single button, loop button, `added_to_cart`, `form.cart` submit) | `woocommerce_add_to_cart` + `woocommerce_ajax_added_to_cart` (৩s transient lock) |
| InitiateCheckout | `is_checkout()` | `wp` hook, checkout পেজে একবার |
| Lead | ফোন/ইমেইল ফিল্ড valid হলে (abandoned-checkout মডিউলের ট্রিগারের সাথে মিলিয়ে) | — |
| Purchase | thank-you পেজ (eventID = `order_{bsolOrderId}`) | `woocommerce_thankyou` (আসল উৎস; browser fallback) |
| OrderConfirmed / OrderShipped / OrderDelivered / OrderReturned / OrderCanceled | — | `woocommerce_order_status_changed` + BSOL courier status webhook |

**গুরুত্বপূর্ণ:** BSOL অর্ডারের আসল ডেলিভারি স্ট্যাটাস জানে (courier tracking), WordPress জানে না। তাই `OrderDelivered` ইভেন্টের **authoritative উৎস BSOL সার্ভার**, প্লাগইন নয় — `OrderStatusService::transition()`-এ hook করে server-side ইভেন্ট জমা হবে। প্লাগইনের status-change hook শুধু WooCommerce-এ ম্যানুয়ালি স্ট্যাটাস বদলানোর কেসটা ধরে।

---

## 8. Origin/Domain মডেল — কোন সেলার কোন ডোমেইনে, ট্র্যাকিং কীভাবে বদলায়

ট্র্যাকিং-এর গুণমান নির্ভর করে **ব্রাউজার কোন ডোমেইনে দাঁড়িয়ে আছে** তার উপর — `_fbp`/`_fbc` কুকি ডোমেইন-স্কোপড, আর Meta-র domain verification ডোমেইন-ভিত্তিক।

**আজ বাস্তবে দুটো কেস** (সাবডোমেইন ফিচার আসার পর, ২০২৬-০৮-১৫):

| কেস | কোথায় | কারা | অবস্থা |
|---|---|---|---|
| **A** | সেলারের নিজের WordPress/WooCommerce সাইট | **সংখ্যাগরিষ্ঠ** — যারা নিজের সাইটে বিজ্ঞাপন চালায় | প্লাগইন T4-এ |
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

### 8.8 ল্যান্ডিং পেজে কারিগরি বাস্তবায়ন (T6)

Landing page BSOL-এর Next.js-এ: পাবলিক ঠিকানা `{seller}.{apex}/{slug}`, আর `src/proxy.ts` সেটাকে ভেতরে `/lp/{slug}`-এ rewrite করে (rewrite proxy-কে পুনরায় ডাকে না, তাই যেকোনো host-এ সরাসরি `/lp/...` চাওয়া 404)।

- **`event_source_url` সবসময় পাবলিক ঠিকানা হতে হবে**, ভেতরের rewrite path নয় — নাহলে Meta-তে এমন URL যাবে যা ব্রাউজারে কখনো খোলে না। **`LandingPage::canonicalUrl()` ব্যবহার করতে হবে**, নিজে URL বানানো যাবে না। ⚠️ এটা **nullable** (সাবডোমেইনহীন শপের draft পেজে `null`) — `null` হলে ইভেন্ট `event_source_url` **ছাড়াই** যাবে, বানানো URL দিয়ে নয়।
- `page.tsx` (server component) → host থেকে destination resolve → tracking config পেজে পাঠায়। **public payload-এ শুধু dataset/pixel id, access token কখনো নয়**।
- **base code শুধু পাবলিক ল্যান্ডিং রুটে**, `/dashboard/*`-এ কখনো নয় (§8.3)।
- নতুন client hook `useBsolTracking()` — PageView / ViewContent / InitiateCheckout (checkout ফর্মে প্রথম ইনপুট) / Lead (ফোন valid হলে) / Purchase (thank-you)। `fbq` + server POST একই `event_id` দিয়ে। thank-you একই সাবডোমেইনে (`/{slug}/thank-you`), তাই মাঝপথে কুকি হারানোর সমস্যা নেই।
- Ingest রুট **host-ভিত্তিক**: `POST /api/public/track`, Host থেকে `LandingPageResolver` দিয়ে resolve। **slug-ভিত্তিক রুট বানানো হবে না** — slug আর globally unique নয় (per-shop), তাই slug একা কোনো শপ নির্দেশ করে না। সাবডোমেইনে API same-origin, তাই CORS-এর প্রশ্নও নেই।
- `landing_pages.content.settings`-এ per-page toggle (`tracking_enabled`, `tracking_destination_id`) — `frontend/src/lib/landing-pages.ts` ও backend validation দুই জায়গায়।
- বিদ্যমান `landing_page_visits` টেবিল **অপরিবর্তিত** (BSOL-এর নিজস্ব analytics) — tracking pipeline-এর সাথে মেশানো হবে না, উদ্দেশ্য আলাদা।

## 9. Fraud feedback loop — "ফেক কাস্টমার কমানো"-র দ্বিতীয় স্তর

ট্র্যাকিং যে session সিগন্যাল তোলে, সেগুলো BSOL-এর বিদ্যমান fraud স্কোরিং-এ ইনপুট হিসেবে দেওয়া যায় (এটা কোনো pixel প্লাগইন পারে না, কারণ তাদের অর্ডার ডেটা নেই):

| সিগন্যাল | ইঙ্গিত |
|---|---|
| অর্ডারের আগে কোনো session ইভেন্টই নেই | বট/স্ক্রিপ্টেড অর্ডার, বা তৃতীয় পক্ষ ফর্ম ভরেছে |
| Page dwell < ৫ সেকেন্ড, scroll ~0%, তবু অর্ডার | দায়সারা/ফেক অর্ডারের শক্তিশালী ইঙ্গিত |
| একই `fbp` থেকে আলাদা ফোনে একাধিক অর্ডার | একই ব্যক্তির multiple ফেক অর্ডার |
| `fbc` আছে (আসল ad click) | ইতিবাচক সিগন্যাল, ঝুঁকি কমায় |
| ViewContent → AddToCart → Checkout স্বাভাবিক সময় ব্যবধানে | ইতিবাচক |

**স্কোপ:** এটা এই রাউন্ডে **শুধু ডেটা সংগ্রহ ও অর্ডার-ডিটেইলে দেখানো** পর্যন্ত (Phase T7)। fraud score-এ ওজন বসানো আলাদা কাজ, বাস্তব ডেটা জমার পরে ক্যালিব্রেট করতে হবে — অন্ধভাবে ওজন বসালে ভালো অর্ডার ব্লক হবে, যা COD ব্যবসায় বেশি ক্ষতিকর।

---

## 10. ফেজ পরিকল্পনা

**ক্রম পরিবর্তন (২০২৬-০৮-১৫):** T5 এগিয়ে আনা হয়েছে (আগে T4-এর পরে ছিল), আর T3-এর backfill T1-এ ঢুকেছে। কারণ **§1-এর মূল লিভার (`OrderDelivered` → Meta) সম্পূর্ণ server-side** — এর জন্য ব্রাউজার কোড, প্লাগইন বা Meta domain verification কিছুই লাগে না। তাই তিন ফেজেই (T1→T2→T5) বিক্রয়যোগ্য differentiator দাঁড়িয়ে যায়, বাকি সব তার উপর মান যোগ করে।

| ফেজ | পরিধি | নির্ভরতা |
|---|---|---|
| **T1** ✅ | ডেটা মডেল (৩ টেবিল + package কলাম) + `TrackingQuotaService` + `TrackingIngestService` + `TrackingUserDataBuilder` + `app:purge-tracking-events` + admin package UI-তে লিমিট ফিল্ড। **`facebook_pixel_settings` → `tracking_destinations` backfill এখানেই** (§4.1)। **সম্পন্ন ২০২৬-০৮-১৫** | — |
| **T2** ← **পরবর্তী** | `MetaCapiDriver` (batched) + `DispatchTrackingEventsJob` + retry/log + `SendFacebookCapiPurchaseEventJob`-কে নতুন পাইপলাইনে wrapper করা (behavior অপরিবর্তিত, দুটো লাইভ call-site অস্পৃশ্য) | T1 |
| **T5** | **Order-flow ইভেন্ট** — `OrderStatusService::transition()`-এ hook, Delivered/Returned/Confirmed, deterministic `order_{id}_{event}`। ← **এখানেই প্রোডাক্টের মূল মূল্য** | T2 |
| **T6** | Landing page ট্র্যাকিং (Next.js), সেলার সাবডোমেইনে **Full tracking** (browser Pixel + CAPI, `event_id` dedup) + per-page toggle। host resolution বিদ্যমান `LandingPageResolver`-এ (§8.0) | T2 |
| **T4** | WordPress প্লাগইন `Bsol_Tracking` মডিউল — base code, browser JS, first-party REST endpoint, batch relay, funnel ইভেন্ট (plugin v1.17.0) | T2 |
| **T3** | Multi-destination **UI** — dashboard CRUD, scope selector, একাধিক pixel (backfill T1-এ হয়ে গেছে) | T1 |
| **T7** | Dashboard: event log, quota মিটার, match-quality সারাংশ; fraud signal অর্ডার-ডিটেইলে প্রদর্শন | T2–T6 |
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
| ৭ | **Meta domain verification সাবডোমেইনে?** | **সেলার পারবে না** — Meta শুধু root ডোমেইন নেয়। নিচের ১১.২ দেখো | Business Manager-এ যাচাই |
| ৯ | **`landing_pages.slug` global নাকি per-seller unique?** | **per-seller** (`unique(user_id, slug)`)। `/lp/` ও `legacy_slug` মুছে ফেলায় alias টেবিলের জটিলতা লাগেনি | বাস্তবায়িত |
| ১০ | **DNS Cloudflare-এ সরানো হবে?** | **হয়েছে** — wildcard DNS + DNS-01 auto-renew চালু | বাস্তবায়িত |
| ১১ | **একই apex নাকি আলাদা?** | **একই apex** (সুপারিশের বিপরীতে)। রেপুটেশন ঝুঁকি বহাল ও গৃহীত — §8.6 | বাস্তবায়িত |

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
| ৩ | **`OrderDelivered`-এর `value` কী হবে** — অর্ডারের মোট, নাকি ডেলিভারি চার্জ বাদে? Meta-র ROAS হিসাব এর উপর দাঁড়ায় | **T5** | পণ্যের মূল্য, shipping বাদে — ROAS-এ shipping revenue নয় |
| ৪ | **ল্যান্ডিং পেজের public payload-এ dataset id** — id গোপন নয় (browser-এ যেভাবেই হোক দেখা যায়), কিন্তু কোন সেলারের কোনটা তা enumerate করা যাবে কি না | **T6** | host/slug-স্কোপড রেসপন্স, কখনো তালিকা নয় |
| ৮ | **T8b-তে DNS পদ্ধতি** — CNAME (সহজ, apex-এ চলে না) বনাম A রেকর্ড (apex-এ চলে, সার্ভার IP বদলালে সব সেলারকে বদলাতে হয়) | **T8b** | সাবডোমেইনে CNAME বাধ্যতামূলক (`lp.sellershop.com`), apex সাপোর্ট নয় |

---

## 12. যা এই রাউন্ডে **নয়** (স্পষ্টভাবে scope-এর বাইরে)

- TikTok / GA4 / Snap destination (স্কিমা প্রস্তুত থাকবে, ড্রাইভার নয়)।
- Facebook Lead Ads (`leadgen` webhook) — আলাদা ফিচার, `facebook_integration_context.md §6` item 3।
- Meta Ads Manager থেকে spend/ROAS টেনে আনা (Ads Insights API, `ads_read` permission + নতুন App Review রাউন্ড লাগে)।
- Server-side GTM / নিজস্ব tag manager।
- A/B টেস্টিং বা attribution modeling।
