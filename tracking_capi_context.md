# BSOL Tracking Platform — Server-side + Browser-side Event Tracking (Facebook CAPI) Context

এই ফাইলটা BSOL-এর **Tracking/Attribution মডিউল**-এর একক source of truth। উদ্দেশ্য তিনটা:

1. **ফেক/অনুপস্থিত কাস্টমার কমানো** — Meta-র ad algorithm-কে "কে ফর্ম সাবমিট করেছে" নয়, "কার অর্ডার আসলে ডেলিভারি হয়েছে" সেই সিগন্যাল দেওয়া (COD মার্কেটে সবচেয়ে বড় লিভার)।
2. **আসল কাস্টমার ট্র্যাকিং** — browser (Pixel) + server (Conversions API) দুই দিক থেকে একই ইভেন্ট, `event_id` দিয়ে dedup, উচ্চ Event Match Quality।
3. **SaaS ফিচার হিসেবে বিক্রয়যোগ্য** — সেলার নিজের WordPress/WooCommerce সাইট বা BSOL landing page-এ এক ক্লিকে ট্র্যাকিং চালু করবে, প্যাকেজ অনুযায়ী দৈনিক ইভেন্ট লিমিট।

**অবস্থা:** পরিকল্পনা পর্যায় (২০২৬-০৮-১৪)। কোনো কোড এখনো লেখা হয়নি। নিচের §2 হলো verified ground truth (কোড ও সার্ভার কনফিগ পড়ে যাচাই করা), §3 থেকে পরে ডিজাইন/প্ল্যান। **§8 (Origin/Domain মডেল) সবচেয়ে গুরুত্বপূর্ণ সেকশন** — সেলারের নিজের WordPress, শেয়ার্ড SaaS ডোমেইন, ও পরিকল্পিত কাস্টম ডোমেইন — তিন কেসে ট্র্যাকিং কীভাবে ভিন্ন হয়।

**সম্পর্কিত ডকুমেন্ট:** `CONTEXT.md` (server/ops, §৩১ staff-role বাধ্যতামূলক চেকলিস্ট), `SAAS_MODULE_CONTEXT.md` (মডিউল অডিট), `facebook_integration_context.md` (§8 item 4 — বর্তমান CAPI implementation), `wordpress_connect_context.md` (§7.1 item 1 — deferred full-funnel item, এই ডকেই resolve হবে), `landing_page_context.md`, `subscription_billing_context.md` (প্যাকেজ/লিমিট)।

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
scope_type         string(20) nullable  — null = shop-wide | 'landing_page' | 'platform_api_key' | 'landing_domain'
scope_id           bigint nullable      — কোন landing page / কোন WP site / কোন কাস্টম ডোমেইন (§8.7)
consent_mode       string(20) default 'off'   — 'off' | 'required' (GDPR-ইশ সাইটের জন্য)
last_sent_at, last_error
timestamps
index (user_id, enabled), index (scope_type, scope_id)
```

**Migration নোট:** `facebook_pixel_settings`-এর বিদ্যমান row গুলো এখানে backfill হবে (`provider='meta'`, `label='Default'`, `scope_type=null`), তারপর পুরনো টেবিল কমপক্ষে এক ফেজ ধরে রাখা হবে (drop নয়) — `SendFacebookCapiPurchaseEventJob` এখনো ওটা পড়ে, রোলব্যাক নিরাপত্তার জন্য।

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

### 4.4 `landing_domains` (নতুন — কাস্টম ডোমেইন রেজিস্ট্রি, §8-এর ভিত্তি)

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
| `App\Services\Tracking\TrackingIngestService` | validate → dedup → quota check/sample → `tracking_events` insert → queue dispatch। একমাত্র প্রবেশপথ (landing page, WooCommerce, internal order-flow সবাই এটাই ডাকবে) |
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

// public (landing page browser থেকে), API-key ছাড়া — slug + সাইনড টোকেনে স্কোপড
Route::post('/public/landing-pages/{slug}/track', [PublicTrackingController::class, 'ingest'])->middleware('throttle:300,1');

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

### 8.0 একীভূত মেকানিজম — `TrackingHostResolver`

তিন কেসেই একই নিয়ম: **ইভেন্ট কোন সেলারের, সেটা সবসময় রিকোয়েস্টের `Host`/`Origin` থেকে সার্ভার নিজে বের করবে — ক্লায়েন্টের পাঠানো `destination_id`/`user_id` কখনো বিশ্বাস করা হবে না।**

```
Host header → TrackingHostResolver → (user_id, scope) → প্রযোজ্য tracking_destinations
                 ├── platform_api_keys.domain          → WooCommerce সাইট (Phase 16, বিদ্যমান)
                 ├── landing_domains.hostname          → কাস্টম ল্যান্ডিং ডোমেইন (§4.4, নতুন)
                 └── প্ল্যাটফর্ম ডিফল্ট host + slug     → বর্তমান /lp/{slug}
```

**কেন এটা নিরাপত্তার প্রশ্ন, শুধু কারিগরি পরিপাটি নয়:** ক্লায়েন্ট-সরবরাহকৃত id বিশ্বাস করলে সেলার A সেলার B-র quota শেষ করে দিতে পারবে, বা B-র Pixel-এ ভুয়া ইভেন্ট ঢোকাতে পারবে। Host-ভিত্তিক resolution এই দুটোই বন্ধ করে (WooCommerce-এ API key ইতিমধ্যেই domain-bound — `AuthenticatePlatformApiKey::matchesDomain()`, একই নীতি)।

### 8.1 কেস A — সেলারের নিজের WordPress সাইট

ব্রাউজার সেলারের নিজের ডোমেইনে (`shop.example.com`)। সবচেয়ে ভালো অবস্থা, কোনো আপস নেই:

- `_fbp`/`_fbc` সেলারের নিজের ডোমেইনে first-party — অন্য কোনো সেলারের সাথে মেশে না।
- সেলার নিজের Business Manager-এ নিজের ডোমেইন verify করতে পারে (সে-ই মালিক) → **AEM/iOS ইভেন্ট প্রায়োরিটি কনফিগার করা যায়**।
- `event_source_url` সেলারের verified ডোমেইনেই — Meta-র দিক থেকে সম্পূর্ণ সঙ্গতিপূর্ণ।
- Ingest same-origin (`/wp-json/bsol-connect/v1/t`) → ad blocker/ITP প্রায় ছুঁতে পারে না।

**আচরণ: Full tracking** (browser Pixel + server CAPI, dual, `event_id` dedup) — §7-এর ডিজাইন যেমন আছে তেমনই।

### 8.2 কেস B — BSOL-এর শেয়ার্ড প্ল্যাটফর্ম ডোমেইনে SaaS landing page (আজকের অবস্থা)

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

**C2 — আমাদের ডোমেইনে per-seller সাবডোমেইন** (`zareen.bsolpages.com`)
- কুকি **অবশ্যই exact host-এ** বসবে, `domain=.bsolpages.com` কখনো নয় — নাহলে সাবডোমেইনগুলো আবার কুকি শেয়ার করবে এবং কেস B-র সমস্যা ১/২ ফিরে আসবে।
- **অবশ্যই অ্যাপ ডোমেইন থেকে আলাদা apex** (`bsolpages.com`, `bsol.zyrotechbd.com` নয়) — যাতে কোনো সেলারের পেজের কারণে ডোমেইন ফ্ল্যাগ হলে ড্যাশবোর্ড/API অক্ষত থাকে। কেস B-র সমস্যা ৪-এর কাঠামোগত সমাধান।
- domain verification কে করবে তা **যাচাই করতে হবে** (§11 আইটেম ৭): apex আমরা verify করলে সেলার আলাদাভাবে সাবডোমেইন verify করতে পারবে কিনা, Meta Business Manager-এ বাস্তবে পরীক্ষা করে নিশ্চিত হতে হবে — ডকুমেন্টেশন থেকে অনুমান করে ডিজাইন করা যাবে না।
- verification যদি সেলার-স্তরে সম্ভব হয় → **Full tracking**; না হলে → **Basic tracking** (কেস B-র মতো), কিন্তু কুকি আইসোলেশন ও রেপুটেশন আলাদা থাকায় B-র চেয়ে ভালো।

### 8.4 তিন কেসের সারসংক্ষেপ

| | কেস A (নিজের WP) | কেস B (শেয়ার্ড প্ল্যাটফর্ম ডোমেইন) | কেস C1 (নিজের কাস্টম ডোমেইন) | কেস C2 (আমাদের সাবডোমেইন) |
|---|---|---|---|---|
| Browser Pixel | হ্যাঁ | **না** (server-only) | হ্যাঁ | verification-নির্ভর |
| Server CAPI | হ্যাঁ | হ্যাঁ | হ্যাঁ | হ্যাঁ |
| `fbp`/`fbc` আইসোলেশন | পূর্ণ | BSOL-namespaced | পূর্ণ | পূর্ণ (exact-host কুকি) |
| সেলার domain verify / AEM | পারে | **পারে না** | পারে | যাচাই বাকি |
| রেপুটেশন ঝুঁকি | সেলারের নিজের | **শেয়ার্ড, অ্যাপ ডোমেইনসহ** | সেলারের নিজের | শেয়ার্ড, কিন্তু অ্যাপ থেকে আলাদা |
| ট্র্যাকিং টিয়ার | Full | Basic | Full | Full/Basic |

**প্রোডাক্ট ফ্রেমিং:** "Basic tracking" (শেয়ার্ড ডোমেইন) সবার জন্য ফ্রি-তে চালু; "Full tracking" কাস্টম ডোমেইনের সাথে — অর্থাৎ custom domain ফিচারটা শুধু ব্র্যান্ডিং upsell নয়, **পরিমাপযোগ্য ad-performance upsell**। এটা `feature_roadmap_context.md` আইটেম ৬-এর ব্যবসায়িক যুক্তিকে যথেষ্ট শক্তিশালী করে।

### 8.5 SaaS landing page-এর কারিগরি বাস্তবায়ন

Landing page BSOL-এর নিজের Next.js-এ (`frontend/src/app/lp/[slug]/page.tsx` → `PublicLandingPageView` client component)। `page.tsx` ইতিমধ্যেই `headers()` থেকে `x-forwarded-host` পড়ে (`getBaseUrl()`) — অর্থাৎ host-সচেতন রাউটিং-এর ভিত্তি আজই আছে।

- `page.tsx` (server component) → host + slug থেকে প্রযোজ্য destination resolve → tracking config (pixel id, tier, consent mode) পেজে পাঠায়। **public payload-এ শুধু pixel id, access token কখনো নয়**; শুধু Full tier হলে base code inject।
- নতুন client hook `useBsolTracking()` — PageView / ViewContent (প্রোডাক্ট ব্লক দেখা) / InitiateCheckout (checkout ফর্মে প্রথম ইনপুট) / Lead (ফোন valid হলে) / Purchase (thank-you)। Full tier-এ `fbq` + server POST একই `event_id` দিয়ে; Basic tier-এ শুধু server POST।
- Ingest রুট host-ভিত্তিক হবে: `POST /api/public/track` (`Origin` থেকে resolve), বর্তমান slug-ভিত্তিক রুট (`/public/landing-pages/{slug}/track`) কাস্টম ডোমেইনে কাজ করবে না বলে দ্বিতীয় স্তরের fallback হিসেবে থাকবে।
- `landing_pages.content.settings`-এ per-page toggle (`tracking_enabled`, `tracking_destination_id`) — `frontend/src/lib/landing-pages.ts` ও backend validation দুই জায়গায় যোগ।
- বিদ্যমান `landing_page_visits` টেবিল অপরিবর্তিত (BSOL-এর নিজস্ব analytics) — tracking pipeline-এর সাথে মেশানো হবে না, দুটোর উদ্দেশ্য আলাদা।

### 8.6 T8a — per-seller সাবডোমেইন (`seller1.zyrotechbd.com/landingpage1`), সম্পূর্ণ স্বয়ংক্রিয়

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

#### 8.6.3 সাবডোমেইন নাম ব্যবস্থাপনা

- **Reserved blocklist:** `www`, `api`, `admin`, `app`, `mail`, `webmail`, `ftp`, `cpanel`, `ns1`, `ns2`, `bsol`, `staging`, `dev`, `autodiscover`, `_dmarc` ইত্যাদি — এবং ভবিষ্যতে যোগ হতে পারে এমন নাম।
- **Immutable:** বিজ্ঞাপন চালু হওয়ার পর সাবডোমেইন বদলানো যাবে না (§8.7 — কুকি ও `event_source_url` দুটোই হারায়)। UI-তে স্পষ্ট সতর্কতা, এবং বদলানোর অনুরোধ support-এর মাধ্যমে।
- **`landing_pages.slug` আজ globally unique** (verified: `$table->string('slug', 200)->unique()`)। সাবডোমেইন এলে দুই সেলারের একই slug (`/offer`) থাকা স্বাভাবিক দাবি হবে → `unique(user_id, slug)`-এ সরাতে হবে। কিন্তু পুরনো `/lp/{slug}` রুট global lookup-এর উপর দাঁড়িয়ে, যা চিরস্থায়ীভাবে কাজ করতে হবে। **সিদ্ধান্ত দরকার** (§11.9)।

#### 8.6.4 কৌশলগত প্রশ্ন — একই apex, নাকি আলাদা?

`*.zyrotechbd.com` ব্যবহার করলে খরচ শূন্য এবং কাজ কম। কিন্তু §8.2-এর সমস্যা ৪ থেকে যায়: কোনো সেলারের পেজ Meta বা Google Safe Browsing-এ ফ্ল্যাগ হলে parent domain-এর reputation প্রভাবিত হতে পারে — আর সেই একই apex-এ ড্যাশবোর্ড ও API। একটা **আলাদা apex** (বছরে ~$১০) এই ঝুঁকি সম্পূর্ণ আলাদা করে; কারিগরিভাবে দুটোই হুবহু একইভাবে কাজ করে (একই wildcard DNS + wildcard cert + regex block)। *সুপারিশ:* আলাদা apex, কারণ পার্থক্যটা নগণ্য খরচের কিন্তু ঝুঁকিটা প্ল্যাটফর্ম-ব্যাপী।

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

- **পুরনো `/lp/{slug}` URL চিরস্থায়ীভাবে কাজ করবে** — চালু বিজ্ঞাপন ওই লিংকে পয়েন্ট করা থাকে, ভাঙা যাবে না। কাস্টম ডোমেইন যোগ করা additive, প্রতিস্থাপন নয়।
- **ক্যাম্পেইন চলা অবস্থায় ডোমেইন বদলানো যাবে না** — `_fbp`/`_fbc` কুকি ডোমেইন পার হয় না, তাই ভিজিটর নতুন পরিচয় পাবে; `event_source_url` বদলে যাওয়ায় Meta-র কাছে এটা ভিন্ন ডোমেইন। সুপারিশ: **বিজ্ঞাপন চালুর আগেই ডোমেইন চূড়ান্ত করো**।
- `tracking_destinations.scope_type`-এ `landing_domain` মান যোগ হবে (§4.1-এর enum সম্প্রসারণ), যাতে একটা destination নির্দিষ্ট ডোমেইনে বাঁধা যায়।

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

| ফেজ | পরিধি | নির্ভরতা |
|---|---|---|
| **T1** | ডেটা মডেল (৩ টেবিল + package কলাম) + `TrackingQuotaService` + `TrackingIngestService` + admin package UI-তে লিমিট ফিল্ড | — |
| **T2** | `MetaCapiDriver` (batched) + `DispatchTrackingEventsJob` + retry/log + `SendFacebookCapiPurchaseEventJob`-কে নতুন পাইপলাইনে wrapper করা (behavior অপরিবর্তিত) | T1 |
| **T3** | Multi-destination: `facebook_pixel_settings` → `tracking_destinations` migration + backfill, dashboard CRUD UI, scope selector | T1 |
| **T4** | WordPress প্লাগইন `Bsol_Tracking` মডিউল — base code, browser JS, first-party REST endpoint, batch relay, funnel ইভেন্ট (plugin v1.17.0) | T2, T3 |
| **T5** | Order-flow ইভেন্ট — `OrderStatusService::transition()`-এ hook, Delivered/Returned/Confirmed, `orders` থেকে deterministic event_id | T2 |
| **T6** | Landing page ট্র্যাকিং (Next.js) + per-page toggle + `TrackingHostResolver` + **Basic tier** (শেয়ার্ড ডোমেইন, server-only, namespaced fbp/fbc — §8.2) | T2, T3 |
| **T7** | Dashboard: event log, quota মিটার, match-quality সারাংশ; fraud signal অর্ডার-ডিটেইলে প্রদর্শন | T2–T6 |
| **T8** | কাস্টম ডোমেইন (§8.3, §8.6) — `landing_domains` টেবিল, DNS/HTTP verification, catch-all nginx + wildcard/Certbot অটোমেশন, host→page রাউটিং, ওই ডোমেইনে **Full tier** চালু | T6 + `feature_roadmap_context.md` আইটেম ৬ |

### 10.1 কাস্টম ডোমেইন কি আগে বানাতে হবে? — না

**সিদ্ধান্ত: ট্র্যাকিং কাজ কাস্টম ডোমেইনের জন্য আটকে রাখা হবে না।** যুক্তি:

1. §1-এর মূল লিভার (`OrderDelivered`/`OrderConfirmed` → Meta) **সম্পূর্ণ server-side CAPI** — ডোমেইনের উপর এর কোনো নির্ভরতা নেই। শেয়ার্ড ডোমেইনেও ১০০% কাজ করে।
2. **কেস A (সেলারের নিজের WordPress সাইট) কাস্টম ডোমেইন ছাড়াই আজই Full tier** — সেখানে ব্রাউজার সেলারের নিজের ডোমেইনেই। T4 (প্লাগইন) কাস্টম-ডোমেইন কাজের উপর মোটেও নির্ভরশীল নয়, অথচ সবচেয়ে বেশি ট্র্যাফিক সম্ভবত এখান থেকেই আসবে।
3. কাস্টম ডোমেইন একটা **স্বতন্ত্র ops প্রকল্প** (catch-all nginx, DNS verification, per-domain Certbot issue + renewal মনিটরিং, ব্যর্থতার state machine) — ট্র্যাকিং-এর উপ-অংশ নয়। এটার জন্য অপেক্ষা করলে revenue-প্রাসঙ্গিক অংশটাই সপ্তাহ-খানেক পিছিয়ে যায়।
4. ট্র্যাকিং আগে করলে কাস্টম ডোমেইনের ডিজাইন **আরও ভালো হয়** — host-resolution-এ ঠিক কী কী hook লাগে তা তখন বাস্তব কোড থেকে জানা থাকবে, অনুমান করতে হবে না।

**একমাত্র বাস্তব ঝুঁকি:** যে সেলার শেয়ার্ড ডোমেইনে বিজ্ঞাপন চালিয়ে pixel learning জমাবে, পরে কাস্টম ডোমেইনে সরলে `_fbp`/`_fbc` ধারাবাহিকতা ও `event_source_url` দুটোই হারাবে (§8.7)। প্রশমন: `/lp/{slug}` চিরস্থায়ীভাবে চালু থাকবে, কেউ সরতে বাধ্য নয়; এবং যে সেলার কাস্টম ডোমেইন চায় সে অপেক্ষা করতে পারে। AEM/iOS-এর ক্ষতিও বাংলাদেশি ট্র্যাফিকে তুলনামূলক কম, কারণ অধিকাংশ ট্র্যাফিক Android।

**মাঝপথের সস্তা বিকল্প (বিবেচনার যোগ্য):** পূর্ণ কাস্টম-ডোমেইন ফিচারের ব্যয়বহুল অংশ হলো **সেলারের নিজের ডোমেইন** (per-seller DNS verification + per-domain Certbot + renewal মনিটরিং)। শুধু **আমাদের নিজস্ব apex-এ per-seller সাবডোমেইন** (`{slug}.bsolpages.com`) করলে সেটা মোট কাজের ছোট একটা ভগ্নাংশ — একটাই wildcard cert (DNS-01, per-seller কাজ শূন্য), catch-all nginx block, host→page রাউটিং; কোনো DNS verification বা per-domain cert লাগে না। এতে §8.2-এর সমস্যা ১ (`_fbc` দূষণ), ২ (`_fbp` শেয়ারিং) ও ৪ (রেপুটেশন — অ্যাপ ডোমেইন থেকে আলাদা) সমাধান হয়; সমস্যা ৩ (domain verification) হয় না (§11.7-এর উত্তরের উপর নির্ভরশীল)। **T8-কে দুই ভাগে ভাগ করা যায়: T8a = প্ল্যাটফর্ম সাবডোমেইন (সস্তা), T8b = সেলারের নিজের ডোমেইন (ব্যয়বহুল)।**

**যে ডিজাইন-শর্তটা এখনই মানতে হবে** (নাহলে T8 একটা rewrite হয়ে যাবে): T6-এ `TrackingHostResolver` **প্রথম দিন থেকেই host-ভিত্তিক** লিখতে হবে (§8.0), slug-ভিত্তিক শর্টকাট নয় — তাহলে পরে কাস্টম ডোমেইন যোগ করা নিছক একটা `landing_domains` row যোগ করার ব্যাপার, কোড পরিবর্তন নয়।

**প্রতি ফেজের বাধ্যতামূলক চেকলিস্ট** (প্রতিষ্ঠিত কনভেনশন): isolated Postgres schema-তে টেস্ট (create → `DB_SCHEMA=xxx php artisan test` → drop), ২টা পরিচিত pre-existing failure baseline (`AuthApiTest`, `CourierFraudCheckApiTest`) মিলিয়ে দেখা, `php artisan migrate --force` প্রোডাকশনে (এই checkout-ই প্রোডাকশন), frontend বদলালে `deploy-safe.sh`, প্লাগইন বদলালে `php -l` + hook/nonce/AJAX-action cross-check + `SETUP.md`-এ QA সেকশন, staff-role তিন-কেস verification (§6.2)।

---

## 11. উন্মুক্ত সিদ্ধান্ত (কাজ শুরুর আগে ঠিক করতে হবে)

1. **Fan-out মডেল:** এক ইভেন্ট, একাধিক destination — `tracking_events`-এ প্রতি destination-এ আলাদা row, নাকি একটা row + `results` JSON? আলাদা row = পরিষ্কার status ট্র্যাকিং কিন্তু টেবিল n গুণ বড়। *প্রাথমিক ঝোঁক:* একটা row + per-destination result JSON, কারণ quota-ও ingest-ভিত্তিক (§5.1) — দুটো সামঞ্জস্যপূর্ণ থাকে।
2. **Quota-তে কি P0 overage গোনা হবে?** গোনা হলে সেলার লিমিট ছাড়িয়ে যাওয়া দেখবে অথচ কিছু বন্ধ হয়নি — বিভ্রান্তিকর। *প্রাথমিক ঝোঁক:* আলাদা `overage_count` কলামে দেখানো, মূল কাউন্টারে আলাদা।
3. **`OrderDelivered`-এর `value` কী হবে** — অর্ডারের মোট, নাকি ডেলিভারি চার্জ বাদে? Meta ROAS হিসাব এর উপর নির্ভর করে। *প্রাথমিক ঝোঁক:* পণ্যের মূল্য (shipping বাদে), কারণ ROAS-এ shipping revenue নয়।
4. **Landing page pixel id public payload-এ** — pixel id গোপন নয় (browser-এ যেভাবেই হোক দেখা যায়), কিন্তু কোন সেলারের কোন pixel সেটা enumerate করা যাবে কিনা তা ঠিক করতে হবে (host/slug-স্কোপড রেসপন্স, তালিকা নয়)।
5. **Consent ডিফল্ট** — বাংলাদেশে কুকি-কনসেন্ট আইনি বাধ্যবাধকতা নয়; ডিফল্ট `off` রাখা হবে, তবে টগল থাকবে। আন্তর্জাতিক ট্রাফিকওয়ালা সেলারের জন্য চালু করার সুপারিশ ডকুমেন্টে থাকবে।
6. **শেয়ার্ড ডোমেইনে browser Pixel চালানো হবে কি না** (§8.2) — সুপারিশ "না, শুধু CAPI" (Basic tier)। বিকল্প: চালানো, শেয়ার্ড `_fbp` মেনে নিয়ে শুধু `_fbc` namespaced। **এটাই এই ডকের সবচেয়ে বড় product সিদ্ধান্ত** — Full/Basic টিয়ারিং ও custom-domain upsell পুরোটাই এর উপর দাঁড়িয়ে।
7. **Meta domain verification সাবডোমেইনে কীভাবে কাজ করে** (§8.3 C2) — apex (`bsolpages.com`) আমরা verify করলে সেলার নিজের Business Manager থেকে `zareen.bsolpages.com` আলাদাভাবে verify করতে পারবে কি না। **Business Manager-এ বাস্তবে পরীক্ষা করে নিশ্চিত হতে হবে**, ডকুমেন্টেশন থেকে অনুমান করে ডিজাইন করা যাবে না — উত্তরটা C2-র tier (Full না Basic) নির্ধারণ করে।
8. **কাস্টম ডোমেইনে DNS পদ্ধতি** — CNAME (সহজ, apex-এ কাজ করে না) বনাম A রেকর্ড (apex-এ চলে, সার্ভার IP বদলালে সব সেলারকে বদলাতে হয়)। *প্রাথমিক ঝোঁক:* সাবডোমেইনে CNAME বাধ্যতামূলক করা (`lp.sellershop.com`), apex সাপোর্ট না দেওয়া।
9. **`landing_pages.slug` global unique থাকবে না per-seller হবে?** (§8.6.3) — সাবডোমেইন এলে দুই সেলারের একই slug থাকা স্বাভাবিক দাবি, কিন্তু পুরনো `/lp/{slug}` রুট global lookup-এর উপর দাঁড়িয়ে এবং চিরস্থায়ীভাবে কাজ করতে হবে। *প্রাথমিক ঝোঁক:* বিদ্যমান slug গুলো grandfathered রেখে `unique(user_id, slug)`-এ সরানো, আর `/lp/{slug}`-কে একটা আলাদা global alias টেবিল/কলাম দিয়ে resolve করা — যাতে নতুন সেলাররা slug সংঘাতে না পড়ে অথচ চালু বিজ্ঞাপন না ভাঙে।
10. **DNS Cloudflare-এ সরানো হবে কি না** (§8.6.1) — wildcard cert স্বয়ংক্রিয় নবায়নের একমাত্র বাস্তব পথ। না সরালে per-subdomain HTTP-01, যার সীমা সপ্তাহে ~৫০ সেলার।
11. **সাবডোমেইনের জন্য একই apex (`zyrotechbd.com`) নাকি আলাদা apex** (§8.6.4) — *সুপারিশ:* আলাদা, reputation আলাদা রাখতে।

---

## 12. যা এই রাউন্ডে **নয়** (স্পষ্টভাবে scope-এর বাইরে)

- TikTok / GA4 / Snap destination (স্কিমা প্রস্তুত থাকবে, ড্রাইভার নয়)।
- Facebook Lead Ads (`leadgen` webhook) — আলাদা ফিচার, `facebook_integration_context.md §6` item 3।
- Meta Ads Manager থেকে spend/ROAS টেনে আনা (Ads Insights API, `ads_read` permission + নতুন App Review রাউন্ড লাগে)।
- Server-side GTM / নিজস্ব tag manager।
- A/B টেস্টিং বা attribution modeling।
