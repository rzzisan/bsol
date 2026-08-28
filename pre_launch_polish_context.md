# প্রি-লঞ্চ ঘষামাজা (Polish Pass) — মডিউল-ভিত্তিক ওয়ার্ক ব্রেকডাউন

Last updated: 2026-08-27 — নতুন ফাইল তৈরি। উদ্দেশ্য: প্রোডাকশনে (mass-launch) যাওয়ার আগে ফিচার-বাগ, নিরাপত্তা, ডিজাইন/UI-UX, এবং ফ্রন্টএন্ড উন্নতির জন্য একটা মডিউল-ভিত্তিক checklist, যাতে বড় কোডবেসে এক এক করে কাজ শুরু করা যায়।

> **এই ফাইল কী, কী না:** এটা নতুন ফিচার রোডম্যাপ না (সেটা `feature_roadmap_context.md`) এবং live ground-truth audit-ও না (সেটা `SAAS_MODULE_CONTEXT.md` §15-১৭)। এটা ওই দুটো + `production_audit_report_context.md` থেকে **এখনো-open থাকা সব ছোট-বড় polish আইটেম** এক জায়গায় মডিউল-বাই-মডিউল সংগ্রহ করে + নতুন UI/UX অডিট-চেকলিস্ট যোগ করে বানানো একটা **কাজ শুরু করার ক্রম-তালিকা**। কাজ শুরু করার সময় প্রতিটা আইটেমের link করা source file-এ গিয়ে detail verify করে নাও — কোড read না করে fix করা যাবে না।

**বাধ্যতামূলক ক্রস-রেফারেন্স (কাজ শুরুর আগে):**
- `CONTEXT.md` §৩১ (Staff/Team role) ও §৩২ (per-seller subdomain) — যেকোনো fix/UI change এই দুইটার সাথে সাংঘর্ষিক না হয় তা নিশ্চিত করা
- `CONTEXT.md` §22 (design consistency policy) — UI/UX fix করার সময় design token/layout continuity বজায় রাখা
- `staff_team_role_context.md`, `custom_domain_context.md` — নতুন কোনো scope change করলে Pattern A/B ও subdomain-awareness যাচাই

---

## কীভাবে ব্যবহার করবে

1. নিচের মডিউল-লিস্ট থেকে একটা মডিউল বেছে নাও (প্রস্তাবিত ক্রম নিচে "কাজ শুরুর ক্রম" সেকশনে)।
2. সেই মডিউলের "Open items" চেকলিস্ট + লিংক করা source file পড়ো।
3. প্রতিটা আইটেমের real code verify করো (line number বদলে যেতে পারে, প্রথমে grep/read করো)।
4. Fix/improve করার পর — এই ফাইলে সেই লাইন ✅-এ বদলাও + `feature_roadmap_context.md`/`SAAS_MODULE_CONTEXT.md`-এর প্রাসঙ্গিক entry-ও sync করো (§৮ ডকুমেন্টেশন নিয়ম, `production_audit_report_context.md §৮`)।
5. প্রতিটা "UI/UX অডিট" আইটেম মানে এখনো কেউ real browser দিয়ে ঘুরে দেখেনি — এইগুলো actual verification (bn/en + light/dark + mobile) দাবি করে, শুধু কোড পড়ে সন্তুষ্ট হওয়া যাবে না (`CONTEXT.md` §22 checklist অনুযায়ী)।

---

## ক. Core Commerce (Order / Product / Customer) — ✅ backend আইটেম সম্পন্ন (2026-08-28)

**সোর্স:** `SAAS_MODULE_CONTEXT.md` §15.1, §17.1

**Feature bug (backend):**
- ✅ **`OrderController::store()` variant ownership bypass ফিক্স** — variant lookup query এখন `whereHas('product', fn($q) => $q->whereIn('user_id', $shopUserIds))` দিয়ে scoped, `product_id` পাঠানো হোক বা না হোক। ৪টা টেস্ট (`OrderStoreVariantScopingTest`)
- ✅ **Stock check TOCTOU — verify করা হয়েছে, ইতিমধ্যেই নিরাপদ, ফিক্স লাগেনি।** Creation-time check শুধু advisory/UX; আসল authoritative guard `OrderStatusService::transition()`-এ atomic `WHERE stock_qty >= quantity` (§17.9 fix #8, এখনো আছে) — দুটো concurrent order create পাস করলেও পরে confirm করার সময় দ্বিতীয়টা atomically reject হয়, oversell সম্ভব না
- ✅ **`Order::generateOrderNumber()` race ফিক্স** — `OrderController::store()`-এ retry wrapper, `UniqueConstraintViolationException` (শুধু `orders_user_id_order_number_unique`) ধরে ৩ বার পর্যন্ত পুনরায় নম্বর জেনারেট করে। ৩টা টেস্ট (`OrderNumberRaceRetryTest`)

**Hardening/cleanup:**
- ✅ **Product variant SKU uniqueness এখন per-shop scoped** — migration `2026_08_28_110000_scope_product_variant_sku_unique_per_shop`: নতুন denormalized `product_variants.user_id` কলাম (products থেকে backfilled) + partial unique index (soft-delete-aware, users.email-এর ২০২৬-০৮-১৫ ফিক্সের মতোই pattern)। `ProductVariantController`-এর ২টা create-site + validation rule + bulk-generate-এর collision-check সব আপডেট। ৪টা টেস্ট + `ConnectProductSyncTest`-এর পুরনো test আপডেট (cross-seller SKU sync এখন সফল হয়, আগে warning দিত)
- ✅ **`Customer::orders()` dead-code cleanup** — `CustomerController::show()` এখন সেই relation ব্যবহার করে duplicate query লেখার বদলে। ৩টা টেস্ট (`CustomerShowOrdersTest`, staff cross-visibility-সহ)
- ✅ **`CustomerController::syncAll()` chunking ফিক্স** — পুরো shop-এর order মেমোরিতে লোড করার বদলে `chunk(500)` + শুধু দরকারি কলাম select + ছোট phone-set দিয়ে dedupe। ২টা টেস্ট (৫০১-রো chunk-boundary টেস্টসহ)

**সব ১৬+টা নতুন টেস্ট + পুরো backend suite (৬৩৮ টেস্ট) আগে-পরে diff করে ০ regression — একটা genuine self-regression ধরা পড়েছিল মাঝপথে (SKU migration-এর NOT NULL constraint ৩টা পুরনো টেস্ট ফিক্সচার ভেঙেছিল + ConnectProductSyncTest-এর একটা test পুরনো global-uniqueness আচরণ assert করছিল) — সবগুলো ধরে ফিক্স করা হয়েছে, চূড়ান্ত রান-এ বেসলাইনের ৮০টা ছাড়া ০ ব্যর্থতা।**

**UI/UX অডিট:**
- ✅ Order status badge/color consistency — থ-সেকশনে ইতিমধ্যে cross-check করা হয়েছে (দেখো §থ ব্যাচ ৩), মূলত consistent পাওয়া গেছে
- ☐ Order list/detail, Product list/detail, Customer list/detail — bn/en টেক্সট length change-এ layout না ভাঙে তা mobile+tablet-এ verify করা (real browser লাগবে, এখনো করা হয়নি)
- ☐ Variant picker/table UI large variant-count-এ (২০+ combination) usability check (real browser লাগবে, এখনো করা হয়নি)

---

## খ. Fraud & Risk — ✅ সম্পন্ন (2026-08-28)

**সোর্স:** §15.2, §17.2

- ✅ **Global blacklist propagation hardening।** পুরোপুরি বন্ধ করা হয়নি (dispute-flow বানানো হয়নি — কোনো customer-facing পোর্টালই নেই এই প্ল্যাটফর্মে, তাই বড় স্কোপ), কিন্তু ২টা কাজের জিনিস যোগ হয়েছে: (১) `/fraud/blacklist` POST route-এ `throttle:20,1` — একটা একাউন্ট থেকে মুহূর্তে অনেক ফোন blacklist করে shared signal mass-poison করা এখন কঠিন, (২) নতুন **admin-facing platform-wide blacklist oversight view** (`GET /api/admin/global-blacklist`, `/admin/global-blacklist` পেজ) — কে কোন ফোন কেন ব্লক করেছে + কতজন ভিন্ন seller একই ফোন ব্লক করেছে (corroboration signal, একজনের অভিযোগ vs একাধিক sellerর) admin এখন এক পেজে দেখে investigate করতে পারবে। ৫টা টেস্ট (`FraudHardeningTest`)
- ✅ **Paperfly fraud-check heuristic — যাচাই করা হয়েছে, ইতিমধ্যেই ফিক্সড, স্টেল ছিল এই আইটেম।** `PaperflyFraudCheckService` (২০২৬-০৮-০৫-এর নিজস্ব কমেন্ট অনুযায়ী reverse-engineered rewrite) এখন structured JSON field পড়ে (`total`/`delivered`/`returned`/`partial`/`smart_check.delivery_rate`), কোনো `str_contains` string-heuristic নেই। বাকি ৪টা courier fraud-check service (Steadfast/Pathao/RedX/Carrybee)-ও চেক করা হয়েছে, সবগুলো clean HTTP status code/JSON ব্যবহার করে
- ✅ **`/fraud/courier-check` route-এ `throttle:30,1` যোগ করা হয়েছে** — আগে unthrottled ছিল, real external courier API call ট্রিগার করতে পারত cache-miss হলে

**UI/UX:**
- ✅ **Risk-level রং/ব্যাজ consistency যাচাই করা হয়েছে — consistent পাওয়া গেছে।** Fraud-check, `customers/risky`, ও `orders` লিস্ট — তিনটাই low→emerald, medium→yellow, high→red একই semantic pattern মেনে চলে (opacity সামান্য ভিন্ন `/10` vs `/15`, চোখে পড়ে না, ফিক্স করার মতো real issue না)

---

## গ. Courier Integration — ✅ মূল আইটেম সম্পন্ন (2026-08-28)

**সোর্স:** §15.3, §17.3, §17.8 item 9, `courier_status_sync_context.md`, `courier_waybill_context.md`

- ✅ **(2026-08-28) Pathao token-fetch unification** — `PathaoLocationService` নিজের ডাইভার্জড token flow (ভুল endpoint `/external/login`, client_id/secret-কে username/password হিসেবে পাঠাত — কখনো documented Pathao API-ই ছিল না, শুধু `pathao_locations` cache আগে থেকে populated থাকলেই "কাজ করত") বাদ দিয়ে এখন `PathaoService::getToken()`-এর উপর delegate করে — একটাই সোর্স অফ ট্রুথ। সাথে `PathaoService::hasCredentials()`-এর নিজস্ব বাগও ফিক্স হয়েছে (username/password ছাড়া শুধু still-valid cached token থাকলেও "usable" গণ্য করে না — যেটা `getToken()` আসলে serve করতে পারে তার সাথে সামঞ্জস্যহীন ছিল)। ৭টা নতুন টেস্ট (`CourierTestConnectionTest.php`)
- ✅ **(2026-08-28) RedX/Carrybee test-connection endpoint যোগ** — `POST /courier/settings/test-redx` (pickup-stores probe), `POST /courier/settings/test-carrybee` (stores probe), Pathao-র প্যাটার্ন অনুসরণ করে। কুরিয়ার সেটিং পেজে প্রতিটার নিজস্ব "Test" বাটন
- ✅ **(2026-08-28) Retry/backoff যোগ হয়েছে সব প্রোভাইডারে, কিন্তু শুধু read-only lookup-এ** — Pathao/RedX/CarryBee/Paperfly/Steadfast, `->retry(2, 300, connectionFailureOnly, throw: false)`। **ইচ্ছাকৃতভাবে বাদ**: createOrder/createStore/createBulkOrders/cancelOrder-জাতীয় non-idempotent কল — একটা network blip-এ response হারালে retry করলে বাস্তবে ডুপ্লিকেট পার্সেল বুক হয়ে যাওয়ার ঝুঁকি আছে। শেয়ার্ড policy `App\Services\Courier\Concerns\CourierHttpRetry` ট্রেইটে
- ✅ **(2026-08-28) Carrybee bulk-booking যোগ** — `CarrybeeCourierProvider::book()` এখন `delivery_city_id`/`zone_id` না দেওয়া থাকলে অর্ডারের নিজের `customer_address` থেকে অটো-রিজলভ করে (CarryBee-র নিজের top area-suggestion বিশ্বাস করে, ঠিক যেমন WooCommerce/connect বুকিং পাথ আগে থেকেই করে) — এতে বাল্ক মোডালে কোনো per-order area-search UI ছাড়াই বাল্ক বুকিং কাজ করে। `bookBulk` validation-এ `carrybee` যোগ, ফ্রন্টএন্ড বাল্ক-মোডাল ড্রপডাউনে CarryBee + Paperfly যোগ (RedX বাদ রাখা হয়েছে ইচ্ছাকৃতভাবে — ওটার বুকিং এখনো pre-resolved `redx_area_id` কলামের উপর নির্ভর করে, যেটা বাল্ক-এ সেট করার কোনো UI নেই)। ৩টা নতুন টেস্ট (`CourierBulkBookingTest.php`) + `CarrybeeBookingApiTest.php`-এ ৩টা টেস্ট আপডেট/যোগ
- ✅ **(2026-08-28) স্টেল আইটেম যাচাই করে বাতিল করা হয়েছে (কোনো কোড পরিবর্তন লাগেনি):**
  - "Paperfly schema আছে কিন্তু service/route নেই" — ভুল, `PaperflyService`+`PaperflyCourierProvider` সম্পূর্ণ আছে এবং `CourierFactory`-র মাধ্যমে generic `/courier/book/{order}`, `/track/{order}`, `/cancel/{order}`, `bookBulk` সব এন্ডপয়েন্টে already wired — কোনো Paperfly-specific route দরকারই নেই
  - "Carrybee/Paperfly-র জন্য tracking-refresh UI নেই" — ভুল, `/dashboard/courier/track` পেজের রিফ্রেশ বাটন ৫টা কুরিয়ারের (steadfast/pathao/redx/carrybee/paperfly) জন্যই already রেন্ডার হয়, generic `/courier/track/{order}` এন্ডপয়েন্ট ব্যবহার করে

- ✅ **(2026-08-28) RedX delivery-charge preview যোগ (Pathao-র সাথে parity)** — `/courier/redx/charge` endpoint আগে থেকেই ছিল কিন্তু ফ্রন্টএন্ডের কোথাও call হতো না (RedX API doc §"Calculate Parcel Charge" অনুযায়ী রেসপন্স `{deliveryCharge, codCharge}`, কোনো ETA ফিল্ড নেই)। এখন RedX বুকিং ফর্মে area+pickup store বাছাই হলে Pathao-র মতোই "ডেলিভারি চার্জ হিসাব" বাটন দেখায়। ২টা নতুন ব্যাকএন্ড টেস্ট

**যাচাই করে চূড়ান্ত সিদ্ধান্ত (আলাদা, বড় স্কোপ ফিচার — এই ব্যাচে করা হয়নি):**
- ☐ **Multi-courier rate/ETA compare UI** (পাশাপাশি ২+ courier-এর quote একসাথে) — সত্যিই তৈরি করিনি এই ব্যাচে, কারণ যাচাইয়ে দেখা গেছে বাস্তব ডেটা-সীমাবদ্ধতা আছে: (১) কোনো courier-এর quote API-ই **ETA** রিটার্ন করে না (Pathao price-plan, RedX charge_calculator — দুটোই শুধু fee, কোনো delivery-time ফিল্ড নেই), (২) CarryBee-র কোনো pre-booking quote API-ই নেই (delivery_fee শুধু আসল বুকিং-এর পরে জানা যায়), (৩) Pathao (city/zone) আর RedX (pickup+delivery area) সম্পূর্ণ আলাদা location taxonomy ব্যবহার করে — তাই একই ঠিকানার জন্য দুটোর quote পাশাপাশি আনতে সেলারকে দুই সেটের location-ই আলাদা করে resolve করতে হবে, শুধু preview-এর জন্য যেটা বড় UX ওভারহেড। এই ব্যাচে বরং RedX-এর একক-provider preview parity fix (উপরে) দিয়ে বাস্তবসম্মত অংশটা কভার করা হয়েছে। "Compare" UI সত্যিই দরকার হলে আলাদা, স্কোপড ফিচার হিসেবে করা উচিত
- ☐ ৪-৫টা courier provider settings ফর্ম UI consistency — লেবেল/স্টাইল স্পট-চেক করে সামঞ্জস্যপূর্ণ পাওয়া গেছে। validation-message বাংলা/ইংরেজি নিয়ে একটা systemic issue পাওয়া গেছে (backend `$request->validate()` সবসময় ইংরেজি Laravel default message রিটার্ন করে, seller-এর locale যেটাই হোক) — কিন্তু `saveSettings()`-এর সব ফিল্ড `nullable` হওয়ায় বাস্তবে এই এন্ডপয়েন্টে validation-error trigger হওয়ার সুযোগ কম। এটা এই একটা মডিউলের সমস্যা না — পুরো প্রজেক্টের যেকোনো ফর্মেই প্রযোজ্য, তাই cross-cutting i18n প্রজেক্ট হিসেবে আলাদাভাবে স্কোপ করা উচিত (থ মডিউলের আওতায়), গ-তে piecemeal ফিক্স করা হয়নি

---

## ঘ. Landing Page / Checkout / Abandoned Checkout — ✅ সম্পন্ন (2026-08-28)

**সোর্স:** §15.4, §17.4, `landing_page_context.md`

- ✅ **স্টেল প্রমাণিত (কোনো কোড পরিবর্তন লাগেনি):** `LandingPageAnalyticsController::linkVisitToOrder`-এর `order_id`/`visit_id` স্কোপিং সমস্যা — চেক করে দেখা গেছে আগেই ফিক্সড (কমিট `36fab21`, এই পোলিশ পাস শুরুর আগেই)। `Rule::exists(...)->where('user_id', ...)` এবং `->where('landing_page_id', ...)` দিয়ে ঠিকভাবে scoped। যেহেতু কোনো টেস্ট ছিল না, নতুন `LandingPageAnalyticsLinkVisitTest.php` (৪টা টেস্ট) দিয়ে lock-in করা হয়েছে

**UI/UX অডিট:**
- ✅ **Landing page builder editor — element library bn/en + dark/light যাচাই।** `BLOCK_LABELS` (১২টা block type) সব bn/en-এ সম্পূর্ণ, `block-fields.tsx`/builder-এ কোনো hardcoded light-only color পাওয়া যায়নি (সব `var(--...)` টোকেন ব্যবহার করে) — কোনো ফিক্স লাগেনি
- ✅ **(2026-08-28) Public checkout ফর্ম — slow-connection error handling ফিক্স + বড় bn/en gap আবিষ্কার+ফিক্স।** `public-landing-page-view.tsx`-এ দুটো সমস্যা পাওয়া গেছে:
  1. Network failure (fetch নিজেই fail করলে, slow/dropped mobile connection-এ)-এ raw browser error text (যেমন "Failed to fetch") সরাসরি কাস্টমারকে দেখানো হতো, bn/en কোনোটাতেই translated ছিল না — এখন `err instanceof TypeError` চেক করে আলাদা, translated network-error message দেখায়
  2. পুরো Payment Method + Order Summary সেকশন (COD/wallet/gateway পেমেন্ট অপশন, "Original Price"/"Product Discount"/"Shipping"/"TOTAL", privacy notice, "Place Order" বাটন) **সম্পূর্ণ hardcoded ইংরেজি ছিল** — pageLanguage বাংলা হলেও কখনো বাংলায় দেখাত না (পেমেন্ট-গেটওয়ে ফিচার যোগের সময় বাকি পেজের i18n discipline অনুসরণ করা হয়নি)। এখন ১৪টা নতুন bn/en key দিয়ে পুরো সেকশন localized
- ✅ **(2026-08-28) Abandoned checkout resume-link flow — কোড-লেভেল ট্রেস করে verify করা হয়েছে।** `AbandonedCheckoutService::resume()` সঠিকভাবে `landing_page_id`-তে scoped (cross-seller resume সম্ভব না), dashboard-এর কপি-লিংক ফ্লো সেলারের নিজস্ব subdomain (`public_url`) থেকে link বানায় সঠিক null-check সহ, failed resume silently graceful fallback করে। **লাইভ প্রোডাকশন ডেটায় সরাসরি ব্রাউজার click-through করা হয়নি** — real customer PII/DB row তৈরি/পরিবর্তনের ঝুঁকি এড়াতে ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে; কোড-লেভেল যাচাই যথেষ্ট নির্ভরযোগ্য মনে হয়েছে (existing `test_a_converted_row_is_not_resurrected_by_a_stale_capture`-সহ প্রাসঙ্গিক টেস্ট আগে থেকেই আছে)

---

## ঙ. Seller Storefront (ফুল ইকমার্স শপ) — 🟡 মূল আইটেম সম্পন্ন (2026-08-28)

**সোর্স:** `seller_storefront_context.md` §২৪-২৫, feature_roadmap আইটেম #৯

- ✅ **স্টেল প্রমাণিত (2026-08-28 যাচাই, কোনো কোড পরিবর্তন লাগেনি)** — `seller_storefront_context.md §২৫` নিজেই ইতিমধ্যে "✅ লাইভ" মার্ক করা (২০২৬-০৮-২২), migration+টেস্ট+লাইভ ব্রাউজার ভেরিফাই (zareen.zyrotechbd.com) সহ। এই পোলিশ ডকের "unconfirmed status" নোটটাই স্টেল ছিল। কোড-লেভেলে re-confirm করা হয়েছে: `StorefrontSettingController`-এ `nav_bg_color`/`nav_text_color` ভ্যালিডেশন এখনো আছে

**UI/UX অডিট:**
- ✅ **(2026-08-28) বড় ক্যাটালগ pagination — ২টা real bug পাওয়া গেছে ও ফিক্স করা হয়েছে:**
  1. **`/search` পেজ (main "browse all products" এন্ট্রি পয়েন্ট)-এ pagination UI-ই ছিল না** — `fetchProductsClient()`-কে কখনো `page` param পাঠানো হতো না, তাই ২০টার বেশি (default per_page) প্রোডাক্ট থাকা যেকোনো শপে কাস্টমার প্রথম পেজের পরের প্রোডাক্ট **কখনোই দেখতে পেত না** — শুধু cosmetic না, real সাইট-ব্রাউজ ক্যাপাবিলিটি বন্ধ ছিল। এখন page state + windowed pagination control যোগ হয়েছে
  2. **`/category/{slug}` পেজে প্রতিটা পেজ নম্বর আলাদা লিংক হিসেবে রেন্ডার হতো, কোনো windowing/ellipsis ছাড়া** — ১০০+ প্রোডাক্ট স্কেলে last_page বড় হলে (৫০+) এক সারিতে ৫০টা বাটন, কোনো wrap/scroll হ্যান্ডলিং ছাড়া, মোবাইলে overflow হতো। নতুন শেয়ার্ড `paginationRange()` হেল্পার (first/last/current±1 + "…") দুটো পেজেই ব্যবহার করে ফিক্স, সাথে `overflow-x-auto` defensive
  - হোমপেজ (banner/featured-category/product grid)-এর কোয়েরি নিজেই ক্যাপড (featured ≤১২, per-category ≤১০) — ক্যাটালগ সাইজ নির্বিশেষে লোড-টাইম স্থির, ফিক্স লাগেনি
- ✅ **Review/rating UI — spam/empty-state ইতিমধ্যে ঠিকভাবে হ্যান্ডলড, verify করা হয়েছে।** `is_approved` default false (মডারেশন গেট, ordering কোনো প্রি-রিকোয়ারমেন্ট ছাড়াই ওপেন সাবমিশন হওয়া সত্ত্বেও spam সরাসরি পাবলিক হয় না) + `throttle:10,1` রেট-লিমিট + client-এ submit-button disabled during submit + empty-state ("এখনো কোনো রিভিউ নেই।") — সব আগে থেকেই সঠিক। একটা ছোট bn/en অসঙ্গতি পাওয়া গেছে (`{count} reviews` — বাকি পুরো প্যানেল বাংলা-only অথচ এই একটা শব্দ ইংরেজি ছিল) — ফিক্স করা হয়েছে
- ☐ **Standard ও CareSolution মোবাইল bottom-nav/drawer/checkout flow** — কোড-লেভেলে cart badge (`useCart()` context + localStorage, রিঅ্যাক্টিভ) এবং floating-cart-button রিভিউ করে কোনো স্ট্রাকচারাল সমস্যা পাওয়া যায়নি, কিন্তু **আসল ব্রাউজারে ফ্রেশ-চোখে click-through করা হয়নি** — ফ্রন্টএন্ডে কোনো টেস্ট ইনফ্রা নেই এই প্রজেক্টে, আর লাইভ প্রোডাকশন সেলার সেশনে টেস্ট ডেটা দিয়ে interact করাটা ইচ্ছাকৃতভাবে এড়ানো হয়েছে (real customer-facing state touch করার ঝুঁকি)। ভবিষ্যতে সত্যিকারের ব্রাউজার-QA পাস দরকার হলে এখানেই বাকি

---

## চ. Communication (SMS / Email / WhatsApp / Notification) — 🟡 মূল আইটেম সম্পন্ন (2026-08-28)

**সোর্স:** §15.5, §17.5, `whatsapp_context.md`, `zyro_sms.md`

- ✅ **স্টেল প্রমাণিত (কোনো কোড পরিবর্তন লাগেনি):** শুধু `khudebarta` provider সাপোর্টেড — ইতিমধ্যেই প্রতিটা লেয়ারে honest: `GatewayProvider` TS টাইপ + dropdown-এ শুধু Khudebarta option, ব্যাকএন্ডের create/update দুটোতেই `Rule::in(['khudebarta'])` ভ্যালিডেশন। Schema-র string কলামটা শুধু ভবিষ্যতের জন্য flexible রাখা, এখন কোনো bypass path নেই
- ✅ **(2026-08-28) `payment_due`/`failed_delivery_retry` dead trigger অপশন সরানো হয়েছে** — `SmsAutomationRule::TRIGGER_EVENTS`, ফ্রন্টএন্ড dropdown, উভয় জায়গা থেকে। কোনো কোড পাথ কখনো এই দুটো fire করত না (verify: প্রোডাকশনে ০টা rule এগুলো ব্যবহার করছিল)। WhatsApp-এর সমতুল্য `WhatsappAutomationRule::TRIGGER_EVENTS` (পরে বানানো ফিচার) আগে থেকেই এই দুটো বাদ দিয়ে বানানো ছিল — সেই প্যাটার্নের সাথে align করা হলো
- ✅ **(2026-08-28) Delayed SMS orphaned "queued" row — verify করা হয়েছে, ইতিমধ্যে ফিক্সড।** `SendAutomationSmsJob::failed()` হুক (কমিট `e0f7ea6`, এই পোলিশ সেশনের আগেই) retry-exhaustion-এ 'queued' রো-কে 'failed'-এ ফাইনালাইজ করে। লাইভ প্রোডাকশন ডেটা যাচাই: **০টা stuck queued row** (কোনো বয়সেই), queue worker (`hybrid-queue-worker.service`) healthy/running। পুরো ফিচারের জন্য কোনো টেস্ট ছিল না — নতুন `SmsAutomationTest.php` (৯টা) দিয়ে lock-in করা হয়েছে, orphan-guard regression টেস্টসহ
- ☐ **WhatsApp (§পজড, external blocker) — অপরিবর্তিত।** Meta Business Verification প্রতি সেলারকে নিজে করতে হয়, এই dev environment থেকে automate/query করার কোনো উপায় নেই (Meta Graph API-র নিজস্ব Business Verification status endpoint আলাদা, বানানো হয়নি — এখন কোনো সেলার WhatsApp connect করেনি বলে এটার জন্য কোনো ROI নেই এই মুহূর্তে)। Manual periodic check হিসেবেই থেকে যাচ্ছে
- ☐ **Marketing broadcast — অপরিবর্তিত, এখনো শুরু হয়নি।** feature_roadmap #৭/P6-এ যথাযথভাবে scoped আছে, এই পোলিশ পাসের স্কোপ না (নতুন ফিচার, পলিশ না)

**UI/UX অডিট:**
- ✅ **(2026-08-28) SMS template editor-এ WYSIWYG preview যোগ করা হয়েছে** — যাচাই করে দেখা গেছে placeholder chip ক্লিক করলে শুধু literal `{customer_name}` টেক্সট বসত, কোনো rendered preview ছিল না (Admin-এর নিজস্ব Notification Template editor-এ আগে থেকেই preview আছে, কিন্তু seller-facing SMS automation-এ ছিল না)। এখন `SmsAutomationService::renderTemplate()`-এর ঠিক same substitution map ব্যবহার করে ক্লায়েন্ট-সাইড sample-data preview প্যানেল (নতুন backend এন্ডপয়েন্ট লাগেনি, static sample value যথেষ্ট)

---

## ছ. Accounting + Subscription/Billing — ✅ মূল আইটেম সম্পন্ন (2026-08-28)

**সোর্স:** §15.6, §15.8, §17.6, §18, `subscription_billing_context.md`

- ✅ **(2026-08-28) Auto-ledger dedup race ফিক্স** — `transactions_dedup_unique` DB constraint যোগ + `AccountingService::upsertTransaction()` (race হলে update-এ fallback করে, throw করে না)। বিস্তারিত `security_hardening_context.md §৬.১`, ৬টা টেস্ট
- ✅ **(2026-08-28) `OrderController::destroy` orphaned ledger row ফিক্স** — নতুন `AccountingService::onOrderDeleted()`, income entry cleanup করে (expense রেখে দেয়, cancelled/returned-এর মতোই)। `security_hardening_context.md §৬.২`
- ✅ **(2026-08-28) Expired subscription COD confirm — product decision নেওয়া হয়েছে (exempt করা হয়েছে)।** user-কে জিজ্ঞেস করা হয়েছিল, সরাসরি উত্তর না পাওয়ায় recommended অপশনে এগোনো হয়েছে: delivered/returned/cancelled status transition এখন subscription hard-paywall থেকে exempt, বাকি সব order action ব্লকড থাকে। `EnsureActiveSubscription:allow_delivery_confirmation` মোড। **ভুল মনে হলে সহজে reversible** — বিস্তারিত ও revert-নির্দেশনা `security_hardening_context.md §৬.৩`, ৬টা টেস্ট
- ✅ **(2026-08-28) No-default-package footgun ফিক্স** — admin dashboard homepage-এ + package পেজে ⚠️ warning banner (`config_warnings.no_default_package`), লাইভ ডেটায় verify করা হয়েছে (এখন actually false — প্যাকেজ সেট করা আছে)
- 🟡 **P2 (payment gateway sandbox verify) — EPS ✅ সম্পন্ন (২০২৬-০৮-১৯), Nagad Merchant ⬜ এখনো বাকি (external — real merchant sandbox account দরকার):** ২০২৬-০৮-২৮-এ ধরা পড়েছে `feature_roadmap_context.md`/`production_audit_report_context.md §৭` দুটোতেই এই আইটেম ভুলভাবে "Not started" দেখাচ্ছিল যদিও EPS আসলে অনেক আগেই live sandbox test + bug fix হয়ে গেছে — এখন sync হয়েছে। Nagad-এর `verifyPayment()`-এ success-path logging হার্ডেনিং যোগ হয়েছে (real test-এর বিকল্প না) — বিস্তারিত `online_payment_context.md §৯.১, §১১`, `security_hardening_context.md`

**UI/UX অডিট:**
- ☐ Subscription/billing পেজ — প্যাকেজ ফিচার-লিস্ট (recent `max_staff`/`features` wiring commit-এর পর) UI-তে সঠিকভাবে reflect করছে কিনা end-to-end verify
- ☐ Collection History + Invoice payment-table — bn/en টেক্সট length সহ table column alignment

---

## জ. Admin Panel

**সোর্স:** §15.9, §17.6, §17.8 item 7, recent commits (dashboard homepage, package form)

- ☐ এখনো কোনো super-admin tier নেই (last-admin lockout guard আছে, কিন্তু granular admin-role নেই) — স্কেল বাড়লে দরকার হবে
- ✅ **(2026-08-28) 2FA + admin audit trail সম্পন্ন ও লাইভ** — বিস্তারিত `security_hardening_context.md`। Admin-only TOTP 2FA (নিজে-implement, RFC 6238 test vector দিয়ে verify) + recovery codes + login-challenge flow + ৮টা sensitive admin action-এ audit log। `/admin/settings/security` + `/admin/audit-logs` পেজ, ২৮টা নতুন টেস্ট (সব pass, ০ regression)
- ☐ Recent commit `56acf11`/`62bb4b2` (dashboard homepage real data + package `max_staff`/`features` form) — নতুন করে যোগ হওয়া অংশ ফ্রেশ eye দিয়ে একবার browser-এ ক্লিক-থ্রু verify করা (real data edge case: শূন্য সেলার, শূন্য প্যাকেজ ইত্যাদি)
- ☐ **নতুন (2026-08-28 আবিষ্কৃত) — backend test suite-এ ৮০টা pre-existing ব্যর্থতা, sqlite-vs-postgres dialect mismatch** — `phpunit.xml` টেস্ট SQLite in-memory-তে চালায়, কিন্তু ক্রমবর্ধমান Postgres-specific raw SQL (`to_char()`, `now()`, `ON CONFLICT`) ব্যবহার হচ্ছে যেটা SQLite সাপোর্ট করে না — আসল লজিক বাগ না, কিন্তু test suite-এর signal-to-noise কমিয়ে দিচ্ছে (নতুন real regression এই ৮০-এর ভেতরে চাপা পড়ে যেতে পারে)। Fix করতে হয় test suite real Postgres-এ চালাতে হবে, নাহলে raw SQL গুলো DB-agnostic করে লিখতে হবে — বড় আলাদা সিদ্ধান্ত, এই ব্যাচের স্কোপে করা হয়নি

**UI/UX অডিট:**
- ☐ Admin sidebar/menu — নতুন যোগ হওয়া মডিউলগুলো (addon-packages, marketing-events, tracking, support) মেনু-হায়ারার্কি/active-state consistency (`CONTEXT.md` §22 checklist দিয়ে re-verify)

---

## ঝ. Analytics (seller-facing)

**সোর্স:** §15.7, feature_roadmap P5

- ☐ **Ads ROI tracker এখনো placeholder** (ইচ্ছাকৃত, UTM/ad-spend/Facebook data source prerequisite) — P5 প্রায়োরিটি, Facebook App Review কনফার্ম হওয়ার পর এটা শুরু করার প্রথম candidate

**UI/UX অডিট:**
- ☐ Sales/Customer/Courier analytics পেজ — CSS bar-chart trend বড় dataset-এ (৩+ মাস ডেটা) readability

---

## ঞ. Facebook/Meta Lead Capture

**সোর্স:** §15.11, `facebook_integration_context.md`

- ☐ **App Review ফলাফল কনফার্ম করা** — ২০২৬-০৮-০৭ সাবমিট হয়েছিল, ~২০ দিনের timeline পার হয়ে গেছে (আজ ২০২৬-০৮-২৭) — এটা প্রথমে চেক করা উচিত, ফলাফল না জানা থাকলে non-admin seller-দের Messenger lead-capture broken অবস্থায় থাকতে পারে
- ☐ App Review approve হলে non-admin seller flow end-to-end আরেকবার verify

---

## ট. WordPress/WooCommerce Connector

**সোর্স:** §15.12, `wordpress_connect_context.md`

- ☐ **Real WooCommerce staging সাইটে end-to-end QA এখনো হয়নি** — এই dev environment-এ কোনো WordPress ইনস্টল নেই, ব্যবহারকারীকে নিজে `SETUP.md` চেকলিস্ট ধরে করতে হবে; soft-launch cohort-এর কোনো সেলারের real WooCommerce সাইট থাকলে এটাই প্রথম real QA হবে

---

## ঠ. Custom Domain / Subdomain

**সোর্স:** §15.13, `custom_domain_context.md`, `domain_security_audit.md`

- ☐ সেলারের নিজস্ব কাস্টম ডোমেইন (T8b) — এখনো শুরু হয়নি, DNS CNAME verification + nginx/certbot automation লাগবে (বড় ops স্কোপ, প্রথম batch-এর জন্য must-have না)

---

## ড. Tracking Platform (Pixel + CAPI)

**সোর্স:** §15.14, `tracking_capi_context.md`

- ☐ প্রোডাকশনে প্রতিটি প্যাকেজে `max_tracking_events_per_day = NULL` (unlimited) — soft-launch-এর আগে বাস্তব লিমিট Admin → Packages-এ বসানো উচিত (silent event loss এড়াতে, ইচ্ছাকৃত সেফ ডিফল্ট কিন্তু ভুলে থেকে গেলে cost/abuse risk)

---

## ঢ. Digital Product System

**সোর্স:** `digital_product_context.md`

- ☐ Phase 1 লাইভ — কোনো Phase 2 প্ল্যান আছে কিনা (bulk product upload, license-key delivery ইত্যাদি) `digital_product_context.md` খুলে verify করা, এই polish pass-এ শুধু existing flow-এর real-user QA যথেষ্ট

---

## ণ. Onboarding + Bulk Import

**সোর্স:** `onboarding_checklist_context.md`, feature_roadmap P1/P3

- ☐ Onboarding checklist + demo-seed — নতুন real সেলার সাইনআপ করলে churn-drop verify করার জন্য প্রথম soft-launch cohort থেকে feedback নেওয়া

---

## ত. Cross-cutting Security Hardening — ✅ সম্পন্ন (2026-08-28)

**সোর্স:** §17.8, `production_audit_report_context.md §৩`, `domain_security_audit.md`

- ✅ **(2026-08-28) 2FA + admin audit trail সম্পন্ন** — বিস্তারিত §জ ও `security_hardening_context.md`
- 🟡 **(2026-08-28) Payment gateway sandbox verify — EPS ✅ সম্পন্ন (২০২৬-০৮-১৯-এই ছিল, ডকুমেন্টেশন stale ছিল, এখন sync হয়েছে), Nagad Merchant এখনো ⬜** — real Nagad merchant sandbox account/credential external dependency, verify()-এ success-path logging hardening যোগ হয়েছে কিন্তু আসল field-shape এখনো unconfirmed — বিস্তারিত §ছ ও `online_payment_context.md §৯.১, §১১`
- ✅ **(2026-08-28) addon-packages/marketing-events-এ adminScopeUserIds() re-verify সম্পন্ন — কোনো বাগ পাওয়া যায়নি।** `AddonPackage`-এ `user_id` কলামই নেই (platform-wide catalog, scoping প্রযোজ্য না); `PlatformMarketingEventController` কোথাও `auth()->id()` দিয়ে filter করে না (সব admin একই dataset দেখে, সঠিক); `AdminAddonPurchaseController::index()`-ও unscoped, ঠিক আছে। বিস্তারিত `security_hardening_context.md §৭`

---

## থ. Cross-cutting Design/UI/UX Consistency (`CONTEXT.md` §22 অনুযায়ী পূর্ণ সুইপ) — ✅ মূল sweep সম্পন্ন (2026-08-27)

কোনো নির্দিষ্ট মডিউলের বাগ না, পুরো অ্যাপ জুড়ে একবার পূর্ণ sweep দরকার — মাসের পর মাস আলাদা সেশনে ফিচার যোগ হয়েছে, design drift জমেছে হতে পারে:

- ✅ **(2026-08-27) Dark-mode hardcoded-color sweep, ব্যাচ ১ সম্পন্ন ও deploy করা হয়েছে** — admin/dashboard টেবিল পেজে systemic bug পাওয়া গেছে: `bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]` (row zebra/hover, ১৩ occurrence) এবং `border-[#e5ebf5]`/`border-[#d7e1ee]` (cell/header border, ১৫০+ occurrence) — dark theme-এ ভাঙত, এখন `var(--surface)`/`var(--surface-soft)`/`var(--accent)`/`var(--border)` টোকেনে বদলানো হয়েছে। প্লাস ৩টা status-badge (`bg-blue-100`/`bg-gray-100`) ও ৫টা Edit-button (দুই ভিন্ন style ছিল, `bg-blue-600` বনাম `bg-blue-50`) টোকেনে unify। ফাইল: `admin/tracking`, `admin/customers/active`, `admin/courier-cache`, `admin/sms/{credit,history,gateways}`, `admin/settings/notification-{templates,use-cases}`, `admin/landing/{pages,templates}`, `admin/packages`, `dashboard/sms/history`। `tsc --noEmit` + `npm run build` clean, `hybrid-frontend.service` restart + home/api/CSS-chunk smoke check সব `200`। **ইচ্ছাকৃতভাবে বাদ:** storefront/public-facing পেজ (customer-facing, আলাদা theme rule), toggle-knob/logo-container/sticker-preview-এর `bg-white` (structural, bug না), stat-card categorical color palette (`#0f7c7b`/`#2f7ec1` ইত্যাদি, ইচ্ছাকৃত multi-color pattern মনে হচ্ছে — পরের ব্যাচে verify করা উচিত)
- ✅ **(2026-08-27) মাল্টি-ল্যাংগুয়েজ সুইচিং বাগ (user-reported) — root cause পাওয়া গেছে ও ফিক্স, দুইটা আলাদা বাগ:**
  1. **অ্যাডমিন সাইডবার মেনু ভিন্ন পেজে ভিন্ন ভাষা দেখাত** — কারণ: `admin-menu.ts`-এর `buildAdminMenu()` প্রতিটা admin পেজ থেকে নিজস্ব partial `labels` object নিত (কোনো centralized dictionary ছিল না, seller-side `UserShell`-এর মতো), আর কোনো পেজ যদি কোনো menu key translate করতে ভুলে যেত (বেশিরভাগ পেজই ~১৫টা secondary key বাদ দিত — `addonPackages`, `tracking`, `marketingEvents`, `support`, `courierCache`, `landingPages/Templates`, ৭টা settings sub-menu ইত্যাদি), সেটা `admin-menu.ts`-এ hardcoded ইংরেজি fallback-এ silently পড়ে যেত। **ফিক্স:** `admin-menu.ts`-এ একটা সম্পূর্ণ `ADMIN_MENU_TEXT` bn/en dictionary (সব ২৭টা key) যোগ করা হয়েছে, `buildAdminMenu()`-এর signature `(labels: AdminMenuLabels)` থেকে `(locale: Locale)`-এ বদলানো হয়েছে — এখন থেকে কোনো পেজ কোনো key "ভুলে যেতে" পারবে না, single source of truth। ২৫টা admin পেজের call site আপডেট হয়েছে
  2. **পুরো ড্যাশবোর্ডে (seller + admin) প্রতি পেজ-লোডে ভাষা/থিম সংক্ষিপ্ত সময়ের জন্য ভুল দেখাত (flash), তারপর সঠিকে সংশোধন হতো** — root cause: `UserShell`-সহ (master shell, **সব seller dashboard পেজ প্রভাবিত**) মোট ১৩টা ফাইলে `useState<Locale>("bn")`/`useState<ThemeMode>("dark")` hardcoded literal দিয়ে state init হতো, তারপর `useEffect(() => setLocale(getStoredLocale()))` দিয়ে সংশোধন হতো — মানে ইউজার English/light বেছে নিলেও প্রতি পেজ-লোডে/নেভিগেশনে প্রথমে বাংলা/ডার্ক flash করে তারপর ঠিক হতো। **ফিক্স:** সব ১৩ ফাইলে (`user-shell.tsx` + ১১টা admin পেজ + `dashboard/settings/storefront`) lazy initializer প্যাটার্নে (`useState<Locale>(getStoredLocale)`) বদলানো হয়েছে — কোডবেসের নিজের established correct pattern (২০+ অন্য ফাইলে আগে থেকেই ব্যবহৃত)। মার্কেটিং হোমপেজের (`home-content.tsx`) theme-flash-ও একইভাবে ফিক্স করা হয়েছে। **ইচ্ছাকৃতভাবে বাদ:** `privacy/page.tsx`-এর `"en"` literal default — কোড কমেন্টে documented ইচ্ছাকৃত সিদ্ধান্ত (Meta App Review-এর জন্য), বাগ না
  
  `tsc --noEmit` + `npm run build` + `eslint` (pre-existing error count অপরিবর্তিত, নতুন কিছু introduce হয়নি) সব clean, `hybrid-frontend.service` restart + smoke check pass।
- ✅ **(2026-08-27, ব্যাচ ২ — গভীর অডিটে পাওয়া তৃতীয় ও সবচেয়ে বড় root cause) `UserShell` (seller dashboard-এর master shell)-এর নিজস্ব internal locale state, প্রতিটা পেজের নিজস্ব আলাদা locale state থেকে সম্পূর্ণ বিচ্ছিন্ন ছিল।** `UserShell` কোনো `locale`/`onToggleLocale` prop নিতই না — সম্পূর্ণ নিজে থেকে নিজের internal state manage করত। কিন্তু প্রায় প্রতিটা (৫২টা) dashboard পেজ নিজের `<UserShell>{...}</UserShell>` রেন্ডার করে (page component UserShell-এর parent, তাই §৩০-এর `useLocale()` context এখানে কাজ করে না — architectural rule অনুযায়ী), আর প্রতিটা পেজ নিজের body content-এর জন্য একটা **আলাদা** `locale` state রাখে। ফলাফল: টপবারের ভাষা-টগল বাটন ক্লিক করলে (যেটা UserShell-এর নিজের state বদলায়) সাইডবার/টপবার সাথে সাথে ভাষা বদলাত, কিন্তু **পেজের বডি কনটেন্ট আগের ভাষাতেই থেকে যেত** যতক্ষণ না অন্য পেজে নেভিগেট করে ফিরে আসা হতো (remount-এ localStorage থেকে নতুন করে পড়ত)। এটাই সম্ভবত ইউজারের রিপোর্ট করা মূল উপসর্গ। **ফিক্স:** `UserShell`-এ optional controlled `locale`/`onToggleLocale` prop যোগ করা হয়েছে (না দিলে আগের internal-state আচরণ অপরিবর্তিত থাকে, backward-compatible) — এখন ৫২টা dashboard পেজের প্রতিটাতে (৩টা landing-pages route বাদে, যেগুলো ইতিমধ্যে সঠিক `useLocale()` context pattern ব্যবহার করে) `<UserShell locale={locale} onToggleLocale={() => setLocale(...)}>` wire করা হয়েছে — এখন থেকে page body আর UserShell chrome একই React state শেয়ার করে, বিচ্ছিন্ন থাকার সুযোগ নেই। এই পাসে আরও ধরা পড়েছে: ৪৯টা পেজ শুধু `const [locale] = useState(...)` (কোনো setter destructure করা হয়নি) — অর্থাৎ mount-এর পর কখনোই বদলাতে পারত না, setter যোগ করা হয়েছে। একটা পেজে (`landing-page-analytics/[landingPageId]/page.tsx`) `useState<Locale>('bn')` literal default-ও পাওয়া গেছে (flash bug), সেটাও `getStoredLocale` lazy-init-এ ফিক্স। `tsc --noEmit`, `eslint` (error count অপরিবর্তিত), `npm run build` সব clean, লাইভ deploy+smoke-check pass।
- ☐ Support/Email-verification/Subscription banner-এর মতো shared component-গুলো (locale prop optional, ভুল default থাকলে risk) verify করা হয়েছে — সবগুলো সঠিকভাবে `locale={locale}` পাস করে, কোনো বাগ পাওয়া যায়নি এখানে
- ✅ **(2026-08-27, ব্যাচ ৩) টেবিল header-এর হার্ডকোডেড নীল (`bg-[#2f7ec1]`) — owner-confirm নেওয়া হয়েছে, টিল accent টোকেনে বদলানো হয়েছে।** `<thead>`/`<th>`-এর নীল ১৩ occurrence (১১ ফাইল: `admin/landing/{templates,pages}`, `admin/customers/active`, `admin/sms/{gateways,history,credit×৩}`, `admin/settings/notification-{use-cases,templates}`, `admin/tracking`, `admin/packages`, `dashboard/sms/history`) + `admin/courier-cache`-এর ২টা `<th>` — সব `bg-[var(--accent)] text-white`-এ। স্ট্যাট-কার্ড categorical color chip-গুলো (`color:`/`tone:` key, ভিন্ন প্যাটার্ন) ইচ্ছাকৃতভাবে অপরিবর্তিত রাখা হয়েছে — টেবিল-হেডার প্রশ্নের আওতায় ছিল না
- ✅ **(ব্যাচ ৩) stat-card categorical palette verify করা হয়েছে — ইচ্ছাকৃত multi-color ক্যাটাগরিক্যাল প্যাটার্ন, বাগ না** (প্রতিটা metric আলাদা রঙ পাওয়া visual distinction-এর জন্য, প্রায় সব dashboard product-এর common pattern)। শুধু `#0f7c7b`-কে (যেটা লাইট-মোড `--accent`-এর হুবহু duplicate ছিল) `var(--accent)`-এ বদলানো হয়েছে ৬টা ফাইলে (`dashboard/page.tsx`, `orders/page.tsx`, `customers/page.tsx`, `products/page.tsx`, `accounting/collections/page.tsx`, `admin/page.tsx`) — dark mode-এ এখন অন্য accent-নির্ভর UI-এর সাথে ব্রাইটনেস মেলে। বাকি categorical hex (`#2f7ec1`, `#27ae60`, `#8e44ad`, `#c0392b`, `#ff7a59` ইত্যাদি) ইচ্ছাকৃতভাবে অপরিবর্তিত — এগুলোর কোনো theme-aware token equivalent নেই, নতুন token বানানো একটা আলাদা design সিদ্ধান্ত, এই ব্যাচের স্কোপের বাইরে
- ✅ **(ব্যাচ ৩) সব dashboard/admin পেজে card spacing/radius/shadow consistency — কোড-লেভেলে অডিট করা হয়েছে, ভালো অবস্থায় পাওয়া গেছে।** ৮২টা পেজের মধ্যে ৭১টা শেয়ার্ড `.catv-panel` ক্লাস ব্যবহার করে (একই border/radius ১৮px/shadow)। বাকি ১১টা হয় builder/canvas পেজ (landing-pages builder, template builder — card layout প্রযোজ্যই না), placeholder পেজ (ads-roi), অথবা genuinely ভিন্ন UI প্যাটার্ন (support chat two-pane) — এগুলো drift না, ইচ্ছাকৃত ভিন্নতা। শুধু ২টা ফাইলে (`admin/landing/templates/builder/[id]`, `admin/support`) `catv-panel` ছাড়া নিজস্ব `rounded-2xl/3xl` card ছিল — দুটোই legitimate ভিন্ন UI (editor canvas, chat pane), fix দরকার নেই
- ✅ **(ব্যাচ ৩) Status badge color/style — order/courier/payment(collections)/subscription ৪ ডোমেইন জুড়ে cross-check করা হয়েছে, মূলত consistent পাওয়া গেছে।** Semantic মেলে এমন status একই রঙ পায় — pending/in_transit→yellow, confirmed/booked→blue, delivered→emerald (order ও courier দুটোতেই)। একটা ছোট, সম্ভবত-ইচ্ছাকৃত পার্থক্য: order-এ "cancelled"→red কিন্তু courier-এ "cancelled"→zinc/gray (courier cancellation প্রায়ই administrative event, customer-facing failure না — যুক্তিসঙ্গত পার্থক্য মনে হচ্ছে, ফিক্স করা হয়নি)। Payment-source badge (`accounting/collections`: manual/online_wallet/online_gateway/courier_cod) একটা ভিন্ন semantic axis (severity না, source-category) বলে আলাদা প্যালেট ব্যবহার করে — এটা inconsistency না, ভিন্ন ডেটা-ডাইমেনশন
- ✅ **(ব্যাচ ৩) bn/en টেক্সট overflow + mobile table overflow — সাম্প্রতিক নতুন পেজে (order-credits, addon-packages, storefront-addon, whatsapp automation/inbox, marketing-events) চেক করা হয়েছে, কোনো সমস্যা পাওয়া যায়নি।** যত `<table>` আছে সবগুলোই `overflow-x-auto` wrapper-এ (addon-packages ২টা, whatsapp/automation ১টা, marketing-events ৩টা — সব wrapped); order-credits/storefront-addon/whatsapp-inbox-এ কোনো টেবিলই নেই (card/list-based UI)। `truncate` ব্যবহার যেখানে আছে (whatsapp inbox-এর চ্যাট-প্রিভিউ, marketing-events-এর error message কলাম) সবগুলোই ইচ্ছাকৃত ও যথাযথ (chat-preview কনভেনশন, `title=` tooltip fallback সহ) — accidental clipping না
- ☐ **পরের ব্যাচ candidate (ছোট, related follow-up):** admin sidebar-এ `support` মেনু আইটেমে unread-count badge এখনো wire করা হয়নি (dashboard homepage `unread_support` count fetch করে কিন্তু কোনো `ShellMenuItem.badge`-এ পাঠায় না) — ফিচার gap, বাগ না
- ☐ **পরের ব্যাচ candidate:** এখনো প্রতিটা admin পেজ নিজের `CatvShell` render + locale/theme state + `text.menu*` duplicate করে (২৫ ফাইলে ~১৫ লাইন করে বয়লারপ্লেট রিপিট) — seller-side-এর মতো একটা `AdminShell` master-component বানালে এই পুরো duplication + ভবিষ্যতের অনুরূপ বাগ একবারে দূর হয়ে যাবে; এই ব্যাচে scope-এ রাখা হয়নি (বড় structural refactor, higher risk)

---

## দ. Long-term / Not-started (এই polish pass-এর স্কোপের বাইরে, শুধু রেফারেন্সের জন্য)

এই আইটেমগুলো নতুন ফিচার, বাগ-ফিক্স/polish না — `feature_roadmap_context.md`-এর status টেবিলে ট্র্যাক করা হয় আলাদাভাবে:
- Referral/affiliate program (P4)
- PWA
- Native mobile app
- AI product-description generator
- Cross-seller courier rate negotiation
- VAT/Tax challan export

---

## কাজ শুরুর প্রস্তাবিত ক্রম

Risk এবং effort বিবেচনা করে:

1. **থ (Design/UI/UX cross-cutting sweep)** — এটা "ঘষামাজা"-র মূল উদ্দেশ্য, প্রথমে করলে বাকি মডিউল-ভিত্তিক কাজেও pattern স্পষ্ট হবে
2. **ছ + ত (Payment gateway sandbox verify + 2FA/audit)** — financial/security risk, soft-launch-এর আগে hard blocker
3. **ঞ (Facebook App Review status চেক)** — external, শুধু একটা status-check, দ্রুত সম্পন্ন হতে পারে
4. **ক/খ/গ/ঘ (Core commerce/fraud/courier/checkout ছোট বাগ+hardening)** — user-facing correctness
5. **চ/জ/ঝ (Communication/Admin/Analytics polish)**
6. **ট/ঙ (WooCommerce real QA, storefront follow-ups)** — এক্সটার্নাল নির্ভরতা/user feedback লাগবে
7. বাকি (ঢ/ণ/ড/ঠ) — opportunistic, ছোট ছোট আইটেম

> এটা একটা প্রস্তাবিত ক্রম, চূড়ান্ত সিদ্ধান্ত user confirm করবে প্রতিটা মডিউলে ঢোকার আগে।
