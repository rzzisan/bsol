# BSOL Tracking Platform — Server-side + Browser-side Event Tracking (Facebook CAPI) Context

এই ফাইলটা BSOL-এর **Tracking/Attribution মডিউল**-এর একক source of truth। উদ্দেশ্য তিনটা:

1. **ফেক/অনুপস্থিত কাস্টমার কমানো** — Meta-র ad algorithm-কে "কে ফর্ম সাবমিট করেছে" নয়, "কার অর্ডার আসলে ডেলিভারি হয়েছে" সেই সিগন্যাল দেওয়া (COD মার্কেটে সবচেয়ে বড় লিভার)।
2. **আসল কাস্টমার ট্র্যাকিং** — browser (Pixel) + server (Conversions API) দুই দিক থেকে একই ইভেন্ট, `event_id` দিয়ে dedup, উচ্চ Event Match Quality।
3. **SaaS ফিচার হিসেবে বিক্রয়যোগ্য** — সেলার নিজের WordPress/WooCommerce সাইট বা BSOL landing page-এ এক ক্লিকে ট্র্যাকিং চালু করবে, প্যাকেজ অনুযায়ী দৈনিক ইভেন্ট লিমিট।

**অবস্থা:** **T1 সম্পন্ন ও লাইভ (২০২৬-০৮-১৫)** — ডেটা মডেল, quota ও ingest পাইপলাইন দাঁড়িয়ে গেছে, কিন্তু এখনো কোনো call-site ইভেন্ট জমা দেয় না (সেটা T5/T6/T4)। পরের ফেজ **T2** (`MetaCapiDriver`)।

> ⚠️ **প্রোডাকশনে এখন প্রতিটি প্যাকেজে `max_tracking_events_per_day = NULL` (আনলিমিটেড)** — migration ইচ্ছাকৃতভাবে কোনো মান বসায়নি, কারণ চালু প্যাকেজে নীরবে লিমিট বসানো মানে সেলারের ইভেন্ট হারানো। **Admin → Packages** থেকে বাস্তব মান বসাতে হবে; seeder-এর প্রস্তাব: Free Trial 2,000 · Starter 5,000 · Growth 15,000 · Business আনলিমিটেড।
 নিচের §2 হলো verified ground truth (কোড ও সার্ভার কনফিগ পড়ে যাচাই করা), §3 থেকে পরে ডিজাইন/প্ল্যান।

> **🚨 বড় সংশোধন (২০২৬-০৮-১৫) — এই ডকের §8 লেখা হয়েছিল সাবডোমেইন ফিচার আসার আগে।**
> এর মাঝে **প্রতিটি সেলার নিজের সাবডোমেইন পেয়েছে** (`{seller}.zyrotechbd.com`) এবং ল্যান্ডিং পেজ **শুধু সেখানেই** চলে — `/lp/{slug}` সম্পূর্ণ মুছে ফেলা হয়েছে (`custom_domain_context.md §14`)। ফলে:
> - **§8.2-এর কেস B (শেয়ার্ড প্ল্যাটফর্ম ডোমেইন) আর অস্তিত্বে নেই** — ওই সেকশনের পুরো "Basic tier / namespaced `bsol_fbp_*` কুকি" ডিজাইন **বাতিল**, ঐতিহাসিক রেফারেন্স হিসেবে রাখা হলো।
> - আজকের বাস্তবতা = **§8.3-এর কেস C2**, এবং §8.0-এর host resolver **ইতিমধ্যেই তৈরি** (§8.0 দেখো — নতুন করে লেখা যাবে না)।
> - §11-এর ৬, ৭, ৯, ১০, ১১ নম্বর সিদ্ধান্ত **সবগুলোই বন্ধ**। §11.7-এর উত্তর: **সেলার নিজের সাবডোমেইন Meta-তে verify করতে পারবে না** — Meta শুধু root ডোমেইন নেয়। আমরা apex একবার verify করলে সব সাবডোমেইন ঢেকে যায়, কিন্তু AEM প্রায়োরিটি প্ল্যাটফর্ম-স্তরে একক।
>
> §8 পড়ার সময় প্রতিটি সাব-সেকশনের উপরের নোট আগে দেখো।

**সম্পর্কিত ডকুমেন্ট:** `custom_domain_context.md` (**আগে পড়ো** — per-seller সাবডোমেইন, এই ডকের §8-এর ভিত্তি বদলে দিয়েছে), `CONTEXT.md` (server/ops, §৩১ staff-role ও §৩২ সাবডোমেইন বাধ্যতামূলক চেকলিস্ট), `SAAS_MODULE_CONTEXT.md` (মডিউল অডিট), `facebook_integration_context.md` (§8 item 4 — বর্তমান CAPI implementation), `wordpress_connect_context.md` (§7.1 item 1 — deferred full-funnel item, এই ডকেই resolve হবে), `landing_page_context.md`, `subscription_billing_context.md` (প্যাকেজ/লিমিট), `domain_security_audit.md`।

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

1. **কোনো client-side Pixel নেই কোথাও।** `grep -rn "fbq\|connect.facebook.net\|gtag\|dataLayer" frontend/src/` → শূন্য ম্যাচ। BSOL landing page-এ Meta Pixel base code বসে না, তাই আজ `fbp`/`fbc` কুকি কখনোই তৈরি হয় না — অর্থাৎ বর্তমান CAPI ইভেন্টগুলোর Event Match Quality কাঠামোগতভাবেই দুর্বল।
2. **Funnel-এর মাত্র শেষ ধাপ ট্র্যাক হয়।** PageView / ViewContent / AddToCart / InitiateCheckout / Lead — কিছুই নেই।
3. **Order-flow ইভেন্ট নেই।** Delivered/Returned/Confirmed Meta-তে যায় না — §1-এর মূল লিভারটাই অব্যবহৃত।
4. **এক সেলার এক Pixel** — একাধিক ব্র্যান্ড/সাইট/ক্যাম্পেইনের সেলার আটকে যায় (`FacebookPageConnection`-এ ঠিক এই সমস্যাটাই ২০২৬-০৮-০৮-এ সমাধান হয়েছে, precedent আছে)।
5. **কোনো event log নেই।** কোন ইভেন্ট গেল, Meta কী উত্তর দিল, কেন ব্যর্থ হলো — সেলার বা admin কেউ দেখতে পায় না। শুধু `last_error` string।
6. **কোনো quota/rate control নেই।** একটা busy WooCommerce সাইট দিনে লাখো PageView পাঠালে BSOL-এর queue ও Meta rate limit দুটোই ভাঙবে, এবং খরচ প্ল্যাটফর্মের ঘাড়ে পড়বে। ← এটাই user-এর মূল requirement।
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

### 4.1 `tracking_destinations` (নতুন — `facebook_pixel_settings`-এর উত্তরসূরি)

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

### 4.2 `tracking_events` (নতুন — ingest log + idempotency + audit)

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

### 4.3 `tracking_usage_daily` (নতুন — quota-র authoritative রেকর্ড)

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

### 4.5 `subscription_packages`-এ নতুন কলাম

```
max_tracking_events_per_day   unsignedInteger nullable   (null = unlimited)
```

`max_orders`/`max_staff`-এর হুবহু একই প্যাটার্ন (`AdminController` validation + admin packages UI + seeder)। প্রস্তাবিত ডিফল্ট: Free Trial 2,000 · Starter 5,000 · Growth 15,000 · Business null (unlimited)। মান admin UI থেকে বদলানো যাবে, কোডে hardcode নয়।

---

## 5. Quota ও ট্রাফিক নিয়ন্ত্রণ (user-এর মূল requirement)

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
| `App\Services\Tracking\TrackingIngestService` | validate → **destination আছে কি না** → dedup → quota check/sample → `tracking_events` insert → queue dispatch। একমাত্র প্রবেশপথ (landing page, WooCommerce, internal order-flow সবাই এটাই ডাকবে)। **ক্রমটাই মূল**: destination না থাকলে কিছুই খরচ হয় না, duplicate কোটা খায় না, drop হওয়া ইভেন্ট row হয় না |
| `App\Services\Tracking\TrackingQuotaService` | `check(ownerId, priority): bool`, `record(ownerId, n)`, `usageToday(ownerId): array`। Redis + `tracking_usage_daily` |
| `App\Services\Tracking\Destinations\MetaCapiDriver` | ইভেন্ট → Meta payload map, **batched** POST (১০০০ পর্যন্ত, আমরা ৫০-এ রাখব), response parse, per-event success/failure |
| `App\Services\Tracking\TrackingUserDataBuilder` | normalize + sha256 হ্যাশিং, fbp/fbc, external_id — একটাই জায়গায়, যাতে হ্যাশ নিয়ম কখনো দুই রকম না হয় |
| `App\Jobs\DispatchTrackingEventsJob` | queued, batch করে destination driver ডাকে, `tracking_events` status আপডেট, retry |
| `App\Jobs\PurgeOldTrackingEventsJob` | ৯০ দিনের বেশি পুরনো row মুছে (scheduler) |

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
// dashboard read-only (Pattern A — staff দেখতে পারে)
Route::middleware('staff_permission:tracking')->group(function () {
    Route::get('/tracking/events', ...);   // event log, filter/paginate
    Route::get('/tracking/usage', ...);    // quota meter + দৈনিক গ্রাফ
});
```

**Staff-role চেকলিস্ট (CONTEXT.md §৩১ — বাধ্যতামূলক):**
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

ট্র্যাকিং-এর গুণমান পুরোপুরি নির্ভর করে **ব্রাউজার কোন ডোমেইনে দাঁড়িয়ে আছে** তার উপর — কারণ `_fbp`/`_fbc` কুকি ডোমেইন-স্কোপড, এবং Meta-র domain verification/AEM ডোমেইন-ভিত্তিক। তাই তিনটা আলাদা কেস, এবং তিনটার জন্য আলাদা আচরণ।

### 8.0 একীভূত মেকানিজম — host resolution

তিন কেসেই একই নিয়ম: **ইভেন্ট কোন সেলারের, সেটা সবসময় রিকোয়েস্টের `Host`/`Origin` থেকে সার্ভার নিজে বের করবে — ক্লায়েন্টের পাঠানো `destination_id`/`user_id` কখনো বিশ্বাস করা হবে না।**

```
Host header → host resolution → (user_id, scope) → প্রযোজ্য tracking_destinations
                 ├── platform_api_keys.domain     → WooCommerce সাইট (Phase 16, বিদ্যমান)
                 ├── shop_profiles.subdomain      → সেলারের সাবডোমেইন (D2, বিদ্যমান)
                 └── landing_domains.hostname     → সেলারের নিজের ডোমেইন (T8b, পরে)
```

> **আপডেট (২০২৬-০৮-১৫): এটা আর নতুন করে লিখতে হবে না — সাবডোমেইনের কাজেই তৈরি হয়ে গেছে।** নতুন `TrackingHostResolver` ক্লাস **বানানো যাবে না**; নিচেরগুলোই বাড়াতে হবে:
> - **`App\Support\LandingPageResolver`** — Host → শপ → ওই শপের slug। প্রতিটি পাবলিক ল্যান্ডিং endpoint ইতিমধ্যেই এখান দিয়ে যায়। ট্র্যাকিং ingest-ও এখান দিয়েই যাবে।
> - **`App\Support\SubdomainPolicy`** — label বৈধতা ও reserved/tombstone চেক।
> - **`GET /api/public/shop-by-subdomain/{label}`** (`ShopProfileController::publicResolveSubdomain`) — Next.js proxy যেটা ডাকে।
> - **proxy-র `x-bsol-shop-subdomain` হেডার** — ⚠️ এটা **কখনো অনুমোদনের ভিত্তি হতে পারবে না**। proxy ইনবাউন্ড কপি মুছে দেয় (`domain_security_audit.md` M-1), কিন্তু ব্যাকএন্ড-এর নিজের সিদ্ধান্ত সবসময় `$request->getHost()` থেকেই হবে।
>
> মূল ডকের সতর্কতা বহাল: **দুটো আলাদা সত্যের উৎস রাখা যাবে না।**

**কেন এটা নিরাপত্তার প্রশ্ন, শুধু কারিগরি পরিপাটি নয়:** ক্লায়েন্ট-সরবরাহকৃত id বিশ্বাস করলে সেলার A সেলার B-র quota শেষ করে দিতে পারবে, বা B-র Pixel-এ ভুয়া ইভেন্ট ঢোকাতে পারবে। Host-ভিত্তিক resolution এই দুটোই বন্ধ করে (WooCommerce-এ API key ইতিমধ্যেই domain-bound — `AuthenticatePlatformApiKey::matchesDomain()`, একই নীতি)।

### 8.1 কেস A — সেলারের নিজের WordPress সাইট

ব্রাউজার সেলারের নিজের ডোমেইনে (`shop.example.com`)। সবচেয়ে ভালো অবস্থা, কোনো আপস নেই:

- `_fbp`/`_fbc` সেলারের নিজের ডোমেইনে first-party — অন্য কোনো সেলারের সাথে মেশে না।
- সেলার নিজের Business Manager-এ নিজের ডোমেইন verify করতে পারে (সে-ই মালিক) → **AEM/iOS ইভেন্ট প্রায়োরিটি কনফিগার করা যায়**।
- `event_source_url` সেলারের verified ডোমেইনেই — Meta-র দিক থেকে সম্পূর্ণ সঙ্গতিপূর্ণ।
- Ingest same-origin (`/wp-json/bsol-connect/v1/t`) → ad blocker/ITP প্রায় ছুঁতে পারে না।

**আচরণ: Full tracking** (browser Pixel + server CAPI, dual, `event_id` dedup) — §7-এর ডিজাইন যেমন আছে তেমনই।

### 8.2 কেস B — শেয়ার্ড প্ল্যাটফর্ম ডোমেইনে SaaS landing page — ⛔ **আর প্রযোজ্য নয়**

> **বাতিল (২০২৬-০৮-১৫)।** এই কেসটা আর অস্তিত্বে নেই: `/lp/{slug}` রুট মুছে ফেলা হয়েছে, প্রতিটা ল্যান্ডিং পেজ এখন সেলারের নিজের সাবডোমেইনে (`custom_domain_context.md §14`), এবং প্ল্যাটফর্ম host-এ ল্যান্ডিং পেজ resolve করাই বন্ধ (`LandingPageResolver` প্ল্যাটফর্ম host-এ কিছুই ফেরত দেয় না)।
>
> **যা এর ফলে বাতিল:** এই সেকশনের **"Basic tracking" প্রস্তাব**, `bsol_fbp_{destinationId}` / `bsol_fbc_{destinationId}` namespaced কুকির পুরো মেকানিজম, এবং §11.6-এর "ডকের সবচেয়ে বড় product সিদ্ধান্ত"। কুকি আইসোলেশন এখন **কাঠামোগতভাবে** পাওয়া যাচ্ছে (exact-host কুকি, আলাদা origin) — অ্যাপ্লিকেশন-স্তরে namespace বানানোর দরকারই নেই।
>
> নিচের সমস্যার তালিকা **ঐতিহাসিক রেফারেন্স** হিসেবে রাখা হলো, কারণ ১/২/৪ কেন সমাধান হলো সেটা বোঝার জন্য এগুলো জানা দরকার — এবং **সমস্যা ৪ (রেপুটেশন) আংশিকভাবে রয়ে গেছে**, §8.6.4 দেখো।

আজ সব সেলারের পেজ `https://bsol.zyrotechbd.com/lp/{slug}`-এ (nginx-এ একটাই server block, `server_name bsol.zyrotechbd.com` — verified)। এখানে **পাঁচটা বাস্তব সমস্যা**, যার দুটো correctness bug:

| # | সমস্যা | তীব্রতা |
|---|---|---|
| ১ | **`_fbc` ক্রস-কন্টামিনেশন** — ভিজিটর সেলার A-র বিজ্ঞাপনে ক্লিক করে A-র পেজে এলো (`_fbc` লেখা হলো), পরে B-র পেজে গেল; B-র pixel একই `_fbc` পড়ে → **A-র ক্লিক B-র ক্যাম্পেইনে attribute হয়ে যায়** | **Correctness bug — অবশ্যই ঠিক করতে হবে** |
| ২ | **`_fbp` শেয়ার্ড নেমস্পেস** — একটাই ডোমেইন মানে একটাই `_fbp`; দুই সেলারের pixel একই browser id দেখে। ভাঙে না, কিন্তু ক্রস-সেলার behavioral linkage তৈরি করে (প্রাইভেসি) | মাঝারি |
| ৩ | **Meta domain verification অসম্ভব** — সেলার `bsol.zyrotechbd.com` verify করতে পারে না (মালিকানা আমাদের), আর একটা ডোমেইন একটাই business verify করতে পারে। ফলে **AEM/iOS ইভেন্ট প্রায়োরিটি সেলার কনফিগার করতে পারে না** | উচ্চ (iOS ট্রাফিকে সরাসরি ক্ষতি) |
| ৪ | **শেয়ার্ড রেপুটেশন ঝুঁকি** — একজন সেলারের পেজ পলিসি-লঙ্ঘন করলে Meta পুরো ডোমেইন ফ্ল্যাগ/ব্লক করতে পারে → **সব সেলার একসাথে ভুগবে**, এবং যেহেতু এটাই ড্যাশবোর্ড/API-র ডোমেইন, প্রভাব আরও বড় | উচ্চ |
| ৫ | Consent/cookie ব্যানার প্ল্যাটফর্ম-ব্যাপী, per-seller নয় | নিম্ন |

**প্রস্তাবিত আচরণ: "Basic tracking" — শেয়ার্ড ডোমেইনে browser Pixel চালানো হবে না, শুধু server-side CAPI।**

কারণ ও কীভাবে:
- Meta-র JS lib ডোমেইন-প্রতি একটাই `_fbp` লেখে — একে per-seller আলাদা করার কোনো উপায় নেই। JS lib না চালালে **BSOL নিজেই fbp/fbc নেমস্পেসের মালিক** হয় এবং per-destination আলাদা কুকি রাখতে পারে:
  - `bsol_fbp_{destinationId}` — Meta-র নিজস্ব ফরম্যাটে (`fb.1.{ms}.{rand}`) আমরা তৈরি করি, CAPI-তে `fbp` হিসেবে পাঠাই।
  - `bsol_fbc_{destinationId}` — **শুধু তখনই লেখা হবে যখন ওই page load-এর URL-এ নিজে `fbclid` ছিল**; শেয়ার্ড `_fbc` কখনো পড়া হবে না। এটাই সমস্যা ১-এর সমাধান।
- browser pixel না থাকায় browser/server dedup-এর অসামঞ্জস্যের প্রশ্নই ওঠে না — সব ইভেন্ট এক পথে।
- **যা হারাই:** Meta-র নিজস্ব browser-side audience building (retargeting pixel audience)। CAPI দিয়েও audience তৈরি হয়, তাই এটা মানের হ্রাস, ক্ষমতার লোপ নয়। §1-এর মূল লিভার (Purchase/Delivered optimization) সম্পূর্ণভাবে কাজ করে।

**বিকল্প (যদি সিদ্ধান্ত অন্যরকম হয়):** শেয়ার্ড ডোমেইনেও browser pixel চালানো, শেয়ার্ড `_fbp` মেনে নিয়ে, কিন্তু `_fbc` উপরের মতোই namespaced। সমস্যা ১ তখনও সমাধান হয়, ২ থেকে যায়, ৩/৪ অপরিবর্তিত। §11-এ open decision হিসেবে রাখা হলো।

### 8.3 কেস C — কাস্টম ডোমেইন (পরিকল্পিত)

`feature_roadmap_context.md` আইটেম ৬ ("Custom domain সাপোর্ট — DNS CNAME verification + nginx/certbot automation") এখানে সরাসরি নির্ভরতা। দুটো উপ-কেস:

**C1 — সেলারের নিজের ডোমেইন** (`lp.sellershop.com` CNAME → আমাদের সার্ভার)
কেস A-র সমান — সম্পূর্ণ first-party, সেলার নিজে Meta-তে ডোমেইন verify করতে পারে, AEM কাজ করে। **আচরণ: Full tracking।** এটাই প্রস্তাবিত ডিফল্ট সুপারিশ, এবং custom domain ফিচারের সবচেয়ে শক্ত বিক্রয়-যুক্তি।

**C2 — আমাদের ডোমেইনে per-seller সাবডোমেইন** — ✅ **লাইভ (২০২৬-০৮-১৫), এবং এটাই এখন BSOL ল্যান্ডিং পেজের একমাত্র রূপ**

বাস্তবায়িত হয়েছে `{seller}.zyrotechbd.com` হিসেবে (`custom_domain_context.md`)। ডিজাইনের সাথে দুটো পার্থক্য নিচে।

- ✅ কুকি **exact host-এ** — `domain=` অ্যাট্রিবিউট ছাড়া। এটা এখন একটা **হার্ড কনস্ট্রেইন্ট**, শুধু ট্র্যাকিং-এর সুপারিশ নয় (`custom_domain_context.md §2`)। ফলে কেস B-র সমস্যা ১ ও ২ কাঠামোগতভাবেই শেষ।
- ⚠️ **আলাদা apex হয়নি** — একই `zyrotechbd.com`-এ, যেখানে ড্যাশবোর্ড ও API-ও আছে। অর্থাৎ কেস B-র সমস্যা ৪ (শেয়ার্ড রেপুটেশন) **রয়ে গেছে**। §8.6.4 দেখো।
- ✅ **domain verification যাচাই হয়ে গেছে (২০২৬-০৮-১৫)** — **সেলার নিজে পারবে না**, Meta শুধু root ডোমেইন নেয় (§11.7-এ Meta-র নিজের বাক্য উদ্ধৃত)। তবে root verify করলে **সব সাবডোমেইন এমনিতেই কভার হয়**, তাই `zyrotechbd.com` একবার verify করাই প্রতিটি সেলারের জন্য যথেষ্ট — per-seller কাজ শূন্য। মূল্য: **AEM ইভেন্ট প্রায়োরিটি প্ল্যাটফর্ম-স্তরে একক**, সেলার-প্রতি নয়।
- **আচরণ: browser Pixel + server CAPI, অর্থাৎ Full tracking।** কুকি আইসোলেশন পূর্ণ, তাই pixel চালাতে কোনো correctness বাধা নেই; একমাত্র ঘাটতি সেলার-প্রতি AEM নিয়ন্ত্রণ। (বাংলাদেশি ট্রাফিকের অধিকাংশ Android, তাই iOS-কেন্দ্রিক AEM-এর ক্ষতি তুলনামূলক কম।)

**⚠️ C2-র নিজস্ব নতুন শর্ত — Pixel কখনো ড্যাশবোর্ডে লোড হবে না**

সাবডোমেইনে সেলারের **ল্যান্ডিং পেজ আর ড্যাশবোর্ড একই origin-এ** (`{seller}.zyrotechbd.com/{slug}` ও `{seller}.zyrotechbd.com/dashboard/...`)। তাই Pixel base code **শুধু পাবলিক ল্যান্ডিং রুটে** ইনজেক্ট হবে, `/dashboard/*`-এ **কখনো নয়**:

- সেলারের নিজের ড্যাশবোর্ড ব্রাউজিং PageView/ViewContent ইভেন্ট হয়ে যাবে → **নিজের কোটা নিজেই খাবে** এবং audience/optimization নষ্ট করবে (সেলার নিজেই "সবচেয়ে engaged ভিজিটর" হয়ে যাবে)।
- ড্যাশবোর্ডের URL-এ order id, customer ফোন ইত্যাদি থাকে — `event_source_url` হিসেবে Meta-তে পাঠানো মানে ক্রেতার ডেটা অপ্রয়োজনে বাইরে যাওয়া।

*টোকেন-চুরির দিক থেকে এটা নতুন ঝুঁকি নয়* — সেলার আগে থেকেই নিজের ল্যান্ডিং পেজে `html_sections`/`custom_css` দিয়ে ওই origin-এ যা খুশি JS চালাতে পারে, আর ঝুঁকিটা তার **নিজের** অ্যাকাউন্টেই সীমাবদ্ধ (`domain_security_audit.md`-এ গৃহীত)। উপরের দুটো কারণ correctness ও প্রাইভেসির, নিরাপত্তার নয়।

**⚠️ সাবডোমেইন বদলানোর প্রভাব** — §8.6.3 দেখো, ডিজাইনের ধারণা ভুল ছিল।

### 8.4 কেসগুলোর সারসংক্ষেপ (২০২৬-০৮-১৫-এ হালনাগাদ)

আজ **দুটো** কেস বাস্তবে আছে — A ও C2। B বিলুপ্ত, C1 পরে (T8b)।

| | কেস A (সেলারের নিজের WP) | ~~কেস B (শেয়ার্ড ডোমেইন)~~ | কেস C1 (সেলারের নিজের ডোমেইন) | **কেস C2 (আমাদের সাবডোমেইন)** |
|---|---|---|---|---|
| অবস্থা | **লাইভ** (প্লাগইন T4-এ) | ⛔ বিলুপ্ত | T8b, পরে | **লাইভ** |
| Browser Pixel | হ্যাঁ | ~~না~~ | হ্যাঁ | **হ্যাঁ** (ল্যান্ডিং রুটে, `/dashboard/*`-এ কখনো নয়) |
| Server CAPI | হ্যাঁ | ~~হ্যাঁ~~ | হ্যাঁ | হ্যাঁ |
| `fbp`/`fbc` আইসোলেশন | পূর্ণ | ~~BSOL-namespaced~~ | পূর্ণ | **পূর্ণ** (exact-host কুকি, হার্ড কনস্ট্রেইন্ট) |
| সেলার domain verify / AEM | পারে | ~~পারে না~~ | পারে | **পারে না** — apex আমরা verify করি, AEM প্ল্যাটফর্ম-স্তরে একক (§11.7) |
| রেপুটেশন ঝুঁকি | সেলারের নিজের | ~~শেয়ার্ড~~ | সেলারের নিজের | **শেয়ার্ড, অ্যাপ ডোমেইনসহ** (§8.6.4) |
| ট্র্যাকিং টিয়ার | Full | ~~Basic~~ | Full | **Full**, শুধু per-seller AEM নিয়ন্ত্রণ ছাড়া |

**প্রোডাক্ট ফ্রেমিং (সংশোধিত):** পুরনো ফ্রেমিং ছিল "Basic ফ্রি, Full কাস্টম ডোমেইনের সাথে" — সেটা আর খাটে না, কারণ **সবাই ইতিমধ্যেই Full-এর কাছাকাছি**। এটা খারাপ খবর নয়: ট্র্যাকিং-এর মান এখন সবার জন্য ভালো, আর বিক্রির যুক্তি সরে গেছে **ইভেন্ট কোটায়** (§5-এর প্যাকেজ লিমিট) — যেটা ব্যবহারের সাথে রৈখিকভাবে বাড়ে, তাই upsell হিসেবে বেশি স্বাভাবিক। T8b (সেলারের নিজের ডোমেইন) তখন ব্র্যান্ডিং + AEM-এর নিশ্চয়তার জন্য, ট্র্যাকিং চালু করার জন্য নয়।

### 8.5 SaaS landing page-এর কারিগরি বাস্তবায়ন

Landing page BSOL-এর নিজের Next.js-এ (`frontend/src/app/lp/[slug]/page.tsx` → `PublicLandingPageView` client component)। `page.tsx` ইতিমধ্যেই `headers()` থেকে `x-forwarded-host` পড়ে (`getBaseUrl()`) — অর্থাৎ host-সচেতন রাউটিং-এর ভিত্তি আজই আছে।

> **আপডেট (২০২৬-০৮-১৫):** `app/lp/[slug]/` এখন **শুধু ভেতরের render target** — পাবলিক ঠিকানা `{seller}.{apex}/{slug}`, আর `src/proxy.ts` সেটাকে `/lp/{slug}`-এ rewrite করে (rewrite proxy-কে পুনরায় ডাকে না, তাই যেকোনো host-এ সরাসরি `/lp/...` চাওয়া 404)। ফাইলপথ অপরিবর্তিত, কিন্তু **`event_source_url` সবসময় পাবলিক ঠিকানা হতে হবে** (`{seller}.{apex}/{slug}`), ভেতরের rewrite path নয় — নাহলে Meta-তে এমন URL যাবে যা ব্রাউজারে কখনো খোলে না, আর domain verification/AEM ম্যাচিং ভাঙবে। `LandingPage::canonicalUrl()` ইতিমধ্যেই সঠিক পাবলিক ঠিকানা দেয় — এটাই ব্যবহার করতে হবে, নিজে বানানো নয়। **সতর্কতা:** `canonicalUrl()` **nullable** (সাবডোমেইনহীন শপের draft পেজে `null`)। `null` হলে ইভেন্ট `event_source_url` ছাড়া যাবে, বানানো URL দিয়ে নয়।

- `page.tsx` (server component) → host + slug থেকে প্রযোজ্য destination resolve → tracking config (pixel id, consent mode) পেজে পাঠায়। **public payload-এ শুধু pixel id, access token কখনো নয়**।
- **base code শুধু এই রুটে** — `/dashboard/*`-এ কখনো নয় (§8.3 C2-র শর্ত; একই origin বলে এটা সহজেই ভুল হতে পারে)।
- নতুন client hook `useBsolTracking()` — PageView / ViewContent (প্রোডাক্ট ব্লক দেখা) / InitiateCheckout (checkout ফর্মে প্রথম ইনপুট) / Lead (ফোন valid হলে) / Purchase (thank-you)। `fbq` + server POST একই `event_id` দিয়ে। thank-you একই সাবডোমেইনে (`/{slug}/thank-you`), তাই checkout-এর মাঝপথে কুকি হারানোর সমস্যা নেই।
- Ingest রুট **host-ভিত্তিক**: `POST /api/public/track`, Host থেকে `LandingPageResolver` দিয়ে resolve (§8.0)। slug-ভিত্তিক রুট বানানো হবে না — host-ই এখন একমাত্র সত্য, আর slug আর globally unique নয় (per-shop), তাই slug একা কোনো শপ নির্দেশ করে না। সাবডোমেইনে API same-origin, তাই CORS-এর প্রশ্নও নেই।
- `landing_pages.content.settings`-এ per-page toggle (`tracking_enabled`, `tracking_destination_id`) — `frontend/src/lib/landing-pages.ts` ও backend validation দুই জায়গায় যোগ।
- বিদ্যমান `landing_page_visits` টেবিল অপরিবর্তিত (BSOL-এর নিজস্ব analytics) — tracking pipeline-এর সাথে মেশানো হবে না, দুটোর উদ্দেশ্য আলাদা।

### 8.6 T8a — per-seller সাবডোমেইন (`seller1.zyrotechbd.com/landingpage1`), সম্পূর্ণ স্বয়ংক্রিয়

> **আপডেট (২০২৬-০৮-১৪):** T8a এখন নিজস্ব পূর্ণাঙ্গ ডিজাইন ডকে — **`custom_domain_context.md`**। পরিধিও বেড়েছে: শুধু ল্যান্ডিং পেজ নয়, সেলারের **ড্যাশবোর্ডও** তার সাবডোমেইনে চলবে, এবং `bsol.`-এ লগইন করলে handoff টোকেন দিয়ে সাবডোমেইনে রিডাইরেক্ট হবে। নিচের DNS/TLS/nginx অংশ সেখানে বিস্তারিত করা হয়েছে।

লক্ষ্য: নতুন সেলার যোগ হলে **কোনো ম্যানুয়াল DNS বা সার্টিফিকেট কাজ নয়** — শুধু একটা `landing_domains` row। এটা তিনটা এককালীন সেটআপে সম্ভব।

**যাচাই করা বর্তমান অবস্থা (২০২৬-০৮-১৪):**

| যাচাই | ফলাফল | তাৎপর্য |
|---|---|---|
| `dig A bsol.zyrotechbd.com` | `103.157.253.197` | একক সার্ভার, প্রক্সি স্তর নেই |
| `dig A random-test-xyz.zyrotechbd.com` | খালি | **wildcard DNS আজ নেই** — যোগ করতে হবে |
| `dig NS zyrotechbd.com` | `ns9.ancbd.com`, `ns10.ancbd.com` | **এটাই প্রধান বাধা**, নিচে দেখো |
| nginx `location /` | `proxy_set_header Host $host;` ইতিমধ্যে আছে | Next.js আসল host পায় — host-ভিত্তিক রাউটিং-এ nginx-এ কোনো header পরিবর্তন লাগবে না |
| `backend/.env` | `SESSION_DOMAIN=null` | **নিরাপত্তার দিক থেকে ভালো খবর**, নিচে দেখো |

**যা লাগবে (তিনটাই এককালীন):**

1. **Wildcard DNS** — `*.zyrotechbd.com` A → `103.157.253.197`। একবার, তারপর যেকোনো সাবডোমেইন আপনাআপনি resolve হবে।
2. **Wildcard TLS** — `*.zyrotechbd.com` সার্টিফিকেট। এখানেই বাধা (নিচে §8.6.1)।
3. **nginx regex server block** —
   ```
   server_name ~^(?<seller>[a-z0-9][a-z0-9-]{1,40})\.zyrotechbd\.com$;
   ```
   বিদ্যমান `bsol.zyrotechbd.com` block-এ **exact match সবসময় regex-এর আগে জেতে**, তাই ড্যাশবোর্ড/API অক্ষত থাকে, কোনো সংঘাত নেই। নতুন block শুধু Next.js-এ প্রক্সি করবে (PHP/`/api/` location ছাড়াই — সেলার সাবডোমেইনে API expose করার দরকার নেই)।
4. **অ্যাপ্লিকেশন স্তরে** — Next.js `headers().get('host')` → `TrackingHostResolver`/`landing_domains` লুকআপ → seller resolve, তারপর path থেকে slug। অজানা সাবডোমেইন → 404।

#### 8.6.1 প্রধান বাধা — DNS provider

Wildcard সার্টিফিকেট **শুধুমাত্র DNS-01 challenge**-এ issue হয় (HTTP-01 কখনো wildcard দেয় না)। DNS-01 স্বয়ংক্রিয়ভাবে নবায়ন করতে DNS provider-এর API + সংশ্লিষ্ট certbot plugin দরকার। `zyrotechbd.com`-এর nameserver এখন **ANCBD** (`ns9/ns10.ancbd.com`), যার জন্য certbot plugin নেই — অর্থাৎ প্রতি ৬০-৯০ দিনে হাতে TXT রেকর্ড বদলাতে হবে, যা "ম্যানুয়াল কাজ শূন্য" শর্ত ভাঙে।

**সমাধান (সুপারিশকৃত):** registrar অপরিবর্তিত রেখে শুধু **nameserver Cloudflare-এ সরানো** (ফ্রি প্ল্যানেই যথেষ্ট)। তারপর `certbot-dns-cloudflare` plugin দিয়ে wildcard cert issue ও নবায়ন সম্পূর্ণ স্বয়ংক্রিয়। এককালীন ~৩০ মিনিটের ops কাজ, ঝুঁকি কম (DNS রেকর্ড হুবহু কপি করে nameserver বদলাতে হবে, TTL কমিয়ে আগে থেকে প্রস্তুতি)।

**বিকল্প (DNS না সরালে):** wildcard বাদ, প্রতি সাবডোমেইনে আলাদা HTTP-01 cert (DNS API লাগে না, সাবডোমেইন তৈরির সময় queued job থেকে certbot চলবে)। কিন্তু Let's Encrypt-এর **"Certificates per Registered Domain" সীমা সপ্তাহে ৫০** — অর্থাৎ সপ্তাহে সর্বোচ্চ ~৫০ জন নতুন সেলার, এবং প্রতিটা cert আলাদাভাবে নবায়ন-মনিটর করতে হবে। শুরুতে চলে, স্কেলে দেয়াল।

#### 8.6.2 নিরাপত্তা — cross-subdomain কুকি (verified, কিন্তু ভঙ্গুর)

`SESSION_DOMAIN=null` (verified) → Laravel/Sanctum-এর কুকি **host-only**, `.zyrotechbd.com`-এ শেয়ার হয় না। তাই সেলার সাবডোমেইনের পেজ থেকে ড্যাশবোর্ড সেশন কুকি পড়া যায় না।

**এটা একটা কঠিন শর্ত হিসেবে ধরে রাখতে হবে:** কেউ ভবিষ্যতে `SESSION_DOMAIN=.zyrotechbd.com` করলে সাথে সাথেই ক্রস-সাবডোমেইন সেশন এক্সপোজার তৈরি হবে — এবং সেলাররা landing page builder-এ custom HTML/CSS বসাতে পারে (`custom_css`, `html_sections`, DOMPurify দিয়ে sanitize হয়), তাই এটা তাত্ত্বিক ঝুঁকি নয়। ট্র্যাকিং কুকিও (`bsol_fbp_*`/`bsol_fbc_*`) অবশ্যই exact-host-এ বসবে, `domain=` অ্যাট্রিবিউট ছাড়া।

#### 8.6.3 সাবডোমেইন নাম ব্যবস্থাপনা — ✅ **বাস্তবায়িত, দুটো ধারণা ভুল ছিল**

- ✅ **Reserved blocklist** — বাস্তবায়িত, কিন্তু hardcoded তালিকা হিসেবে নয়: `reserved_subdomains` টেবিল + **Admin → Settings → Reserved Subdomains** UI, `is_system` সুরক্ষা সহ। ১২৮টা row migration-এই বসে।
- ❌ **"Immutable" ধারণাটা ভুল ছিল** — বাস্তবে সাবডোমেইন **বদলানো যায়**, পুরনো label চিরকাল `subdomain_tombstones`-এ যায় এবং শপের বর্তমান ঠিকানায় **301** হয়। ট্র্যাকিং-এর জন্য তিনটা পরিণতি:
  1. **`_fbp`/`_fbc` রিসেট** — নতুন host মানে নতুন কুকি ডোমেইন; প্রতিটা ফিরতি ভিজিটর Meta-র কাছে নতুন ব্যক্তি।
  2. **`event_source_url` বদলে যায়** — Meta-র কাছে এটা ভিন্ন ডোমেইন, domain verification/AEM আবার করতে হবে।
  3. ⚠️ **retired label-এ ingest POST নীরবে ব্যর্থ হবে** — বেশিরভাগ HTTP ক্লায়েন্ট ও `fetch` 301-এ POST-কে GET-এ নামায় (`custom_domain_context.md §18`-এ WordPress Connect API-র জন্য ঠিক এই কারণেই প্ল্যাটফর্ম ডোমেইন pin করা হয়েছে)। পুরনো host-এ ক্যাশড ল্যান্ডিং পেজ খোলা থাকা ব্রাউজার থেকে ইভেন্ট আর পৌঁছাবে না, অথচ কোনো ত্রুটিও দেখা যাবে না।

  **ফলাফল:** সাবডোমেইন বদলানোর UI-তে সতর্কতা ট্র্যাকিং-সচেতন হতে হবে (§8.7), আর T6-এ ingest ব্যর্থতা মাপার ব্যবস্থা রাখতে হবে — নীরব শূন্যতা এখানে সবচেয়ে খারাপ ফল।
- ✅ **`landing_pages.slug` এখন per-shop unique** (`unique(user_id, slug)`) — §11.9 বন্ধ। `/lp/{slug}` global lookup সম্পূর্ণ মুছে ফেলা হয়েছে (`legacy_slug` সহ), তাই যে জটিলতার আশঙ্কা ছিল তার কিছুই লাগেনি।

#### 8.6.4 কৌশলগত প্রশ্ন — একই apex, নাকি আলাদা?

`*.zyrotechbd.com` ব্যবহার করলে খরচ শূন্য এবং কাজ কম। কিন্তু §8.2-এর সমস্যা ৪ থেকে যায়: কোনো সেলারের পেজ Meta বা Google Safe Browsing-এ ফ্ল্যাগ হলে parent domain-এর reputation প্রভাবিত হতে পারে — আর সেই একই apex-এ ড্যাশবোর্ড ও API। একটা **আলাদা apex** (বছরে ~$১০) এই ঝুঁকি সম্পূর্ণ আলাদা করে; কারিগরিভাবে দুটোই হুবহু একইভাবে কাজ করে (একই wildcard DNS + wildcard cert + regex block)। *সুপারিশ:* আলাদা apex, কারণ পার্থক্যটা নগণ্য খরচের কিন্তু ঝুঁকিটা প্ল্যাটফর্ম-ব্যাপী।

> **যা আসলে হয়েছে (২০২৬-০৮-১৫): একই apex** — `{seller}.zyrotechbd.com`, ড্যাশবোর্ড ও API-র সাথে। উপরের সুপারিশ মানা হয়নি, তাই **শেয়ার্ড রেপুটেশন ঝুঁকি বহাল**: কোনো সেলারের ল্যান্ডিং পেজ Meta-তে ফ্ল্যাগ হলে তা `zyrotechbd.com`-এর গায়ে লাগতে পারে, আর সেখানেই `bsol.` (ড্যাশবোর্ড + API) ও প্রতিষ্ঠানের মূল সাইট।
>
> **এখন আর সস্তায় বদলানো যাবে না** — সেলাররা ইতিমধ্যে সাবডোমেইন নিয়ে ফেলেছে, এবং §8.6.3 অনুযায়ী host বদলানো মানে প্রত্যেকের `_fbp`/`_fbc` ও domain verification হারানো। যদি কখনো সরাতেই হয়, সেটা করতে হবে **বিজ্ঞাপন শুরুর আগে, এবং একবারেই সব সেলারের জন্য** — ট্র্যাকিং লাইভ হয়ে যাওয়ার পরে নয়।
>
> **দ্বিতীয় খরচ, ২০২৬-০৮-১৫-এ নিশ্চিত হওয়া:** Meta একটা root ডোমেইন **একটাই business**-এ verify করতে দেয় (§11.7)। একই apex ব্যবহার করায় সেই business আমরা, তাই **কোনো সেলার কখনো নিজের ডোমেইন Meta-তে verify করতে পারবে না** এবং AEM প্রায়োরিটি প্ল্যাটফর্ম-স্তরে একক থাকবে। আলাদা apex নিলেও এটা বদলাত না (সেটাও তো আমাদেরই থাকত) — অর্থাৎ **এই সীমাটা apex পছন্দের নয়, "আমাদের ডোমেইনে থাকা"-রই অন্তর্নিহিত মূল্য**। সেলার-প্রতি verification একমাত্র T8b-তেই সম্ভব।
>
> **প্রশমন (আলাদা apex ছাড়াই যা করা যায়):** (ক) ল্যান্ডিং পেজ কনটেন্ট মডারেশন — নীতি-লঙ্ঘনকারী পেজ আগেই ধরা, (খ) `landing_pages` publish-এ abuse রিপোর্টের পথ, (গ) Meta-তে ডোমেইন-স্তরের সতর্কতা এলে দ্রুত সাড়া দেওয়ার জন্য admin-এ দৃশ্যমানতা। এগুলো ট্র্যাকিং ফেজের অংশ নয়, কিন্তু ঝুঁকিটা লিখে রাখা দরকার।

### 8.6.6 Cloudflare মাইগ্রেশন রানবুক (সিদ্ধান্ত: nameserver Cloudflare-এ সরানো হবে)

**সতর্কতা — এটা শুধু `bsol` সাবডোমেইনের ব্যাপার নয়।** DNS ইনভেন্টরি (২০২৬-০৮-১৪, `ns9.ancbd.com`-এ সরাসরি query করে) দেখাচ্ছে apex, www এবং মেইল **অন্য সার্ভারে** — ভুল হলে মূল ওয়েবসাইট ও ইমেইল দুটোই বন্ধ হবে, SaaS নয়।

| রেকর্ড | মান | নোট |
|---|---|---|
| `zyrotechbd.com` A | `103.157.253.198` | **bsol-এর সার্ভার নয়** |
| `www` A | `103.157.253.198` | |
| `app` A | `103.157.253.198` | |
| `bsol` A | `103.157.253.197` | এই সার্ভার |
| `zyrotechbd.com` MX | `0 zyrotechbd.com.` | মেইল → `.198` |
| `mail`, `ftp` CNAME | `zyrotechbd.com.` | |
| `webmail`, `cpanel`, `whm`, `autodiscover`, `autoconfig` A | `103.125.253.25` | cPanel হোস্ট |
| `zyrotechbd.com` TXT (SPF) | `v=spf1 +a +mx +ip4:103.125.253.25 ~all` | |
| `_dmarc` TXT | `v=DMARC1; p=none;` | |
| `default._domainkey` TXT | DKIM RSA কী (দুই স্ট্রিং-এ ভাগ) | **হুবহু কপি করতে হবে, নাহলে মেইল signing ভাঙবে** |
| CAA | নেই | Let's Encrypt-এ কোনো বাধা নেই |

**সীমাবদ্ধতা:** AXFR (zone transfer) বন্ধ, তাই উপরের তালিকা common নাম probe করে বানানো — **সম্পূর্ণ নয়**। ANCBD প্যানেল থেকে zone file export নিয়ে মিলিয়ে দেখা বাধ্যতামূলক।

**ধাপ:**

1. **(আগে)** ANCBD প্যানেল থেকে zone export → উপরের তালিকার সাথে মিলিয়ে অনুপস্থিত রেকর্ড চিহ্নিত করো।
2. Cloudflare ফ্রি অ্যাকাউন্ট → Add Site `zyrotechbd.com` → auto-scan হবে → **প্রতিটা রেকর্ড হাতে যাচাই** (auto-scan প্রায়ই DKIM/SPF-এর মতো TXT মিস করে)।
3. **সব রেকর্ড DNS-only (grey cloud)** — proxy (orange) এখন নয়, কারণ proxied হলে client IP `CF-Connecting-IP` হেডারে আসে; nginx-এ `set_real_ip_from`/`real_ip_header` কনফিগার না করলে **প্রতিটা CAPI ইভেন্টে Cloudflare-এর IP যাবে এবং match quality ধসে পড়বে**, সাথে `TrackLandingPageVisit` ও fraud IP লজিকও ভুল হবে। Proxy পরে আলাদা, ইচ্ছাকৃত সিদ্ধান্ত হিসেবে চালু করা যাবে।
4. Wildcard যোগ: `*` A → `103.157.253.197`, DNS-only। (স্পষ্ট রেকর্ড সবসময় wildcard-কে হারায়, তাই www/mail/cpanel অক্ষত থাকবে।)
5. Registrar-এ nameserver → Cloudflare-এর দেওয়া জোড়া। Propagation-এর পর যাচাই: `dig NS`, `dig A bsol`, `dig MX`, `dig TXT default._domainkey`, সাইট ও **ইমেইল পাঠানো/গ্রহণ** দুটোই টেস্ট।
6. Wildcard cert (সার্ভারে): `apt install python3-certbot-dns-cloudflare` (certbot 2.9.0 apt-installed, `certbot.timer` ইতিমধ্যে সক্রিয় — verified), Cloudflare API token (Zone→DNS→Edit, শুধু এই zone-এ scoped) `/etc/letsencrypt/cloudflare.ini`-তে `chmod 600`, তারপর `certbot certonly --dns-cloudflare -d '*.zyrotechbd.com'` + `certbot renew --dry-run`।
7. nginx regex server block (§8.6) + `nginx -t` + reload। বিদ্যমান `bsol` block ও তার cert **স্পর্শ করা হবে না**।
8. অ্যাপ্লিকেশন: `landing_domains`, `TrackingHostResolver`, Next.js host-রাউটিং, reserved-name blocklist, slug uniqueness সিদ্ধান্ত (§11.9)।

### 8.6.5 T8b — সেলারের নিজের ডোমেইন (পরে)

1. **catch-all server block** (`server_name _;`) — অজানা host এলে 444, `landing_domains`-এ থাকলে render।
2. verification সফল হওয়ার পর queued job → Certbot HTTP-01 + `nginx -t` + reload।
3. **DNS verification** — সেলার TXT রেকর্ড বসায় (`_bsol-verify.{host}` = `verification_token`) অথবা HTTP token ফাইল; verified না হওয়া পর্যন্ত cert issue করা হবে না (নাহলে Let's Encrypt rate limit-এ ধাক্কা)।
4. `ssl_status` মেশিন-স্টেট `landing_domains`-এ, ব্যর্থতা সেলারকে UI-তে দেখাতে হবে — নীরব ব্যর্থতা এখানে সবচেয়ে খারাপ ফল (পেজ খুলবেই না)।
5. সেলার সাবডোমেইনে CNAME বাধ্যতামূলক (§11.8), apex সাপোর্ট নয়।

### 8.7 মাইগ্রেশন ও সতর্কতা (সেলারকে অবশ্যই জানাতে হবে)

- ~~**পুরনো `/lp/{slug}` URL চিরস্থায়ীভাবে কাজ করবে**~~ — **আর প্রযোজ্য নয়।** `/lp/` ও `legacy_slug` মুছে ফেলা হয়েছে (২০২৬-০৮-১৫), কারণ যাচাই করে দেখা গেছে ওই ঠিকানার ট্র্যাফিক টেস্ট ডেটা ছিল এবং প্রকাশিত পেজওয়ালা দুটো শপেরই নিজস্ব সাবডোমেইন আছে। ট্র্যাকিং-এর জন্য এটা **ভালো খবর**: কোনো legacy URL ধরে রাখার বোঝা নেই, প্রতিটা পেজের **একটাই** canonical `event_source_url`।
- **ক্যাম্পেইন চলা অবস্থায় ডোমেইন/সাবডোমেইন বদলানো যাবে না** — `_fbp`/`_fbc` কুকি ডোমেইন পার হয় না, তাই ভিজিটর নতুন পরিচয় পাবে; `event_source_url` বদলে যাওয়ায় Meta-র কাছে এটা ভিন্ন ডোমেইন; আর retired label-এর 301 ingest POST ভেঙে দেয় (§8.6.3)। সুপারিশ: **বিজ্ঞাপন চালুর আগেই ঠিকানা চূড়ান্ত করো**। এই সতর্কতা **সাবডোমেইন বদলানোর UI-তেও দেখাতে হবে** — আজ সেখানে সাধারণ সতর্কতা আছে, ট্র্যাকিং-নির্দিষ্ট নয় (T6-এ যোগ হবে)।
- `tracking_destinations.scope_type`-এ `landing_domain` মান **T8b-তে** যোগ হবে (§4.1, §4.4)। প্ল্যাটফর্ম সাবডোমেইনে দরকার নেই — সেখানে host থেকে সরাসরি `user_id` পাওয়া যায়, তাই shop-wide destination-ই যথেষ্ট।

---

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

**ক্রম পরিবর্তন (২০২৬-০৮-১৫):** T5 এগিয়ে আনা হয়েছে (আগে T4-এর পরে ছিল), আর T3-এর backfill T1-এ ঢুকেছে। কারণ **§1-এর মূল লিভার (`OrderDelivered` → Meta) সম্পূর্ণ server-side** — এর জন্য ব্রাউজার কোড, প্লাগইন বা §11.7-এর উত্তর কিছুই লাগে না। তাই তিন ফেজেই (T1→T2→T5) বিক্রয়যোগ্য differentiator দাঁড়িয়ে যায়, বাকি সব তার উপর মান যোগ করে।

| ফেজ | পরিধি | নির্ভরতা |
|---|---|---|
| **T1** ✅ | ডেটা মডেল (৩ টেবিল + package কলাম) + `TrackingQuotaService` + `TrackingIngestService` + `TrackingUserDataBuilder` + `app:purge-tracking-events` + admin package UI-তে লিমিট ফিল্ড। **`facebook_pixel_settings` → `tracking_destinations` backfill এখানেই** (§4.1)। **সম্পন্ন ২০২৬-০৮-১৫** | — |
| **T2** | `MetaCapiDriver` (batched) + `DispatchTrackingEventsJob` + retry/log + `SendFacebookCapiPurchaseEventJob`-কে নতুন পাইপলাইনে wrapper করা (behavior অপরিবর্তিত, দুটো লাইভ call-site অস্পৃশ্য) | T1 |
| **T5** | **Order-flow ইভেন্ট** — `OrderStatusService::transition()`-এ hook, Delivered/Returned/Confirmed, deterministic `order_{id}_{event}`। ← **এখানেই প্রোডাক্টের মূল মূল্য** | T2 |
| **T6** | Landing page ট্র্যাকিং (Next.js), সেলার সাবডোমেইনে **Full tracking** (browser Pixel + CAPI, `event_id` dedup) + per-page toggle। host resolution বিদ্যমান `LandingPageResolver`-এ (§8.0) | T2 |
| **T4** | WordPress প্লাগইন `Bsol_Tracking` মডিউল — base code, browser JS, first-party REST endpoint, batch relay, funnel ইভেন্ট (plugin v1.17.0) | T2 |
| **T3** | Multi-destination **UI** — dashboard CRUD, scope selector, একাধিক pixel (backfill T1-এ হয়ে গেছে) | T1 |
| **T7** | Dashboard: event log, quota মিটার, match-quality সারাংশ; fraud signal অর্ডার-ডিটেইলে প্রদর্শন | T2–T6 |
| **T8b** | সেলারের নিজের ডোমেইন (§8.3 C1, §8.6.5) — `landing_domains` টেবিল, DNS verification, per-domain Certbot, catch-all nginx। **বিক্রয়-যুক্তি এখন সুনির্দিষ্ট:** সেলার নিজে Meta-তে ডোমেইন verify করে **নিজের AEM ইভেন্ট প্রায়োরিটি** নিয়ন্ত্রণ করার একমাত্র পথ (§11.7) | T6 |

**~~T8a~~** — সম্পন্ন, `custom_domain_context.md` দেখো।

### 10.1 কাস্টম ডোমেইন কি আগে বানাতে হবে? — না

> **যা হয়েছে (২০২৬-০৮-১৫):** প্রশ্নটা নিজে থেকেই মিটে গেছে — T8a (per-seller সাবডোমেইন) **ট্র্যাকিং শুরুর আগেই সম্পূর্ণ হয়ে গেছে**, ট্র্যাকিং-এর জন্য নয়, নিজের কারণে। ফলে নিচের যুক্তিগুলো আর সিদ্ধান্তের জন্য দরকার নেই, কিন্তু §10.1-এর **শেষ অনুচ্ছেদের ডিজাইন-শর্তটা** (host-ভিত্তিক resolution) এখনো সমান গুরুত্বপূর্ণ — এবং সেটা এখন **বিনামূল্যে পূরণ হয়ে আছে**, কারণ সাবডোমেইনের কাজেই resolver তৈরি হয়ে গেছে (§8.0)। শুধু ভুল করে দ্বিতীয় একটা resolver না লিখলেই হলো।
>
> নিচের §10.1-এর একমাত্র অংশ যা এখনো বাস্তব সিদ্ধান্ত: **T8b (সেলারের নিজের ডোমেইন) ট্র্যাকিং আটকাবে না** — সেটা এখনো সত্য, এবং এখন আরও জোরালো, কারণ সাবডোমেইনেই Full tracking পাওয়া যাচ্ছে।

**সিদ্ধান্ত: ট্র্যাকিং কাজ কাস্টম ডোমেইনের জন্য আটকে রাখা হবে না।** যুক্তি:

1. §1-এর মূল লিভার (`OrderDelivered`/`OrderConfirmed` → Meta) **সম্পূর্ণ server-side CAPI** — ডোমেইনের উপর এর কোনো নির্ভরতা নেই। শেয়ার্ড ডোমেইনেও ১০০% কাজ করে।
2. **কেস A (সেলারের নিজের WordPress সাইট) কাস্টম ডোমেইন ছাড়াই আজই Full tier** — সেখানে ব্রাউজার সেলারের নিজের ডোমেইনেই। T4 (প্লাগইন) কাস্টম-ডোমেইন কাজের উপর মোটেও নির্ভরশীল নয়, অথচ সবচেয়ে বেশি ট্র্যাফিক সম্ভবত এখান থেকেই আসবে।
3. কাস্টম ডোমেইন একটা **স্বতন্ত্র ops প্রকল্প** (catch-all nginx, DNS verification, per-domain Certbot issue + renewal মনিটরিং, ব্যর্থতার state machine) — ট্র্যাকিং-এর উপ-অংশ নয়। এটার জন্য অপেক্ষা করলে revenue-প্রাসঙ্গিক অংশটাই সপ্তাহ-খানেক পিছিয়ে যায়।
4. ট্র্যাকিং আগে করলে কাস্টম ডোমেইনের ডিজাইন **আরও ভালো হয়** — host-resolution-এ ঠিক কী কী hook লাগে তা তখন বাস্তব কোড থেকে জানা থাকবে, অনুমান করতে হবে না।

**একমাত্র বাস্তব ঝুঁকি:** যে সেলার শেয়ার্ড ডোমেইনে বিজ্ঞাপন চালিয়ে pixel learning জমাবে, পরে কাস্টম ডোমেইনে সরলে `_fbp`/`_fbc` ধারাবাহিকতা ও `event_source_url` দুটোই হারাবে (§8.7)। প্রশমন: `/lp/{slug}` চিরস্থায়ীভাবে চালু থাকবে, কেউ সরতে বাধ্য নয়; এবং যে সেলার কাস্টম ডোমেইন চায় সে অপেক্ষা করতে পারে। AEM/iOS-এর ক্ষতিও বাংলাদেশি ট্র্যাফিকে তুলনামূলক কম, কারণ অধিকাংশ ট্র্যাফিক Android।

**মাঝপথের সস্তা বিকল্প (বিবেচনার যোগ্য):** পূর্ণ কাস্টম-ডোমেইন ফিচারের ব্যয়বহুল অংশ হলো **সেলারের নিজের ডোমেইন** (per-seller DNS verification + per-domain Certbot + renewal মনিটরিং)। শুধু **আমাদের নিজস্ব apex-এ per-seller সাবডোমেইন** (`{slug}.bsolpages.com`) করলে সেটা মোট কাজের ছোট একটা ভগ্নাংশ — একটাই wildcard cert (DNS-01, per-seller কাজ শূন্য), catch-all nginx block, host→page রাউটিং; কোনো DNS verification বা per-domain cert লাগে না। এতে §8.2-এর সমস্যা ১ (`_fbc` দূষণ), ২ (`_fbp` শেয়ারিং) ও ৪ (রেপুটেশন — অ্যাপ ডোমেইন থেকে আলাদা) সমাধান হয়; সমস্যা ৩ (domain verification) হয় না (§11.7-এর উত্তরের উপর নির্ভরশীল)। **T8-কে দুই ভাগে ভাগ করা যায়: T8a = প্ল্যাটফর্ম সাবডোমেইন (সস্তা), T8b = সেলারের নিজের ডোমেইন (ব্যয়বহুল)।**

**যে ডিজাইন-শর্তটা এখনই মানতে হবে** (নাহলে T8 একটা rewrite হয়ে যাবে): T6-এ `TrackingHostResolver` **প্রথম দিন থেকেই host-ভিত্তিক** লিখতে হবে (§8.0), slug-ভিত্তিক শর্টকাট নয় — তাহলে পরে কাস্টম ডোমেইন যোগ করা নিছক একটা `landing_domains` row যোগ করার ব্যাপার, কোড পরিবর্তন নয়।

**প্রতি ফেজের বাধ্যতামূলক চেকলিস্ট** (প্রতিষ্ঠিত কনভেনশন): isolated Postgres schema-তে টেস্ট (create → `DB_SCHEMA=xxx php artisan test` → drop), ২টা পরিচিত pre-existing failure baseline (`AuthApiTest`, `CourierFraudCheckApiTest`) মিলিয়ে দেখা, `php artisan migrate --force` প্রোডাকশনে (এই checkout-ই প্রোডাকশন), frontend বদলালে `deploy-safe.sh`, প্লাগইন বদলালে `php -l` + hook/nonce/AJAX-action cross-check + `SETUP.md`-এ QA সেকশন, staff-role তিন-কেস verification (§6.2), এবং **`CONTEXT.md §৩২`-এর সাবডোমেইন চেকলিস্ট** — Host থেকে কোনো সিদ্ধান্ত নিচ্ছি কি না, `LandingPageResolver`/`FrontendUrl` ব্যবহার করছি কি না, নতুন top-level রুট হলে proxy-র `APP_PATHS`-এ যোগ হয়েছে কি না।

---

## 11. উন্মুক্ত সিদ্ধান্ত (কাজ শুরুর আগে ঠিক করতে হবে)

1. **Fan-out মডেল:** এক ইভেন্ট, একাধিক destination — `tracking_events`-এ প্রতি destination-এ আলাদা row, নাকি একটা row + `results` JSON? আলাদা row = পরিষ্কার status ট্র্যাকিং কিন্তু টেবিল n গুণ বড়। *প্রাথমিক ঝোঁক:* একটা row + per-destination result JSON, কারণ quota-ও ingest-ভিত্তিক (§5.1) — দুটো সামঞ্জস্যপূর্ণ থাকে।
2. **Quota-তে কি P0 overage গোনা হবে?** গোনা হলে সেলার লিমিট ছাড়িয়ে যাওয়া দেখবে অথচ কিছু বন্ধ হয়নি — বিভ্রান্তিকর। *প্রাথমিক ঝোঁক:* আলাদা `overage_count` কলামে দেখানো, মূল কাউন্টারে আলাদা।
3. **`OrderDelivered`-এর `value` কী হবে** — অর্ডারের মোট, নাকি ডেলিভারি চার্জ বাদে? Meta ROAS হিসাব এর উপর নির্ভর করে। *প্রাথমিক ঝোঁক:* পণ্যের মূল্য (shipping বাদে), কারণ ROAS-এ shipping revenue নয়।
4. **Landing page pixel id public payload-এ** — pixel id গোপন নয় (browser-এ যেভাবেই হোক দেখা যায়), কিন্তু কোন সেলারের কোন pixel সেটা enumerate করা যাবে কিনা তা ঠিক করতে হবে (host/slug-স্কোপড রেসপন্স, তালিকা নয়)।
5. **Consent ডিফল্ট** — বাংলাদেশে কুকি-কনসেন্ট আইনি বাধ্যবাধকতা নয়; ডিফল্ট `off` রাখা হবে, তবে টগল থাকবে। আন্তর্জাতিক ট্রাফিকওয়ালা সেলারের জন্য চালু করার সুপারিশ ডকুমেন্টে থাকবে।
6. ~~**শেয়ার্ড ডোমেইনে browser Pixel চালানো হবে কি না**~~ — **প্রশ্নটাই বিলুপ্ত (২০২৬-০৮-১৫)।** শেয়ার্ড ডোমেইনে আর কোনো ল্যান্ডিং পেজ নেই (§8.2)। সেলার সাবডোমেইনে কুকি আইসোলেশন কাঠামোগত, তাই **Pixel চালানো হবে** — শুধু পাবলিক ল্যান্ডিং রুটে, `/dashboard/*`-এ কখনো নয় (§8.3 C2)।
7. ~~**Meta domain verification সাবডোমেইনে কীভাবে কাজ করে**~~ — ✅ **উত্তর পাওয়া গেছে (২০২৬-০৮-১৫), Business Manager-এ সরাসরি পরীক্ষা করে। উত্তর: সেলার পারবে না।**

   Meta-র "Add a domain" ডায়ালগ নিজেই বলে দেয়:
   > *"You can only verify the root domain (example.com), not a subdomain (store.example.com) or subpage (example.com/store)."*
   > *"Domains can only be added to one business but can be shared with designated partners."*

   **তিনটে পরিণতি:**

   1. **কোনো সেলার `{seller}.zyrotechbd.com` verify করতে পারবে না** — সাবডোমেইন verification মেকানিজমই নেই। যে "verification token পেস্ট করার ফিল্ড" বানানোর কথা ভাবা হয়েছিল, **সেটার আর দরকার নেই** — একটা ফিচার কমে গেল।
   2. **উল্টো দিকটা ভালো:** root verify করলে তার **সব সাবডোমেইন এমনিতেই ঢেকে যায়**। অর্থাৎ `zyrotechbd.com` একবার verify করলেই বর্তমান ও ভবিষ্যতের **প্রতিটি** সেলার সাবডোমেইন কভার হয়ে যায় — per-seller কাজ শূন্য, এককালীন ~১০ মিনিট।
   3. **কিন্তু ডোমেইনটা একটাই business-এ থাকতে পারে — আমাদের।** তাই **AEM/iOS ইভেন্ট প্রায়োরিটি প্ল্যাটফর্ম-স্তরে একবারই সেট হবে**, সব সেলারের জন্য একই। সেলার নিজে বদলাতে পারবে না।

   **করণীয় (এককালীন, T6-এর আগে):** Cloudflare-এ TXT রেকর্ড দিয়ে `zyrotechbd.com` verify করা (zone আমাদের, তাই apex `.198`-এ থাকলেও সমস্যা নেই), তারপর AEM-এর ৮টা স্লটে `Purchase` সর্বোচ্চে বসানো — COD-এ কার্যত প্রতিটি সেলারের জন্য এটাই সঠিক অগ্রাধিকার, তাই প্ল্যাটফর্ম-স্তরের একক ম্যাপিং বাস্তবে খুব কমই কাউকে আটকাবে।

   **এখনো যাচাই বাকি (ছোট, T6-এর আগে):** ডায়ালগের *"shared with designated partners"* — সেলারের Business ID-তে ডোমেইনটা partner হিসেবে শেয়ার করলে তার নিজের pixel-এ AEM সুবিধা পৌঁছায় কি না, নাকি সেটা শুধু ডোমেইন-অ্যাসোসিয়েশন। একটা সেলারের business ID দিয়ে পরীক্ষা করলেই জানা যাবে। উত্তর যা-ই হোক **কোনো ফেজ আটকায় না**।
8. **কাস্টম ডোমেইনে DNS পদ্ধতি** (T8b) — CNAME (সহজ, apex-এ কাজ করে না) বনাম A রেকর্ড (apex-এ চলে, সার্ভার IP বদলালে সব সেলারকে বদলাতে হয়)। *প্রাথমিক ঝোঁক:* সাবডোমেইনে CNAME বাধ্যতামূলক করা (`lp.sellershop.com`), apex সাপোর্ট না দেওয়া।
9. ~~**`landing_pages.slug` global unique থাকবে না per-seller হবে?**~~ — **শেষ।** `unique(user_id, slug)` বাস্তবায়িত; `/lp/{slug}` ও `legacy_slug` মুছে ফেলা, তাই alias টেবিলের জটিলতা লাগেনি (§8.6.3)।
10. ~~**DNS Cloudflare-এ সরানো হবে কি না**~~ — **শেষ।** সরানো হয়েছে; wildcard DNS + DNS-01 auto-renew চালু।
11. ~~**একই apex নাকি আলাদা apex**~~ — **নিষ্পত্তি হয়েছে: একই apex**, সুপারিশের বিপরীতে। রেপুটেশন ঝুঁকি বহাল ও গৃহীত; §8.6.4-এ ঝুঁকি ও প্রশমন লেখা আছে।

---

## 12. যা এই রাউন্ডে **নয়** (স্পষ্টভাবে scope-এর বাইরে)

- TikTok / GA4 / Snap destination (স্কিমা প্রস্তুত থাকবে, ড্রাইভার নয়)।
- Facebook Lead Ads (`leadgen` webhook) — আলাদা ফিচার, `facebook_integration_context.md §6` item 3।
- Meta Ads Manager থেকে spend/ROAS টেনে আনা (Ads Insights API, `ads_read` permission + নতুন App Review রাউন্ড লাগে)।
- Server-side GTM / নিজস্ব tag manager।
- A/B টেস্টিং বা attribution modeling।
