# Subscription + Billing + SMS Credit — Work Context

এই ফাইলে এই কনভারসেশনে সাবস্ক্রিপশন/বিলিং ফিচার উন্নয়ন এবং SMS credit কেনার ফিচার প্ল্যানিং সংক্রান্ত সব কাজের context লিপিবদ্ধ থাকবে (user-এর বাধ্যতামূলক নির্দেশনা অনুযায়ী)। Master context: `CONTEXT.md` (server/ops), `SAAS_MODULE_CONTEXT.md` (product/feature — subscription §15.8/§18, SMS §15.5)।

> **২০২৬-০৮-২০ আপডেট**: SMS credit auto-recharge (`auto_top_up_context.md`) এখানকার `BkashPaymentGatewayClient`-কেই extend করে (নতুন Agreement মেথড: createAgreement/executeAgreement/chargeAgreement/cancelAgreement, একই idToken()/authHeaders() reuse করে) — এই ফাইলে ডকুমেন্টেড one-time checkout ক্লায়েন্ট কোড এখন auto-recharge-এর ভিত্তিও। বিস্তারিত auto_top_up_context.md-তে, এখানে repeat করা হয়নি।

> **🚨 Staff/Team role সচেতনতা (2026-08-10):** Subscription billing (`SubscriptionController`, bKash payment routes) এবং SMS credit purchase/wallet (`SmsCreditPurchaseController`, `SmsCreditBkash*Controller`) — এই পুরো ফিচার-সেট **সবসময় Pattern B (owner-only)**, `routes/api.php`-এ `owner_only` middleware দিয়ে wrapped — staff account কখনো নিজের subscription কিনতে/দেখতে বা SMS credit কিনতে পারবে না, এটা ইচ্ছাকৃত ডিজাইন। SMS **পাঠানো** (send/history/automation) আলাদা এবং Pattern A/staff-permission-gated (`sms` module) — SMS credit wallet balance staff ব্যবহার করতে পারে (owner-এর wallet থেকে কাটে, `AdminSmsGatewayController::send()`-এ `shopOwnerId()` দিয়ে resolve করা হয়) কিন্তু কেনা/রিচার্জ করতে পারে না। এই ফিচারে নতুন payment/billing-সম্পর্কিত কাজ করলে এই owner-only boundary বজায় রাখতে হবে — বিস্তারিত: CONTEXT.md §৩১, `staff_team_role_context.md §3.3`।

> **🚨 সেলার সাবডোমেইন — পেমেন্ট কলব্যাক এখন host-aware (2026-08-15):** সেলার এখন নিজের ঠিকানায় (`{label}.zyrotechbd.com`) ড্যাশবোর্ড চালায়, তাই bKash subscription ও SMS-credit কলব্যাক দুটোই সেলারকে **তার নিজের ঠিকানায়** ফেরত পাঠায়, প্ল্যাটফর্ম ডোমেইনে নয়। এটা `App\Support\FrontendUrl` দিয়ে হয়, আর ঠিকানা resolve হয় **payment রেকর্ডের মালিক থেকে — রিকোয়েস্টের `Host` হেডার থেকে নয়**। এই পার্থক্যটা নিরাপত্তাগত: bKash এই রিডাইরেক্ট নিয়ন্ত্রণ করে, তাই Host বিশ্বাস করলে প্রতিটি কলব্যাক একটা open redirect হয়ে যেত। payment না মিললে প্ল্যাটফর্ম URL-ই একমাত্র নিরাপদ গন্তব্য। **নতুন কোনো gateway/কলব্যাক যোগ করলে একই নিয়ম মানতে হবে** — বিস্তারিত `custom_domain_context.md §15`, CONTEXT.md §৩২।

Last updated: 2026-08-23 — **Phase 5: প্ল্যানিং শুরু (কোনো কোড লেখা হয়নি এখনো)।** user-এর আইডিয়া (order quota redesign, add-on/credit প্যাকেজ, landing page/storefront/tracking gating, ফিচার access control) থেকে পূর্ণ প্ল্যান নিচে §9-এ। Phase 1-4 (subscription upgrade/proration/invoice, SMS credit self-service purchase, PDF invoice, UI redesign) আগেই সম্পন্ন — §5-§8।

---

## 0. Scope (user request, সংক্ষেপে)

1. **সাবস্ক্রিপশন পেজ উন্নতি** (`/dashboard/settings/subscription`):
   - সব প্যাকেজ card-style-এ দেখাবে: নাম, দাম, মেয়াদ, ফিচার লিস্ট
   - বর্তমান active প্যাকেজ highlight থাকবে + বাকি মেয়াদ (দিন, ঘণ্টা, মিনিট) দেখাবে
   - **Upgrade** করা যাবে (দামে বড় প্যাকেজে) — যেকোনো সময়
   - **Downgrade** করা যাবে না যতক্ষণ না বর্তমান প্যাকেজের মেয়াদ শেষ হয়
   - Upgrade করলে বর্তমান প্যাকেজের অবশিষ্ট মেয়াদের টাকা (unused value) নতুন প্যাকেজের দামের সাথে সমন্বয় (prorate) হবে
   - পেমেন্টের আগে **ইনভয়েস জেনারেট** হবে — প্যাকেজ, মেয়াদ, দাম সমন্বয়ের হিসাব বিস্তারিতভাবে দেখাবে
   - ইনভয়েস পরিশোধ হলে প্যাকেজ active হবে
2. **SMS credit কেনা** (Phase 2, এই মুহূর্তে শুধু প্ল্যানিং) — পুরনো `zyro` প্রজেক্টের SMS credit purchase ধারণা থেকে adapt করে প্ল্যান করা।

---

## 1. বর্তমান কোডবেস অডিট (আগে থেকেই যা আছে)

### 1.1 Subscription — বর্তমান অবস্থা

| Layer | ফাইল | বর্তমান আচরণ |
|---|---|---|
| Package model | `backend/app/Models/SubscriptionPackage.php` | `name, slug, price, duration_days, max_orders, features(json), is_active` |
| Payment record | `backend/app/Models/SubscriptionPayment.php` + migration `2026_07_23_174146_create_subscription_payments_table.php` | `user_id, package_id, amount, payment_method, sender_bkash_number, trx_id, screenshot_path, status(pending/approved/rejected), bkash_payment_id, admin_note, reviewed_by, reviewed_at` — **কোনো proration/invoice field নেই** |
| User lifecycle fields | `backend/app/Models/User.php` | `subscription_package_id, subscription_status, subscription_started_at, subscription_ends_at` |
| Activation | `backend/app/Services/SubscriptionActivationService.php` | সবসময় **শুধু extend** করে: `base = (ends_at future) ? ends_at : now(); ends_at = base->addDays(package.duration_days)`. **কোনো package-switch/upgrade বিশেষ লজিক নেই** — manual approve ও bKash auto-approve দুটোই একই ভাবে চলে, প্যাকেজ বদলে গেলেও পুরনো বাকি মেয়াদ হিসেব ছাড়াই নতুন প্যাকেজের পুরো `duration_days` যোগ হয়ে যায় (proration নেই) |
| Seller-facing API | `backend/app/Http/Controllers/Api/SubscriptionController.php` | `plans()` (active প্যাকেজ লিস্ট, price অনুযায়ী sorted), `mySubscription()` (`days_left` = শুধু দিন, ঘণ্টা/মিনিট নেই; upgrade/downgrade flag কিছুই নেই), `submitPayment()` (manual trx_id submit — `amount = package.price` সরাসরি, কোনো proration নেই) |
| Payment gateway | `BkashPaymentController` (Tokenized, redirect flow) + `BkashPgwPaymentController` (classic PGW, widget flow) — দুটোই `SubscriptionActivationService::activate()` কল করে | কোনোটাই upgrade-aware না; `amount` সবসময় `package.price` |
| Admin approve | `AdminSubscriptionController::approvePayment/rejectPayment` | approve হলে `SubscriptionActivationService::activate()` কল করে |
| Frontend | `frontend/src/app/dashboard/settings/subscription/page.tsx` | প্যাকেজ radio-card list (নাম, দাম, `max_orders` দেখায়, কিন্তু **features বুলেট লিস্ট দেখায় না যদিও DB-তে আছে**), current package highlight নেই (শুধু উপরে টেক্সটে নাম+status+days_left), কোনো downgrade-lock UI নেই, কোনো invoice preview নেই |

**সিদ্ধান্ত নেওয়ার মতো gap:** downgrade-block, proration calculation, invoice generation/preview — **কিছুই backend বা frontend কোথাও implement করা নেই**। সম্পূর্ণ নতুন কাজ।

### 1.2 SMS Credit — বর্তমান অবস্থা

| Layer | ফাইল | বর্তমান আচরণ |
|---|---|---|
| Wallet | `backend/app/Models/SmsCredit.php` | `user_id, balance` — `walletFor()` দিয়ে lazy-create |
| History | `backend/app/Models/SmsCreditHistory.php` | `user_id, type(recharge/deduct), credits, balance_before, balance_after, note, recharged_by` |
| Rate setting | `backend/app/Models/SmsCreditSetting.php` | সিঙ্গেল সেটিংস রো: `rate_per_credit`(default ৳0.35), `chars_per_credit_english`(160), `chars_per_credit_unicode`(70), `currency` |
| Service | `backend/app/Services/SmsCreditService.php` | `calculateCreditsRequired(message)`, `getBalance()`, **`recharge()`** (transaction-safe, history লেখে), `deduct()` |
| Admin controller | `backend/app/Http/Controllers/AdminSmsCreditController.php` | `getSettings/updateSettings`, `listUserCredits`, **`recharge()` — admin manually অন্য user-কে credit দেয়**, `creditHistory` |
| Routes | `routes/api.php:397-401` | সবগুলো `/admin/sms/credit/*` — **admin-only**, seller নিজে কিনতে পারে না |

**Gap:** পুরো infrastructure (wallet, history, rate setting, recharge service) already আছে এবং reusable — শুধু **seller-facing self-service purchase flow (payment → auto-recharge)** টা নেই। এটাই বানাতে হবে, রেট/হিস্ট্রি সিস্টেম পুনরায় বানানোর দরকার নেই।

### 1.3 `zyro` reference — SMS credit purchase pattern (adapt করার জন্য পড়া হয়েছে)

- `zyro/models/SmsCredit.php` — সহজ balance CRUD (hybrid-stack-এর `SmsCreditService`-এ ইতিমধ্যে equivalent/উন্নত ভার্সন আছে)।
- `zyro/core/CreditService.php::calculateSmsCredits()` — GSM(160)/Unicode(70) char-count থেকে credit হিসাব — hybrid-stack-এ `SmsCreditService::calculateCreditsRequired()` হিসেবে **ইতিমধ্যে পোর্ট করা আছে** (settings-driven, আরও ভালো)।
- `zyro/controllers/PaymentController.php` — মূল reusable আইডিয়া:
  - একটাই generic `payments` টেবিল + `payment_type` কলাম (`sms_credit` / `subscription` / `add_fund`) দিয়ে polymorphic payment tracking।
  - `initiatePayment($userId, $amount, $gateway, $paymentType, $planId)` — gateway-তে redirect করার আগে `metadata`-তে `payment_type` + context বসিয়ে pending payment row রাখে।
  - `verifyAndProcessPayment($invoiceId)` — gateway callback/webhook থেকে verify করে, `payment_type` অনুযায়ী branch করে (`addSmsCredits()` / `activateSubscription()` / `addWalletFunds()`) — idempotent (আগে থেকে COMPLETED থাকলে no-op)।
  - `zyro/views/dashboard/billing.php` — wallet balance card + "Add Funds" modal + invoice/payment history টেবিল — UI ধারণা হিসেবে useful।
- **hybrid-stack-এ কীভাবে adapt হবে (copy না, concept):** hybrid-stack-এর বর্তমান আর্কিটেকচার ইতিমধ্যে zyro-র generic `payments`+`payment_type` idea-র বদলে **প্রতি-ফিচার আলাদা টেবিল** (`subscription_payments`, ভবিষ্যতে `sms_credit_purchases`) প্যাটার্ন follow করে — এটাই এই কোডবেসের established convention (§18-এর bKash gateway কাজেও তাই হয়েছে), তাই generic polymorphic টেবিলে না গিয়ে subscription_payments-এর বোনভাবে একটা সমান্তরাল `sms_credit_purchases` টেবিল বানানোই সামঞ্জস্যপূর্ণ। zyro থেকে শুধু **flow ধারণা** (initiate → gateway → verify/callback → auto-grant, idempotent) নেওয়া হচ্ছে, টেবিল ডিজাইন না।

---

## 2. Phase 1 প্ল্যান — Subscription upgrade/downgrade + proration + invoice

### 2.1 Package "বড়/ছোট" নির্ধারণ
`price` অনুযায়ী তুলনা (ইতিমধ্যে `plans()` এ `orderBy('price')` আছে) — আলাদা `tier`/`rank` কলাম দরকার নেই যতক্ষণ না দুইটা প্যাকেজের দাম সমান হয়ে অন্য কোনো বৈশিষ্ট্যে পার্থক্য দরকার হয়।

### 2.2 Downgrade lock (server-side — mandatory, শুধু frontend disable যথেষ্ট না)
প্রতিটা purchase entry point (`submitPayment`, `BkashPaymentController::initiate`, `BkashPgwPaymentController::create`)-এ নতুন guard:
```
if (user has active, non-expired subscription
    && target_package.price < current_package.price) {
    reject 422 "মেয়াদ শেষ না হওয়া পর্যন্ত নিচের প্যাকেজে যাওয়া যাবে না"
}
```

### 2.3 Proration হিসাব (নতুন `SubscriptionInvoiceService`)
```
remaining_days   = max(0, now()->diffInSeconds(current.ends_at) / 86400)   // fractional
current_daily_rate = current_package.price / current_package.duration_days
unused_credit    = round(remaining_days * current_daily_rate, 2)
payable_amount   = max(0, target_package.price - unused_credit)
```
- শুধু **upgrade** (target.price > current active package.price, subscription এখনো active/non-expired) হলে proration apply হবে।
- মেয়াদ শেষ হওয়ার পর নতুন প্যাকেজ কেনা (renewal/fresh purchase) → proration নেই, `payable_amount = target_package.price`।
- একই প্যাকেজ renewal (target === current) → proration নেই, `payable_amount = target_package.price`, বর্তমান আচরণ (extend from `ends_at`) অপরিবর্তিত থাকবে।

### 2.4 Upgrade-এর পর নতুন মেয়াদ কীভাবে সেট হবে — ✅ কনফার্ম করা হয়েছে (user, 2026-08-09)
নতুন `ends_at = now() + target_package.duration_days` (fresh full cycle আজ থেকে শুরু) — কারণ বাকি মেয়াদের টাকা ইতিমধ্যে দামে ছাড় (credit) হিসেবে সমন্বয় হয়ে গেছে, তাই আলাদা করে দিন যোগ করলে double-benefit হয়ে যাবে। `SubscriptionActivationService`-এ upgrade case আলাদা branch হিসেবে implement হবে।

### 2.5 DB পরিবর্তন
`subscription_payments` টেবিলে নতুন কলাম (migration, existing row-এ backward compatible nullable/default):
```php
$table->decimal('base_amount', 10, 2)->nullable();       // target package-এর মূল দাম
$table->decimal('proration_credit', 10, 2)->default(0);  // বাকি মেয়াদের ছাড়
$table->foreignId('previous_package_id')->nullable()->constrained('subscription_packages')->nullOnDelete();
$table->json('invoice_breakdown')->nullable();            // পুরো হিসাব (UI-তে দেখানোর জন্য স্ন্যাপশট)
```
`amount` কলামটাই final payable amount থাকবে (backward compatible — বাকি সব জায়গায় `amount` দিয়ে দাম দেখানো হয়, বদলাতে হবে না)।

### 2.6 নতুন/পরিবর্তিত backend endpoint
| Method+Path | কাজ |
|---|---|
| `GET /subscription/invoice/preview?package_id=X` (নতুন) | পেমেন্টের আগে breakdown দেখানোর জন্য — DB-তে কিছু লেখে না, শুধু হিসাব রিটার্ন করে (`base_amount, proration_credit, payable_amount, is_upgrade, is_downgrade_blocked, new_ends_at_preview`) |
| `submitPayment`, `bkash/initiate`, `bkash-pgw/create` (পরিবর্তন) | ভেতরে `SubscriptionInvoiceService::compute()` কল করে সার্ভার-সাইডে amount নির্ধারণ (client থেকে amount trust করা যাবে না), `base_amount/proration_credit/previous_package_id/invoice_breakdown` সেভ করবে |
| `SubscriptionActivationService::activate()` (পরিবর্তন) | `payment.previous_package_id !== null && payment.package_id !== previous` হলে upgrade branch (§2.4-A), নাহলে বর্তমান extend behavior অপরিবর্তিত |
| `mySubscription()` (পরিবর্তন) | `days_left` এর বদলে/পাশাপাশি `remaining: {days, hours, minutes, total_seconds}` + প্রতিটা প্যাকেজে `is_current`, `is_downgrade_blocked` ফ্ল্যাগ (অথবা `plans()`-এ যোগ) |

### 2.7 Frontend প্ল্যান (`subscription/page.tsx` redesign)
- Package card: নাম, ৳দাম, মেয়াদ (দিন), **features বুলেট লিস্ট** (এখন `features` field আছে কিন্তু UI-তে render হয় না — এইটা যোগ করতে হবে), "বর্তমান প্ল্যান" badge।
- Current package card highlight (accent border) + লাইভ countdown (দিন/ঘণ্টা/মিনিট, `setInterval` দিয়ে প্রতি মিনিটে আপডেট, `ends_at` থেকে client-side গণনা)।
- দাম কম এমন card-এ disabled overlay + টুলটিপ: "মেয়াদ শেষ না হওয়া পর্যন্ত এই প্যাকেজে যাওয়া যাবে না"।
- প্যাকেজ সিলেক্ট করলে (upgrade হলে) → **Invoice preview panel/modal**: বর্তমান প্যাকেজ, নতুন প্যাকেজ, মূল দাম, বাকি মেয়াদের ছাড় (টাকায়), পরিশোধযোগ্য অর্থ, নতুন মেয়াদ শেষের তারিখ — এরপর "ইনভয়েস পরিশোধ করুন" বাটনে existing bKash/manual flow চলবে (invoice preview-এর `package_id`-ই পাঠানো হবে, amount সবসময় সার্ভার recompute করবে)।
- Design system rules (CONTEXT.md §22) মেনে চলা বাধ্যতামূলক — token color, bilingual, mobile-first, dark/light।

### 2.8 Verification checklist (আগের bKash কাজের মতোই)
- Tinker দিয়ে proration formula rollback-wrapped টেস্ট (কয়েকটা scenario: same-day upgrade, mid-cycle upgrade, expired-then-purchase, downgrade attempt reject)
- `php artisan route:list` দিয়ে নতুন route/middleware ভেরিফাই
- `npm run deploy:prod:safe` 8/8 pass + live smoke check

---

## 3. Phase 2 প্ল্যান — SMS Credit self-service purchase (zyro থেকে adapt, §1.3 দেখুন)

**গুরুত্বপূর্ণ:** এই ফেজ **subscription upgrade/invoice কাজ শেষ হওয়ার পরে** শুরু হবে (user-এর নির্দেশনা অনুযায়ী ক্রম)। নিচে শুধু প্ল্যান — কোনো কোড এখনো লেখা হয়নি।

### 3.1 নতুন DB টেবিল — `sms_credit_purchases` (subscription_payments-এর সমান্তরাল)
```php
Schema::create('sms_credit_purchases', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->unsignedInteger('credits');
    $table->decimal('rate_used', 10, 4);     // purchase সময়ের SmsCreditSetting::rate_per_credit স্ন্যাপশট
    $table->decimal('amount', 10, 2);        // credits * rate_used
    $table->string('payment_method', 30)->default('bkash_manual'); // bkash_manual | bkash_gateway | bkash_pgw
    $table->string('sender_bkash_number', 20)->nullable();
    $table->string('trx_id', 50)->nullable()->unique();
    $table->string('screenshot_path')->nullable();
    $table->string('bkash_payment_id')->nullable();  // §18.1-এর bug মনে রেখে Fillable-এ যোগ করা বাধ্যতামূলক
    $table->string('status', 20)->default('pending'); // pending|approved|rejected
    $table->text('admin_note')->nullable();
    $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamp('reviewed_at')->nullable();
    $table->timestamps();
    $table->index(['user_id', 'status']);
});
```

### 3.2 Backend — নতুন ফাইল
- `app/Models/SmsCreditPurchase.php`
- `app/Http/Controllers/Api/SmsCreditPurchaseController.php` (seller-facing, `auth:sanctum` group-এ, admin middleware ছাড়া):
  - `GET /sms/credit/rate` — `SmsCreditSetting::getSetting()` থেকে rate/currency + বর্তমান balance রিটার্ন (seller-facing read; admin-only settings route থেকে আলাদা)
  - `POST /sms/credit/purchases` — manual bKash submit (credits, sender_bkash_number, trx_id, screenshot) → pending row, amount = credits * rate_per_credit (সার্ভার-সাইড হিসাব, client amount trust না)
  - `GET /sms/credit/purchases` — নিজের history
- Gateway flow — **কোড পুনরায় না লিখে existing bKash client (`BkashPaymentGatewayClient`/`BkashPgwPaymentGatewayClient`) reuse**:
  - `POST /sms/credit/pay/bkash/initiate` (Tokenized) ও `POST /sms/credit/pay/bkash-pgw/{create,execute}` (PGW) — `BkashPaymentController`/`BkashPgwPaymentController`-এর প্যাটার্ন কপি করে SMS-credit-নির্দিষ্ট controller বানানো (অথবা রিফ্যাক্টর করে দুই controller-কে "purchase type" নেওয়ার মতো generalize করা — যদি সময় থাকে সেটা cleaner, নাহলে duplicate-but-consistent controller ঠিক আছে যেহেতু কোডবেস এখন পর্যন্ত এই প্যাটার্নই follow করে)
  - Public callback route (Tokenized-এর জন্য) লাগবে subscription-এর মতোই: `GET /sms/credit/pay/bkash/callback` (bKash browser সরাসরি redirect করে, কোনো Sanctum token থাকে না — `bkash_payment_id` দিয়ে row খুঁজে বের করা, §18-এর pattern হুবহু)
- Activation: gateway auto-success বা admin-approve — উভয় ক্ষেত্রে **`SmsCreditService::recharge($userId, $credits, rechargedBy: null|adminId, note: "Purchase #$id via bKash")`** কল (existing service reuse, নতুন কিছু লেখার দরকার নেই)।
- Admin: `AdminSmsCreditController`-এ (অথবা নতুন `AdminSmsCreditPurchaseController`-এ) `listPurchases/approvePurchase/rejectPurchase` — `AdminSubscriptionController::approvePayment/rejectPayment`-এর প্যাটার্ন হুবহু অনুসরণ।

### 3.3 Frontend — নতুন পেজ
- নতুন route: `/dashboard/sms/credit` অথবা `/dashboard/sms/buy-credit` (মেনু: `sms` group-এর নিচে নতুন item, `activeKey: "sms-credit"`)
- UI (subscription page-এর প্যাটার্ন অনুসরণ): balance card (বর্তমান credit ব্যালেন্স), quick-pick amount বাটন (৫০০/১০০০/২০০০/৫০০০ credit) + custom input, live দাম হিসাব (credits × rate), bKash pay বাটন (gateway configured থাকলে) + manual trx_id ফর্ম fallback, purchase history টেবিল। বাংলা/ইংরেজি, dark/light, mobile-first (CONTEXT.md §20/§22 বাধ্যতামূলক)।

### 3.4 zyro থেকে যা নেওয়া হচ্ছে না (deliberately)
- Generic `payments` + `payment_type` polymorphic টেবিল — hybrid-stack-এর per-feature টেবিল কনভেনশনের সাথে সামঞ্জস্যহীন
- ZiniPay gateway — hybrid-stack-এ bKash (Tokenized+PGW) ইতিমধ্যে live, নতুন গেটওয়ে দরকার নেই
- Wallet/"Add Funds" জেনারেল ব্যালেন্স কনসেপ্ট — scope-এ শুধু SMS credit, জেনারেল wallet না

---

## 4. Execution order (এই কনভারসেশনে)

1. ✅ Audit + প্ল্যান লেখা (এই ফাইল) — সম্পন্ন
2. ✅ Phase 1: Subscription upgrade/downgrade/proration/invoice — backend migration + service + controller changes, frontend card redesign + invoice preview + countdown — সম্পন্ন (§5)
3. ✅ Phase 1 deploy + live verify (`npm run deploy:prod:safe`) — সম্পন্ন (§5)
4. ✅ Phase 2: SMS credit self-service purchase (§3) — সম্পন্ন (§6)
5. ✅ Phase 2 deploy + live verify — সম্পন্ন (§6)

---

## 5. Phase 1 — Implementation log (2026-08-09)

### 5.1 Design decision কনফার্ম (user)
Upgrade করলে নতুন `ends_at = now() + target_package.duration_days` (আজ থেকে fresh full cycle) — §2.4-এ এখন ✅ হিসেবে মার্ক করা আছে।

### 5.2 Backend — নতুন/পরিবর্তিত ফাইল
- **নতুন migration** `2026_08_09_184617_add_proration_fields_to_subscription_payments_table.php` — `subscription_payments`-এ `base_amount`, `proration_credit`(default 0), `previous_package_id`(FK, nullOnDelete), `invoice_breakdown`(json) — migrate করা হয়েছে (production DB)।
- **নতুন** `app/Services/SubscriptionInvoiceService.php` — `compute(User, SubscriptionPackage): array` — §2.3/§2.4-এর প্রোরেশন ফর্মুলা + `is_current`/`is_upgrade`/`is_downgrade_blocked` ফ্ল্যাগ, single source of truth (preview endpoint + সবগুলো purchase entry point একই সার্ভিস কল করে, client amount কখনো trust করা হয় না)।
- **পরিবর্তিত** `app/Services/SubscriptionActivationService.php` — `activate()`-এ upgrade-branch যোগ: `payment.previous_package_id` সেট থাকলে ও package বদলে গেলে fresh cycle (`now()+duration_days`); নাহলে legacy extend-from-ends_at আচরণ অপরিবর্তিত।
- **পরিবর্তিত** `app/Http/Controllers/Api/SubscriptionController.php`:
  - `plans()` — প্রতিটা প্যাকেজে `is_current/is_upgrade/is_downgrade_blocked/payable_amount` যোগ (InvoiceService দিয়ে)
  - নতুন `invoicePreview()` — `GET /subscription/invoice/preview?package_id=X`
  - `mySubscription()` — `remaining: {days,hours,minutes,total_seconds}` যোগ (আগের `days_left` অক্ষত রাখা হয়েছে, backward compatible)
  - `submitPayment()` — downgrade guard (422) + InvoiceService দিয়ে amount/base_amount/proration_credit/previous_package_id/invoice_breakdown সেভ
- **পরিবর্তিত** `app/Http/Controllers/Api/BkashPaymentController.php::initiate()` ও `app/Http/Controllers/Api/BkashPgwPaymentController.php::create()` — একই downgrade guard + InvoiceService-computed amount (bKash-কে payable_amount পাঠানো হয়, raw package price না)
- **পরিবর্তিত** `app/Models/SubscriptionPayment.php` — Fillable + casts-এ নতুন কলাম যোগ, `previousPackage()` relation
- **পরিবর্তিত** `routes/api.php` — `GET /subscription/invoice/preview` route যোগ

### 5.3 Frontend — পরিবর্তিত ফাইল
- `frontend/src/app/dashboard/settings/subscription/page.tsx` (single file, বড় redesign):
  - Package card: features বুলেট লিস্ট, "বর্তমান প্ল্যান"/"আপগ্রেড" badge, downgrade-blocked card disabled+lock message (title tooltip + inline)
  - Current plan section: লাইভ countdown (দিন/ঘণ্টা/মিনিট, ১ সেকেন্ড interval-এ tick করে, `subscription.remaining.total_seconds` থেকে init)
  - প্যাকেজ সিলেক্ট করলে `GET /subscription/invoice/preview` কল হয়ে ইনভয়েস প্যানেল দেখায় (base price, proration credit যদি থাকে, payable amount, নতুন মেয়াদ শেষের তারিখ, upgrade/renewal note)
  - bKash PGW widget-এর `paymentRequest.amount` এখন invoice preview-এর `payable_amount` থেকে আসে (আগে raw package price ছিল) — bKash-এর নিজের popup-এ দেখানো amount আর ব্যাকএন্ড charge সবসময় মিলবে
  - সব পেমেন্ট বাটন (manual submit, bKash tokenized, bKash PGW) `invoice` লোড না হওয়া পর্যন্ত বা `is_downgrade_blocked` হলে disabled

### 5.4 Verification (এই সেশনেই সম্পন্ন)
- **Tinker, rollback-wrapped** (`DB::beginTransaction()`/`rollBack()`): `SubscriptionInvoiceService::compute()` ৪টা scenario (upgrade-প্রোরেশন, downgrade-block, same-package renewal, expired-then-fresh-purchase) — সব সঠিক হিসাব দিয়েছে। `SubscriptionActivationService::activate()` upgrade vs renewal branch আলাদাভাবে টেস্ট করে ends_at সঠিক প্রমাণিত।
- **Backend:** `php -l` সব ফাইলে clean, `php artisan migrate --force` সফল, `php artisan route:list --path=subscription` দিয়ে নতুন route কনফার্ম।
- **Frontend:** `npx tsc --noEmit` clean, `npm run deploy:prod:safe` — 8/8 ধাপ pass, `hybrid-frontend.service` active।
- **Live HTTP round-trip** (`bsol.zyrotechbd.com`, nginx+Sanctum দিয়ে, test data session শেষে মুছে ফেলা হয়েছে):
  - `GET /subscription/plans` — flags সঠিক দেখা গেছে (উপরে থাকা প্যাকেজে `is_upgrade:true, payable_amount` প্রোরেটেড; নিচের প্যাকেজে `is_downgrade_blocked:true`)
  - `GET /subscription/invoice/preview?package_id=` — upgrade (৳400 base − ৳50 proration = ৳350 payable) ও same-package renewal (কোনো proration ছাড়া) দুটোই সঠিক
  - `POST /subscription/payments` — downgrade attempt → `422` সঠিক reject; বৈধ upgrade → payment row-এ base_amount/proration_credit/invoice_breakdown সঠিকভাবে সেভ হয়েছে
  - Admin `POST /admin/subscription-payments/{id}/approve` → `SubscriptionActivationService` কল হয়ে `subscription_package_id` বদলেছে এবং `subscription_ends_at` = approve-এর মুহূর্ত থেকে ঠিক ৩০ দিন পর (fresh cycle, §2.4 confirmed decision অনুযায়ী) — end-to-end pipeline (invoice → payment → admin approve → activation) পুরোপুরি কাজ করছে প্রমাণিত
  - সব টেস্ট প্যাকেজ/ইউজার/পেমেন্ট/টোকেন সেশন শেষে DB থেকে মুছে ফেলা হয়েছে

### 5.5 যা এই ফেজে করা হয়নি (out of scope, ভবিষ্যতে বিবেচনা করা যেতে পারে)
- ~~bKash gateway flow real-money টেস্ট~~ — ✅ user নিজে টেস্ট করে সফল কনফার্ম করেছেন (2026-08-09, একই দিন)
- PDF ইনভয়েস ডাউনলোড/প্রিন্ট (§16.7-এর broader "Invoice/Waybill PDF" scope-এর অংশ) — এই ফেজে শুধু on-screen ইনভয়েস প্রিভিউ, কোনো PDF জেনারেশন যোগ হয়নি
- Admin subscription-payments লিস্টে নতুন proration কলাম (base_amount/proration_credit) দেখানো — admin UI (`/admin/billing` পেমেন্ট queue) এই সেশনে touch করা হয়নি, `invoice_breakdown` JSON ডেটাবেসে আছে কিন্তু admin frontend-এ render হয় না এখনো

---

## 6. Phase 2 — Implementation log (2026-08-09, SMS credit self-service purchase)

§3-এর প্ল্যান অনুযায়ী, কোনো নতুন design decision লাগেনি (rate/wallet/history infra আগে থেকেই ছিল)।

### 6.1 Backend — নতুন ফাইল
- **নতুন migration** `2026_08_09_190412_create_sms_credit_purchases_table.php` — §3.1-এর ডিজাইন অনুযায়ী হুবহু (`user_id, credits, rate_used, amount, payment_method, sender_bkash_number, trx_id, screenshot_path, bkash_payment_id, status, admin_note, reviewed_by, reviewed_at`)
- **নতুন** `app/Models/SmsCreditPurchase.php`
- **নতুন** `app/Http/Controllers/Api/SmsCreditPurchaseController.php` — `rate()` (rate/balance/gateway-config/payment-instructions, seller-facing), `myPurchases()`, `submitPayment()` (manual bKash, min 100 credits, server-side amount = credits × rate)
- **নতুন** `app/Http/Controllers/Api/SmsCreditBkashPaymentController.php` — `initiate()`+`callback()`, `BkashPaymentController`-এর হুবহু প্যাটার্ন (Tokenized Checkout), সফল হলে `SmsCreditService::recharge()` কল করে
- **নতুন** `app/Http/Controllers/Api/SmsCreditBkashPgwPaymentController.php` — `create()`+`execute()`, `BkashPgwPaymentController`-এর হুবহু প্যাটার্ন (classic PGW widget flow)
- **পরিবর্তিত** `app/Http/Controllers/AdminSmsCreditController.php` — `listPurchases()`/`approvePurchase()`/`rejectPurchase()` যোগ (AdminSubscriptionController-এর approve/reject প্যাটার্ন), approve হলে `SmsCreditService::recharge()` কল করে (existing service reuse, নতুন balance-update লজিক লেখা হয়নি)
- **পরিবর্তিত** `routes/api.php` — public `GET /sms/credit/pay/bkash/callback`; auth:sanctum গ্রুপে `GET /sms/credit/rate`, `GET|POST /sms/credit/purchases`, `POST /sms/credit/pay/bkash/initiate`, `POST /sms/credit/pay/bkash-pgw/{create,execute/{id}}`; admin গ্রুপে `GET /admin/sms/credit/purchases`, `POST .../{purchase}/approve`, `POST .../{purchase}/reject`

### 6.2 Frontend — নতুন/পরিবর্তিত ফাইল
- **নতুন** `frontend/src/app/dashboard/sms/credit/page.tsx` — seller-facing purchase page: balance card, quick-pick credit বাটন (৫০০/১০০০/২০০০/৫০০০) + custom input, লাইভ দাম হিসাব (credits×rate), bKash pay বাটন (tokenized/pgw, subscription page-এর widget-integration প্যাটার্ন হুবহু পুনঃব্যবহার), manual fallback ফর্ম, purchase history টেবিল — বাংলা/ইংরেজি, dark/light, mobile-first
- **পরিবর্তিত** `frontend/src/components/user-shell.tsx` — sidebar-এ `sms-credit` মেনু আইটেম যোগ (SMS গ্রুপের নিচে, "SMS পাঠান"/"হিস্টোরি"/"অটোমেশন"-এর পাশে "ক্রেডিট কিনুন")
- **পরিবর্তিত** `frontend/src/app/admin/sms/credit/page.tsx` — নতুন "Purchase Requests (Self-Service)" প্যানেল (pending queue) Approve/Reject বাটনসহ, Credit History সেকশনের ঠিক উপরে — admin billing পেজের approve/reject প্যাটার্ন অনুসরণ করে

### 6.3 Verification
- `php -l` সব নতুন/পরিবর্তিত ফাইলে clean, `php artisan migrate --force` সফল, `php artisan route:list --path=sms/credit` দিয়ে ১৫টা নতুন route কনফার্ম
- `npx tsc --noEmit` clean, `npm run deploy:prod:safe` 8/8 pass, `/dashboard/sms/credit` route static build-এ দেখা গেছে
- **Live HTTP round-trip** (`bsol.zyrotechbd.com`, test data সেশন শেষে মুছে ফেলা হয়েছে):
  - `GET /sms/credit/rate` — rate/balance/gateway config সঠিক
  - `POST /sms/credit/purchases` (manual, 500 credits) — amount সঠিকভাবে সার্ভার-সাইড হিসাব হয়েছে (৫০০×৳0.35=৳175)
  - `GET /admin/sms/credit/purchases?status=pending` — pending purchase দেখা গেছে
  - `POST /admin/sms/credit/purchases/{id}/approve` — `SmsCreditService::recharge()` কল হয়ে ব্যালেন্স 0→500 আপডেট হয়েছে (`GET /sms/credit/rate` দিয়ে কনফার্ম)
  - সব টেস্ট ইউজার/পারচেজ/হিস্টোরি/টোকেন সেশন শেষে DB থেকে মুছে ফেলা হয়েছে
- bKash gateway path (initiate/create/execute) এই সেশনে শুধু কোড-লেভেলে subscription-এর verified pattern পুনঃব্যবহার করে বানানো হয়েছে, আলাদা করে real-money টেস্ট করা হয়নি — subscription-এর bKash flow ইতিমধ্যে user নিজে verify করেছেন এবং এই কোড হুবহু একই client/pattern ব্যবহার করে বলে ঝুঁকি কম, তবে সুযোগ হলে একবার সরাসরি verify করা ভালো

### 6.4 যা এই ফেজে করা হয়নি (out of scope)
- Bulk-discount credit pack pricing (§3.1-এ উল্লেখ করা হয়েছিল না করার সিদ্ধান্ত হিসেবে) — শুধু flat rate × credits
- ~~PDF রিসিট/ইনভয়েস~~ — ✅ Phase 3-এ যোগ করা হয়েছে, §7 দেখুন
- `bkash_payment_id` না থাকা অবস্থায় admin manually purchase-এর status "stuck" রিকভারি UI (§18.1-এর bug-এর মতো কোনো সমস্যা রিপ্রোডিউস করা যায়নি — `bkash_payment_id` Fillable-এ প্রথম থেকেই যোগ করা হয়েছে এই ফাইলে, §18.1-এর শিক্ষা মাথায় রেখে)

---

## 7. Phase 3 — PDF ইনভয়েস + UI সম্পূর্ণ redesign (2026-08-10)

User request: "এসএমএস ক্রেডিট, প্যাকেজ, ইনভয়েস PDF ও বিল পেমেন্ট এর সকল UI নতুন করে ডিজাইন কর। সহজ সাবলিল এবং মডার্ন ডিজাইন।"

### 7.1 নতুন backend capability — PDF ইনভয়েস জেনারেশন

আগে কোনো PDF library ছিল না (§15.10-এ gap হিসেবে নোট করা ছিল)। এখন যোগ করা হয়েছে:

- **Package:** `barryvdh/laravel-dompdf` (`^3.1`, Laravel 13-compatible, `composer require` দিয়ে ইনস্টল করা হয়েছে, কোনো conflict হয়নি)
- **Bengali font সমস্যা ও সমাধান:** dompdf-এর built-in font (DejaVu Sans)-এ বাংলা script এবং ৳ (Taka sign, U+09F3) glyph নেই — কাস্টমার নাম বাংলায় হলে বা টাকার চিহ্ন থাকলে blank/tofu box দেখাত। সমাধান: Google Noto Sans Bengali (Regular + Bold, `backend/storage/fonts/`-এ ডাউনলোড করে রাখা হয়েছে, `www-data` ownership) — `@font-face`-এর মাধ্যমে PDF-এ embed করা হয় (`file://` local path)।
  - **⚠️ গুরুত্বপূর্ণ শেখা:** পুরো ডকুমেন্টে গ্লোবালি Noto Sans Bengali ব্যবহার করলে Latin টেক্সট (labels, headings)-এর letter-spacing বাজেভাবে চওড়া দেখাচ্ছিল (dompdf + এই ফন্টের Latin glyph metrics-এর কম্প্যাটিবিলিটি সমস্যা) — তাই body-র default font রাখা হয়েছে dompdf-এর built-in **DejaVu Sans** (ভালো Latin rendering), আর Noto Sans Bengali শুধু `.i18n` class-scoped elements-এ (customer name) এবং amount/currency cells-এ apply করা হয়েছে (`.amount`, `.credit-amount`, `.total-row .amount`) — যেখানে বাংলা script বা ৳ চিহ্ন থাকার সম্ভাবনা আছে। Item label-এ ৳ থাকলে (যেমন SMS credit-এর rate note "× ৳0.35/credit") সেই অংশটুকু আলাদা `<span class="i18n">`-এ split করা হয়েছে, বাকি লেবেল ("1,000 SMS credits") default font-এ থাকে — mixed-font-per-element সীমাবদ্ধতা এড়ানোর জন্য এই split pattern ব্যবহার করা হয়েছে।
- **`app/Services/InvoicePdfService.php`** — shared service, দুটো method: `subscriptionInvoice(SubscriptionPayment)` ও `smsCreditInvoice(SmsCreditPurchase)`, দুটোই একই Blade template ব্যবহার করে
- **`resources/views/invoices/document.blade.php`** — একটাই shared invoice layout: brand header, billed-to + invoice# meta, line-items টেবিল (proration credit থাকলে আলাদা লাইনে ঋণাত্মক দেখায়), status badge (PAID/AWAITING PAYMENT/REJECTED, রঙ-কোডেড), pending হলে "awaiting payment" নোটিশ বক্স, payment method/TrxID/paid-date ফুটার লাইন
- **নতুন endpoint:** `GET /subscription/payments/{payment}/invoice` ও `GET /sms/credit/purchases/{purchase}/invoice` (`auth:sanctum`, `abort_unless($record->user_id === auth()->id(), 403)` ownership guard) — `stream()` দিয়ে `Content-Disposition: inline` PDF রেসপন্স করে (নতুন ব্রাউজার ট্যাবে খোলার জন্য, ডাউনলোডও করা যায় সেখান থেকে)

### 7.2 Frontend — authenticated PDF download pattern

Plain `<a href>` Bearer token header পাঠাতে পারে না (Sanctum bearer-token auth, cookie-based না) — তাই নতুন shared helper:

- **`frontend/src/lib/dashboard-client.ts` → `openAuthenticatedPdf(url)`** — `fetch()` দিয়ে Authorization header-সহ PDF blob নামায়, `URL.createObjectURL()` দিয়ে নতুন ট্যাবে খোলে, ৬০ সেকেন্ড পর object URL revoke করে (নতুন ট্যাব ততক্ষণে load হয়ে যাবে)। Subscription ও SMS-credit উভয় পেজেই reuse হয়েছে।

### 7.3 Frontend — সম্পূর্ণ UI redesign

দুটো ফাইলই বড় visual redesign হয়েছে (business logic/state/effects অপরিবর্তিত — শুধু JSX + presentation):

- **`frontend/src/app/dashboard/settings/subscription/page.tsx`**:
  - Hero "Current Plan" card — gradient accent ব্যাকগ্রাউন্ড, স্ট্যাটাস পিল, **লাইভ countdown "digit box" UI** (দিন/ঘণ্টা/মিনিট আলাদা রাউন্ডেড বক্সে বড় সংখ্যা, প্রতি সেকেন্ডে টিক করে)
  - প্যাকেজ কার্ড — বড় spacing, `lucide-react` আইকন (CheckCircle2 ফিচার বুলেট, Sparkles আপগ্রেড ব্যাজ, Lock ডাউনগ্রেড-লকড), hover elevation, কার্ডের নিচে স্পষ্ট CTA টেক্সট ("নির্বাচন করুন"/"নির্বাচিত"/লকড মেসেজ)
  - ইনভয়েস প্রিভিউ — dashed-border "রসিদ-স্টাইল" কার্ড (প্রকৃত PDF-এর visual language-এর সাথে সামঞ্জস্যপূর্ণ)
  - বিল পেমেন্ট সেকশন — bKash বাটন প্রাইমারি/prominent রাখা হয়েছে, ম্যানুয়াল ফর্ম এখন **collapsible** (ডিফল্ট লুকানো, "ম্যানুয়ালি পেমেন্ট করুন" টগল বাটনে দেখা যায়) — কম clutter, বেশি modern checkout feel
  - History টেবিল থেকে বদলে **"invoice row" card list**-এ — প্রতি রো: প্যাকেজ নাম+তারিখ, টাকা+স্ট্যাটাস পিল (আইকনসহ), এবং **PDF ডাউনলোড আইকন বাটন** (`openAuthenticatedPdf` কল করে)
- **`frontend/src/app/dashboard/sms/credit/page.tsx`**: একই ডিজাইন ভাষা — ব্যালেন্স hero (wallet আইকন), quick-pick credit chip বাটন + custom input, dashed-border প্রাইস ব্রেকডাউন কার্ড, একই collapsible ম্যানুয়াল পেমেন্ট প্যাটার্ন, invoice-row history + PDF ডাউনলোড বাটন

সব existing design token (`--background/--foreground/--surface/--surface-soft/--border/--muted/--accent`) এবং `catv-panel` shared card class অপরিবর্তিত রাখা হয়েছে (CONTEXT.md §22 design consistency policy মেনে) — শুধু ভেতরের composition/spacing/icon যোগ করে modern feel আনা হয়েছে, নতুন কোনো hardcoded color/arbitrary card style তৈরি হয়নি।

### 7.4 Verification

- **PDF রেন্ডারিং**: rollback-wrapped tinker দিয়ে test invoice generate করে `pdftoppm` (নতুন ইনস্টল করা `poppler-utils`) দিয়ে PNG-তে কনভার্ট করে visually inspect করা হয়েছে — 3 iteration লেগেছে (①গ্লোবাল Noto ফন্টে Latin spacing bug ধরা পড়ে, ②scoped font-এ fix করার পর item-label-এ ৳ tofu ধরা পড়ে, ③label/note split দিয়ে fix) — চূড়ান্ত রেজাল্ট ক্লিন, professional, উভয় Latin ও Bengali/৳ গ্লিফ সঠিক
- **Backend:** `php -l` clean সব ফাইলে, `php artisan route:list --path=invoice` দিয়ে ৪টা নতুন invoice route কনফার্ম
- **Frontend:** `npx tsc --noEmit` clean, `npm run deploy:prod:safe` 8/8 pass
- **Live HTTP round-trip** (`bsol.zyrotechbd.com`): `GET /subscription/payments/{id}/invoice` ও `GET /sms/credit/purchases/{id}/invoice` উভয়েই `200`, `Content-Type: application/pdf`, `Content-Disposition: inline` — `pdfinfo` দিয়ে valid single-page A4 PDF কনফার্ম
- **লাইভ ব্রাউজার যাচাই** (claude-in-chrome দিয়ে, seeded test user + localStorage token সহ, session শেষে সব cleanup করা হয়েছে): উভয় পেজ light ও dark theme-এ স্ক্রিনশট নিয়ে visual QA করা হয়েছে — hero card, countdown, package grid, invoice preview, payment section, history rows সব সঠিকভাবে রেন্ডার হয়েছে; history রো-তে PDF ডাউনলোড আইকনে ক্লিক করে **প্রকৃত ব্রাউজার ফ্লো দিয়ে** নতুন ট্যাবে blob PDF খুলে confirm করা হয়েছে (`openAuthenticatedPdf` end-to-end কাজ করে)
- Mobile viewport resize এই সেশনের browser tool-এ কাজ করেনি (remote Chrome window resize সীমাবদ্ধতা) — deep mobile-viewport visual QA করা যায়নি, কিন্তু ব্যবহৃত সব Tailwind class (`sm:`, `flex-wrap`, `grid gap-3 sm:grid-cols-2 lg:grid-cols-4`) বাকি কোডবেসের established mobile-first প্যাটার্ন অনুসরণ করে

### 7.5 যা এই ফেজে করা হয়নি
- Mobile viewport-এ সরাসরি visual QA (টুল সীমাবদ্ধতা, §7.4-এ নোট)
- Admin billing/sms-credit পেজে invoice PDF ডাউনলোড বাটন (এই ফেজ শুধু seller-facing পেজ কভার করেছে; admin থেকেও চাইলে একই endpoint pattern দিয়ে সহজে যোগ করা যাবে)
- PDF-এ platform logo/letterhead image (এখন শুধু টেক্সট ব্র্যান্ডিং)

---

## 8. Phase 4 — দ্বিতীয় দফা visual redesign (2026-08-10, একই দিন)

User feedback: "সাবসক্রিপশন এবং SMS ক্রেডিট কেনার UI ডিজাইন আমার কাছে ভাল লাগে নাই। ডিজাইন আরো উন্নত করা দরকার।" প্রশ্ন করে জানা যায় user layout/structure, রঙ/visual style, typography/spacing — সবগুলোতেই আরও উন্নতি চান, এবং সম্পূর্ণ concept বদলাতে রাজি; নির্দিষ্ট কোনো reference/inspiration নেই, agent-কে প্রস্তাব দিতে বলা হয়েছে।

### 8.1 Design approach
CONTEXT.md §22 (design consistency policy) অনুযায়ী `catv-panel` shell/border-radius/shadow এবং token family (`--background/--foreground/--surface/--surface-soft/--border/--muted/--accent`) অপরিবর্তিত রাখা হয়েছে — শুধু ভেতরের visual composition-এ বড় ধরনের upgrade আনা হয়েছে:
- **Hero card**: radial `ProgressRing` (SVG, বর্তমান মেয়াদের কত % বাকি তা দেখায়) + decorative blurred accent "glow" blob background (`GlowBackdrop`)
- **Package pricing card**: pure CTA-button-style bottom action area (আগে ছিল শুধু center-aligned টেক্সট), variable-height card grid-এ flex-column + flex-1 spacer দিয়ে bottom-aligned CTA, "সবচেয়ে জনপ্রিয়/Most Popular" badge (heuristic: সবচেয়ে সস্তা upgrade-able প্যাকেজ, না থাকলে মিডল-প্রাইসড প্যাকেজ — pure presentational, কোনো নতুন backend data লাগেনি)
- **Invoice/price-breakdown**: dashed-border "রসিদ" কার্ড (`ReceiptCard`/`ReceiptRow`), positive/muted/bold tone variants
- **Payment section**: bKash বাটনে brand-pink gradient, ফাইল আপলোড ইনপুট Tailwind `file:` variant দিয়ে স্টাইল করা কাস্টম বাটন লুক
- **History**: flat row থেকে বদলে status-color-coded left accent bar + icon badge circle সহ `HistoryRow`

### 8.2 নতুন shared component ফাইল
- **নতুন** `frontend/src/components/billing-ui.tsx` — `SectionHeader`, `StatusPill`, `GlowBackdrop`, `ProgressRing`, `ReceiptCard`, `ReceiptRow`, `HistoryRow`। সাবস্ক্রিপশন ও SMS-credit উভয় পেজ এখন এই একই shared component সেট রিইউজ করে (আগে দুই পেজেই duplicate `StatusPill` ছিল) — দুই পেজের মধ্যে visual consistency এবং future maintenance সহজ হয়েছে।

### 8.3 পরিবর্তিত ফাইল
- `frontend/src/app/dashboard/settings/subscription/page.tsx` — শুধু JSX/presentation redesign, সব state/effect/handler/API call অবিকল রাখা হয়েছে
- `frontend/src/app/dashboard/sms/credit/page.tsx` — একই, শুধু presentation redesign

### 8.4 Verification
- `npx tsc --noEmit` clean
- `npm run deploy:prod:safe` (এই সেশনে root/sudo সহ চালাতে হয়েছে — `chown`/`systemctl restart`-এর জন্য `claude-dev` ইউজারের `/etc/sudoers.d`-এ ইতিমধ্যে NOPASSWD whitelist আছে `deploy-safe.sh`-এর জন্য, `sudo -n /var/www/hybrid-stack/frontend/scripts/deploy-safe.sh` দিয়ে রান করা হয়েছে) — 8/8 pass
- **লাইভ ব্রাউজার QA** (claude-in-chrome দিয়ে, নতুন seeded test user `design-qa-temp@example.com` + Sanctum token localStorage-এ বসিয়ে, active subscription + SMS balance + একটা approved subscription payment + একটা pending SMS credit purchase দিয়ে): সাবস্ক্রিপশন পেজ dark+bn এবং light+bn, SMS credit পেজ light+en — hero ring, package grid (recommended badge, current/upgrade badge, bottom CTA alignment), receipt-style invoice/price breakdown, bKash gradient বাটন, history row (color bar + icon + status pill) সব সঠিকভাবে রেন্ডার হয়েছে; history-এর PDF ডাউনলোড আইকনে ক্লিক করে নতুন ট্যাবে blob PDF খুলে `openAuthenticatedPdf` end-to-end কনফার্ম করা হয়েছে
- টেস্ট user, payment, purchase, token — সব session শেষে DB থেকে মুছে ফেলা হয়েছে এবং delete confirm করা হয়েছে

### 8.5 যা এই ফেজে করা হয়নি
- Mobile viewport visual QA (Phase 3-এর মতোই একই tool সীমাবদ্ধতা)
- Admin billing/sms-credit পেজের ডিজাইন touch করা হয়নি (শুধু seller-facing পেজ scope-এ ছিল)

---

## 9. Phase 5 প্ল্যান — Order Quota Redesign + Add-on/Credit System + Feature Access Control (2026-08-23, প্ল্যানিং)

User request (সংক্ষেপে, ২০২৬-০৮-২৩): মাসিক অর্ডার লিমিট এখন অর্ডার-**তৈরির** সময় ব্লক করে — এটা বদলে অর্ডার-**প্রসেসিং**-এর সময় ব্লক করা (আনলিমিটেড pending রাখা যাবে), অতিরিক্ত অর্ডার-প্রসেসিং-এর জন্য Add-on ক্রেডিট প্যাকেজ কেনা যাবে, ল্যান্ডিং পেজ/স্টোরফ্রন্ট/ফেসবুক-ট্র্যাকিং-ও প্যাকেজভিত্তিক + Add-on দিয়ে আনলক করা যাবে, এবং পুরো প্ল্যাটফর্মের জন্য একটা ফিচার/মডিউল অ্যাক্সেস কন্ট্রোল সিস্টেম দরকার — সুপার অ্যাডমিন প্যাকেজ ও Add-on দুটোই তৈরি/পরিচালনা করতে পারবে।

### 9.1 এই প্ল্যানের ভিত্তি — বর্তমান কোডবেস অডিট (গবেষণা করে যাচাই করা, অনুমান না)

| যা দরকার | বর্তমান অবস্থা |
|---|---|
| Proration/invoice ইঞ্জিন | ✅ আছে — `SubscriptionInvoiceService` (§2-§5), reusable |
| Package upgrade/downgrade/renewal lifecycle | ✅ আছে — `SubscriptionActivationService`, `ExpireSubscriptions` কমান্ড |
| bKash dual payment path (manual + PGW/Tokenized, auto-verify + admin-approve queue) | ✅ আছে, দুইবার প্রমাণিত প্যাটার্ন (subscription §5, SMS credit §6) |
| Wallet + ledger + self-service purchase প্যাটার্ন | ✅ আছে — SMS credit (`SmsCredit`, `SmsCreditHistory`, `SmsCreditPurchase`) হুবহু এই দরকারের টেমপ্লেট |
| PDF ইনভয়েস | ✅ আছে — `InvoicePdfService`, generic (নতুন payment টাইপের জন্য সহজে এক্সটেন্ড করা যায়) |
| Package-এ `features` (json) কলাম | ✅ কলাম আছে, admin CRUD-এও validate হয় (`AdminController::createPackage/updatePackage`) — **কিন্তু কোথাও enforce হয় না।** ফাঁকা placeholder |
| Order quota enforcement | ⚠️ **আছে কিন্তু ভুল জায়গায়** — `OrderController::store()` লাইন ১৯৫-এ **অর্ডার তৈরির সময়** ব্লক করে (এই মাসের মোট অর্ডার ≥ `max_orders` হলে 402)। `OrderBulkImportController`-ও একই যুক্তি রিইউজ করে। User-এর নতুন আইডিয়া অনুযায়ী এটা **প্রসেসিং-এ সরাতে হবে** — `OrderController::updateStatus()`/`bulkStatus()` (লাইন ৪৪৭/৪৬৮) |
| Landing page limit | ❌ কোনো লিমিট নেই — সেলার যত খুশি landing page বানাতে পারে, ফ্রি |
| Landing page publish/unpublish state | ✅ `landing_pages.status` কলাম আগে থেকেই আছে (`draft` ইত্যাদি) — নতুন কলাম লাগবে না, শুধু নতুন state ব্যবহার (`unpublished_billing` বা বিদ্যমান enum রিইউজ) |
| Storefront gating | ❌ সব সেলারই স্টোরফ্রন্ট ব্যবহার করতে পারে, প্যাকেজ-নির্বিশেষে |
| Facebook tracking quota | ✅ `max_tracking_events_per_day` + `TrackingQuotaService` আছে (দৈনিক রিসেট) — কিন্তু **কোনো Add-on/top-up মেকানিজম নেই**, শুধু প্যাকেজ বদলে বাড়ানো যায় |
| Fraud checker / Block list / FB Leads অ্যাক্সেস কন্ট্রোল | ❌ কিছুই নেই — সব সেলার সব ফিচার পায় |
| Staff-permission মডিউল লিস্ট (তুলনার জন্য) | `StaffPermission::MODULE_KEYS` = orders, products, customers, courier, sms, accounting, analytics, landing_pages, fraud, facebook, tracking, payments, whatsapp — এটা "টিমের কে কী দেখবে", **প্যাকেজ ফিচার-গেট থেকে আলাদা ধারণা**, কিন্তু key-নাম পুনঃব্যবহার করলে সামঞ্জস্যপূর্ণ হবে |

**সারকথা:** billing **ইঞ্জিন** (proration/invoice/payment/wallet) ইতিমধ্যে শক্ত ভিত্তি — নতুন করে বানাতে হবে না। যা নতুন লাগবে তা হলো (ক) quota enforcement-এর জায়গা বদলানো, (খ) সেই ইঞ্জিন রিইউজ করে একটা generalized **Add-on/credit** স্তর, আর (গ) একটা **ফিচার-গেট** স্তর।

### 9.2 মূল আর্কিটেকচার সিদ্ধান্ত

**A. Order quota — "place free, process metered"**
- `OrderController::store()`/`OrderBulkImportController` থেকে বর্তমান creation-time 402 ব্লক **সরিয়ে ফেলা** — অর্ডার সবসময় `pending` হিসেবে তৈরি হবে, লিমিট নির্বিশেষে (কোনো লিড/অর্ডার হারানো যাবে না)।
- নতুন চেক **`OrderController::updateStatus()`/`bulkStatus()`-এ**, শুধু তখন যখন `status` **`pending` থেকে অন্য কিছুতে** যাচ্ছে (প্রথমবার — `confirmed`/`processing`/`shipped` যেকোনোটাই "প্রসেসিং শুরু" গণ্য হবে, `pending→cancelled` এর ক্ষেত্রে গোনা হবে না, কারণ সেটা fulfillment না)।
- মাসিক প্রসেসড-কাউন্ট = `Order::whereIn(shopUserIds)->whereYear/whereMonth(now)->where('status', '!=', 'pending')->count()` (একবার pending ছেড়ে গেলে সেই মাসের কোটাতেই গোনা থাকবে, পরে আবার pending-এ ফিরে গেলেও ডাবল-গণনা এড়াতে একটা `orders.quota_consumed_at` নতুন nullable timestamp কলাম রাখা ভালো — কাউন্ট এই কলামের উপর হবে, status string paর্স করার বদলে; race-condition নিরাপদ, `whereNull('quota_consumed_at')->lockForUpdate()` দিয়ে সেট করা যাবে)।
- কোটা শেষ হলে ও `order_credit_wallets` (নিচে §9.3) balance না থাকলে → 402 `quota_exceeded_at_processing`, ফ্রন্টএন্ডে "Add-on কিনুন" CTA। Balance থাকলে → ১ ক্রেডিট auto-deduct করে প্রসেসিং চলতে দেওয়া (silent, sms-credit deduct-এর মতোই ট্রানজ্যাকশন-সেফ)।
- **Bulk-status action-এ (`bulkStatus`)** একই লজিক row-by-row apply হবে — আংশিক সফল হতে পারে (কিছু row কোটার মধ্যে পড়বে, বাকিগুলো "কোটা শেষ" হিসেবে skip রিপোর্ট হবে, বাল্ক ইমপোর্টের `skipped_for_quota` প্যাটার্নের মতোই — নতুন কনভেনশন লাগবে না, এটাই প্রমাণিত UX)।

**B. Add-on/Credit সিস্টেম — SMS-credit প্যাটার্নের generalization**
- একটা নতুন সাধারণ (generic) জোড়া টেবিল: `addon_packages` (super-admin সংজ্ঞায়িত SKU) + `addon_purchases` (`subscription_payments`/`sms_credit_purchases`-এর সমান্তরাল — একই dual bKash flow reuse)। **কেন generic এবার:** SMS-credit episode-এ per-feature টেবিল pattern justify হয়েছিল কারণ SMS-এর নিজস্ব rate/wallet ইনফ্রা ছিল; এখানে ৪টা ভিন্ন addon-টাইপ (order credit, landing page, storefront, tracking) **পেমেন্ট/অ্যাপ্রুভাল/ইনভয়েস দিক থেকে হুবহু identical** — শুধু "approve হলে কী ঘটবে" (`apply()`) টাইপ-ভেদে আলাদা। তাই পেমেন্ট/লেজার স্তর এক টেবিলে (DRY), effect-লজিক প্রতি-টাইপ ছোট আলাদা মেথডে (established "ছোট duplication" নীতি effect-এ বজায় থাকছে, পুরো টেবিলে না)।
  - `addon_packages`: `id, type (enum: order_credit|landing_page|storefront|tracking_boost), name, price, quantity (nullable — order_credit-এ কতগুলো অর্ডার-ক্রেডিট, tracking_boost-এ দৈনিক ইভেন্ট বোনাস কত; landing_page/storefront-এ ব্যবহৃত হয় না, সবসময় ১ ইউনিট), duration_days (nullable — order_credit-এর নিজস্ব মেয়াদ থাকে (user-এর আইডিয়া: ১ মাস); landing_page/storefront/tracking_boost **co-terminous** — মেইন সাবস্ক্রিপশনের bakি মেয়াদ অনুযায়ি চলে, নিজস্ব duration লাগে না), is_active`।
  - `addon_purchases`: `subscription_payments`-এর কলাম হুবহু কপি (`user_id, addon_package_id, amount, payment_method, sender_bkash_number, trx_id, screenshot_path, bkash_payment_id, status, admin_note, reviewed_by, reviewed_at`) + `applied_at` (nullable — approve/auto-verify হওয়ার পর effect apply হলে সেট হয়, idempotency guard)।
  - Payment routes/controllers: existing `SubscriptionController`/`SmsCreditPurchaseController` ও তাদের bKash controller-দ্বয়ের প্যাটার্ন **হুবহু কপি** (নতুন gateway client লাগবে না, `BkashPaymentGatewayClient`/PGW client রিইউজ)।
  - Admin approve → `AddonApplyService::apply(AddonPurchase $purchase)` — `type` অনুযায়ী branch:
    - `order_credit` → `order_credit_wallets` (user_id, balance, expires_at) আপডেট (নিচে ৯.৩-এ ব্যালেন্স/মেয়াদ নিয়ম)
    - `landing_page` → seller-এর "included + addon" ল্যান্ডিং পেজ কোটা +১ (একটা কাউন্টার কলাম বা লাইভ কাউন্ট — নিচে দেখুন)
    - `storefront` → `shop_profiles`/`storefront_settings`-এ একটা `storefront_unlocked_until` timestamp (মেইন সাবস্ক্রিপশনের `subscription_ends_at`-এর সাথে **সবসময় sync** থাকবে — renewal cron-এই রিফ্রেশ হবে, নিচে দেখুন)
    - `tracking_boost` → `TrackingQuotaService`-এর দৈনিক লিমিট হিসাবে `max_tracking_events_per_day + বোনাস` (বোনাসও মেইন প্যাকেজের মেয়াদ অনুযায়ী co-terminous)

**C. ল্যান্ডিং পেজ — "প্যাকেজ-ইনক্লুডেড + Add-on, মেইন-সাইকেল-সহ-এক্সপায়ার, আনপাবলিশ-না-ডিলিট"**
- `subscription_packages`-এ নতুন `included_landing_pages` (int, default অনুযায়ি — উদাহরণ ১)।
- সেলারের "মোট allowed" = `package.included_landing_pages + approved landing_page addon_purchases-এর সংখ্যা (যেগুলো এখনো active — নিচে দেখুন)`।
- Landing page তৈরি/পাবলিশ করার সময় (`LandingPageController::store/publish`) চেক: বর্তমান published/active ল্যান্ডিং পেজ সংখ্যা < allowed হলেই পাবলিশ করতে দেবে, নাহলে "Add-on কিনুন" 402।
- **Addon-এর নিজস্ব expiry নেই** — মেইন সাবস্ক্রিপশন renew না হলে (ExpireSubscriptions cron যেভাবে ইতিমধ্যে `subscription_status` expire করে), সেই মুহূর্তে allowed-count মেইন প্যাকেজের `included_landing_pages`-এ ফিরে যাবে (addon purchase row থেকে যায়, শুধু "active" গণনা বন্ধ হয়) — একটা নতুন cron ধাপ (`ExpireSubscriptions`-এই যোগ করা, নতুন কমান্ড না) allowed-count-এর বাইরে থাকা পাবলিশড ল্যান্ডিং পেজগুলোকে (created_at ক্রম অনুযায়ী পুরোনোগুলো priority, নাকি সবচেয়ে নতুনগুলো unpublish — এটা §9.5-এ একটা open decision হিসেবে রাখা হলো) `status = 'unpublished_billing'`-এ নামাবে — **ডিলিট না**, স্টোরফ্রন্টে ৪০৪ দেখাবে কিন্তু ড্যাশবোর্ডে সম্পাদনযোগ্য থাকবে, বিল দিলে এক ক্লিকে পুনরায় পাবলিশ।
- Renewal-এর ইনভয়েসে ল্যান্ডিং পেজ addon-এর দামও automatic যোগ হবে (user-এর আইডিয়া অনুযায়ী) — এটা `SubscriptionInvoiceService::compute()`-এ ইতিমধ্যে থাকা `invoice_breakdown` লিস্টের ধাঁচেই একটা নতুন লাইন-আইটেম হিসেবে যোগ করা সহজ (সার্ভিস already একটা structured breakdown array রিটার্ন করে)।

**D. স্টোরফ্রন্ট — বাইনারি gated module, কোটা না**
- `subscription_packages.features` জসনে `"storefront": true/false` (ছোট প্যাকেজে false ডিফল্ট)।
- Addon কিনলে বাইনারি আনলক (co-terminous, ✅/❌ কোনো কোটা লজিক লাগে না — landing page-এর চেয়ে সহজ)।
- Enforcement: নতুন middleware `package_feature:storefront` (নিচে ৯.২-E) `/store/*` এবং `/dashboard/settings/storefront/*` route group-এ।
- মেয়াদ শেষে/বিল না দিলে পুরো `/store/*` (public storefront) সেই সেলারের জন্য একটা "সাময়িক বন্ধ" পেজ দেখাবে — ডিলিট/ডেটা-লস কিছুই না, শুধু গেট বন্ধ।

**E. ফিচার/মডিউল অ্যাক্সেস কন্ট্রোল — নতুন `package_feature` middleware (Pattern C)**
- এই কোডবেসে ইতিমধ্যে দুইটা middleware প্যাটার্ন আছে: Pattern A `staff_permission:{module}` (টিমের কে কী দেখবে) ও Pattern B `owner_only` (owner-বনাম-staff)। এটা তৃতীয়, **অর্থোগোনাল** স্তর: "এই **shop**-এর প্যাকেজে এই ফিচার আছে কি না" — owner/staff নির্বিশেষে পুরো shop-এর জন্য প্রযোজ্য।
- নতুন `EnsurePackageFeature` middleware (alias `package_feature:{key}`, ফাইল `feature_flags` কলামে — `features` display-bullet-list থেকে ইচ্ছাকৃতভাবে আলাদা, কারণ ওটা raw string বুলেট (admin-টাইপ করা মার্কেটিং কপি, কোনো lookup নেই), enforcement key না)। **Default-allow, default-deny না** — বাস্তবায়নের সময় ধরা পড়েছে (§9.7-এ verification log) যে এই কোডবেসের প্রতিটা বিদ্যমান প্যাকেজ-লিমিট (`max_orders`/`max_tracking_events_per_day`/`max_staff`) একই কনভেনশন মানে: প্যাকেজ/ফিল্ড না থাকলে **আনরেস্ট্রিক্টেড** ধরা হয়, ব্লক না। তাই এখানেও: `feature_flags[$key] === false` হলেই শুধু ব্লক (402 + `{error_code: 'feature_not_in_plan', feature: $key}`), key অনুপস্থিত/null হলে allow — admin কোনো প্যাকেজকে ফিচার থেকে explicitly **বাদ** দেয়, ইন করে না। এই সিদ্ধান্তটা মূল প্ল্যানের "default-deny" ধারণা থেকে সংশোধিত (নিচে §9.7 দেখুন কেন)।
- ফিচার-কী লিস্ট **`StaffPermission::MODULE_KEYS`-এর সাথে যতটা সম্ভব নাম মেলানো** (সামঞ্জস্যের জন্য, যদিও ধারণা আলাদা): `facebook` (FB Pixel tracking + Leads), `fraud` (fraud checker), `block_list` (নতুন, block list এখন কোনো module key-তে নেই — এটাও যোগ করা লাগবে `StaffPermission::MODULE_KEYS`-এ যদি স্টাফ-লেভেলে আলাদা করে গেট করতে হয়), `storefront`, `bulk_import` (P3-এর bulk order import), ইত্যাদি — **কোন কোনগুলো আসলে gate করা হবে সেটা user-এর সাথে কনফার্ম করা দরকার (§9.5)**, সবগুলো module একসাথে গেট করা শুরু থেকেই বিভ্রান্তিকর হতে পারে।
- Route-এ প্রয়োগ যেমন: `Route::middleware(['auth:sanctum','package_feature:facebook'])->group(...)` — বিদ্যমান রুট গ্রুপগুলোর উপরে একটা অতিরিক্ত middleware যোগ (existing `staff_permission:facebook` group-এর *ভেতরে* বসবে, দুটো ভিন্ন প্রশ্নের উত্তর দেয়: "টিমমেম্বারের access আছে?" + "shop-এর প্যাকেজে আছে?")।
- ফ্রন্টএন্ড: `user-shell.tsx`-এর মেনু আইটেম প্যাকেজ `features` অনুযায়ী hide/lock-badge — dashboard bootstrap response-এ (যেটা এখন `subscriptionPackage` লোড করে) `features` অবজেক্টও পাঠাতে হবে যদি না ইতিমধ্যে যাচ্ছে (চেক করা লাগবে বিল্ড-টাইমে)।

### 9.3 সিদ্ধান্ত — user কনফার্ম করেছেন (2026-08-23)

1. **Order-credit ওয়ালেট মডেল** — ✅ **single-balance + refreshing মেয়াদ**: নতুন addon কেনার সাথে সাথে `balance += quantity`, `expires_at = now()->addDays(duration_days)` (আলাদা "লট"/FIFO ট্র্যাকিং না)।
2. **অব্যবহৃত order-credit মাস শেষে** — ✅ মেয়াদ শেষে উবে যাবে, rollover/refund নেই।
3. **কোটা "consume" হওয়ার মুহূর্ত** — ✅ `pending → confirmed` (প্রথম non-pending স্ট্যাটাসে ট্রানজিশনেই ১ কোটা/ক্রেডিট কাটবে)।
4. **কোটা রিফান্ড** — ✅ **না, ফেরত হবে না** — একবার consume হলে অর্ডার পরে cancel/revert হলেও কোটা/ক্রেডিট ফেরত আসবে না (misuse-সুযোগ বন্ধ রাখার জন্য, ইচ্ছাকৃত সিদ্ধান্ত)।
5. **প্রথম ধাপে কোন মডিউল ফিচার-গেট হবে** — ✅ **`storefront` + `facebook`** (FB tracking + FB leads) দিয়ে শুরু। `fraud`/`block_list` আপাতত gate করা হচ্ছে না (সব প্যাকেজে ফ্রি থাকবে — risk-reduction ফিচার সীমিত করলে উলটো COD-fraud ক্ষতি বাড়তে পারে)।
6. ~~ল্যান্ডিং পেজ addon মেয়াদ শেষে unpublish selection~~ — **বাতিল** (২০২৬-০৮-২৩, user-এর নির্দেশনায় স্কোপ সরলীকৃত): ল্যান্ডিং পেজে কোনো addon নেই, শুধু প্যাকেজ-ভিত্তিক ফ্ল্যাট মোট-সংখ্যা লিমিট (creation-time cap, unpublish/cron কিছুই নেই)। বিস্তারিত §১২।

### 9.4 সুপার অ্যাডমিন ম্যানেজমেন্ট সারফেস

- **Package CRUD এক্সটেনশন** (বিদ্যমান `AdminController::createPackage/updatePackage`) — নতুন ফিল্ড: `included_landing_pages`, `features` (এখন থেকে আসলে enforce হবে, UI-তে checkbox গ্রিড হিসেবে দেখানো ভালো টেক্সট-জসনের বদলে)।
- **নতুন Addon Package CRUD** (`AdminAddonPackageController` — `AdminController`-এর package মেথডগুলোর প্যাটার্ন হুবহু) — টাইপ অনুযায়ী ফর্ম (order_credit-এ quantity+duration, landing_page/storefront-এ শুধু নাম+দাম, tracking_boost-এ quantity)।
- **নতুন Addon Purchase approve/reject queue** (`AdminAddonPurchaseController` — `AdminSubscriptionController::approvePayment/rejectPayment` প্যাটার্ন) — approve হলে `AddonApplyService::apply()` কল।
- এই তিনটাই বিদ্যমান admin billing UI-এর (`/admin/billing`, `/admin/sms/credit`) পাশে নতুন ট্যাব/সেকশন হিসেবে ফিট করবে, নতুন আলাদা admin area লাগবে না।

### 9.5 পেমেন্ট ফ্লো — কিছুই নতুন উদ্ভাবন না

Addon purchase-এর পুরো পেমেন্ট পাইপলাইন (manual bKash + bKash PGW dual path, admin approve queue, PDF ইনভয়েস) **subscription ও SMS-credit-এ ইতিমধ্যে দুইবার প্রমাণিত** — তৃতীয়বার একই প্যাটার্ন কপি করাই সঠিক পথ, নতুন গেটওয়ে/ফ্লো ডিজাইন করার দরকার নেই।

### 9.6 প্রস্তাবিত বিল্ড অর্ডার (priority)

এই ফিচার-সেট নিজেই একাধিক sub-phase — নিচেরটা যুক্তিসঙ্গত ক্রম (প্রতিটার পর deploy + live-verify, এই সেশনের established discipline):

1. **Feature-gate ফাউন্ডেশন** (§9.2-E) — `package_feature` middleware + `features` json কে সত্যিকারের enforcement দেওয়া। ছোট, স্বতন্ত্র, বাকি সবকিছু এর উপর নির্ভর করে।
2. **Order quota redesign** (§9.2-A) — creation-time ব্লক সরিয়ে processing-time-এ আনা। এটা core order flow-তে behavior change, তাই আলাদাভাবে সাবধানে verify (regression risk সবচেয়ে বেশি এখানেই, কারণ এটা প্রোডাকশনে চলমান ফিচার বদলাচ্ছে, নতুন কিছু যোগ করছে না)।
3. **Order-credit addon** (§9.2-B, order_credit টাইপ) — ধাপ ২-এর সাথে ব্যবসায়িকভাবে সরাসরি যুক্ত, একসাথেই সবচেয়ে বেশি অর্থবহ।
4. **Generic addon infra + storefront addon** (§9.2-B/D) — সবচেয়ে সহজ টাইপ (বাইনারি, কোটা নেই) দিয়ে generic ফ্রেমওয়ার্ক প্রমাণ করা।
5. **Landing page addon + auto-unpublish** (§9.2-C) — জটিলতম (কোটা + বেছে-নেওয়া লজিক + cron), তাই সবার শেষে।
6. **Tracking boost addon** (§9.2-B, tracking_boost টাইপ) — landing page-এর প্যাটার্ন অনেকটা রিইউজ হবে, দ্রুত হওয়ার কথা।
7. SMS প্যাকেজ — **ইতিমধ্যে সম্পূর্ণ (Phase 2, §6)**, নতুন কাজ লাগবে না যদি না bulk-discount tier pricing চান (আগে সিদ্ধান্ত হয়েছিল flat-rate-ই রাখা, §6.4)।

প্রতিটা ধাপ শুরুর আগে §9.3-এর সংশ্লিষ্ট open question(গুলো) কনফার্ম করে নেওয়া — বিশেষ করে ধাপ ২/৩-এর আগে #1-#3, ধাপ ৫-এর আগে #4।

### 9.7 ধাপ ১ — Implementation log (2026-08-23, feature-gate ফাউন্ডেশন সম্পন্ন)

**যা তৈরি হয়েছে:**
- নতুন migration `2026_08_23_072100_add_feature_flags_to_subscription_packages_table.php` — `subscription_packages.feature_flags` (json, nullable)। **`features` কলাম রিইউজ করা হয়নি** — বিল্ডের সময় ধরা পড়ে যে `features` আসলে raw display-bullet-list (admin-টাইপ করা string, `<span>{f}</span>` দিয়ে verbatim রেন্ডার হয়, কোনো lookup নেই) এবং production-এর প্রতিটা প্যাকেজেই ইতিমধ্যে ভিন্ন উদ্দেশ্যের স্ট্রিং আছে (`fraud_check`, `sms_automation` ইত্যাদি) — সেটাকে enforcement key হিসেবে পুনর্ব্যবহার করলে মার্কেটিং কপি এডিট করলেই access বদলে যেত। তাই আলাদা কলাম।
- Migration-এর `up()`-এ **সব বিদ্যমান প্যাকেজ** (Trial/Free Trial/Starter/Growth/Business) explicitly `{"storefront": true, "facebook": true}`-এ grandfather করা হয়েছে — প্রোডাকশনে migrate করার পর সরাসরি `tinker`-এ কনফার্ম করা হয়েছে ৫টা প্যাকেজেই সঠিকভাবে বসেছে।
- নতুন `app/Http/Middleware/EnsurePackageFeature.php` (alias `package_feature:{key}`)।
- Route wiring: `storefront-settings` গ্রুপে `package_feature:storefront`; Facebook connect/pixel/tracking-destinations, tracking usage/events, facebook/leads গ্রুপগুলোতে `package_feature:facebook`।
- `StorefrontCatalogController::home()`-এ (public, unauthenticated) সরাসরি ইনলাইন চেক — Sanctum middleware চালানোর কোনো session নেই বলে।
- `AdminController::createPackage/updatePackage` — `feature_flags` validation যোগ।
- `frontend/src/app/admin/packages/page.tsx` — Storefront/Facebook checkbox দুটো create ফর্ম ও edit modal দুটোতেই যোগ।

**🔧 প্ল্যান থেকে সংশোধন — default-allow, default-deny না:** মূল প্ল্যানে (§9.2-E) "default-deny" লেখা ছিল (`EnsureStaffPermission`-এর মতো)। বিল্ডের সময় isolated schema-তে পুরো সুইট চালিয়ে ধরা পড়ে — ৪৯টা প্রি-এক্সিস্টিং টেস্ট রিগ্রেস করেছে (Facebook/Storefront/Tracking-সংশ্লিষ্ট সব টেস্ট, যেগুলো কোনো subscription package ছাড়াই `User::factory()->create()` ব্যবহার করে)। কারণ খুঁজে বের করে দেখা যায়: এই কোডবেসের **প্রতিটা বিদ্যমান প্যাকেজ-লিমিট** (`max_orders`, `max_tracking_events_per_day`, `max_staff` — `OrderController`/`TrackingQuotaService`/`StaffController`) already `null = আনরেস্ট্রিক্টেড` কনভেনশন মানে, প্যাকেজ না থাকলে ব্লক করে না। তাই সিদ্ধান্ত বদলে **default-allow**-এ আনা হয়েছে: `feature_flags[$key] === false` হলেই শুধু ব্লক, key/প্যাকেজ অনুপস্থিত হলে allow। এতে (ক) বাকি কোডবেসের সাথে সামঞ্জস্যপূর্ণ, (খ) admin এখন থেকে কোনো প্যাকেজকে ফিচার থেকে explicitly **বাদ** দেবে (নতুন প্যাকেজ ডিফল্টে ওপেন থাকবে)। §9.2-E ও §9.3-এর ওপরের টেক্সট এই সংশোধন অনুযায়ী আপডেট করা হয়েছে।

**Verification:**
- Isolated pgsql schema (`test_1787469757`): migration ক্লিন, প্রথম রানে ৫২টা রিগ্রেশন ধরা পড়ে (উপরের কারণে), default-allow-এ সংশোধনের পর পুনরায় রান — **শুধু ৩টা known baseline failure** (AuthApiTest, CourierFraudCheckApiTest, ProductMediaApiTest — অপরিবর্তিত), ৫২০ পাস।
- নতুন `tests/Feature/EnsurePackageFeatureTest.php` (৮টা টেস্ট, সব পাস): no-package-allowed, null-flags-allowed, explicit-false-blocks (402 + error_code/feature), explicit-true-allowed, per-key-independence, staff-checked-against-owners-package (staff permission + plan gate দুটো আলাদা axis প্রমাণ), public storefront home locked/open।
- `npx tsc --noEmit` clean, `deploy-safe.sh` 8/8 pass।
- **লাইভ প্রোডাকশন ভেরিফিকেশন** (`bsol.zyrotechbd.com`, disposable test package+user+shop, tinker দিয়ে তৈরি, সেশন শেষে সব মুছে ফেলা হয়েছে): `feature_flags:{storefront:false}` সেট করা ইউজার দিয়ে `GET /storefront-settings` → `402 feature_not_in_plan/storefront` (সঠিক), একই ইউজারের `GET /facebook/pixel` (untouched key) → `200` (সঠিক, per-key independence প্রমাণিত), locked subdomain-এ `GET /public/storefront/home` → `402` (সঠিক)। সব টেস্ট ডেটা (user, package, shop profile, token) মুছে ফেলা হয়েছে এবং delete কনফার্ম করা হয়েছে।

**যা এই ধাপে করা হয়নি (out of scope, পরে):**
- Frontend UX পলিশ — `feature_not_in_plan` রেসপন্স পেলে dashboard-এর storefront settings/Facebook পেজগুলো এখনো generic error দেখাবে (crash করবে না, কিন্তু "আপগ্রেড করুন" ধরনের বিশেষ মেসেজ/CTA নেই)। `user-shell.tsx`-এ মেনু আইটেম হাইড/লক-ব্যাজও যোগ করা হয়নি। ফিচার এনফোর্সমেন্ট (ব্যাকএন্ড) সম্পূর্ণ কাজ করে, শুধু ফ্রন্টএন্ড মেসেজিং এখনো generic।
- Admin প্যাকেজ লিস্ট টেবিলে feature-flag badge/কলাম (এডিট মোডালে দেখা যায়, লিস্ট ভিউতে না)।

### 9.8 ধাপ ২ — Implementation log (2026-08-23, order quota redesign সম্পন্ন)

**যা তৈরি হয়েছে:**
- নতুন migration `2026_08_23_090000_add_quota_consumed_at_to_orders_table.php` — `orders.quota_consumed_at` (nullable timestamp, `['user_id','quota_consumed_at']` ইনডেক্স)। ইচ্ছাকৃতভাবে `Order::$fillable`-এ নেই — শুধু `OrderStatusService`-এর atomic claim দিয়েই সেট হয়, কখনো client-writable না।
- **একক choke point আবিষ্কার ও ব্যবহার:** কোটা-চেক বসানোর আগে খুঁজে বের করা হয় যে `OrderController::updateStatus()`/`bulkStatus()` ছাড়াও কুরিয়ার স্ট্যাটাস-সিঙ্ক, WooCommerce স্ট্যাটাস-সিঙ্ক, অনলাইন-পেমেন্ট-কনফার্ম, চেকআউট OTP, ডিজিটাল-ডেলিভারি — মোট ৮টা জায়গা সরাসরি `OrderStatusService::transition()` কল করে। তাই কোটা-চেক controller-এ ডুপ্লিকেট না করে সরাসরি `transition()`-এর ভেতরে বসানো হয়েছে (একবার লেখা, সব পাথ কভার — কোনো bypass loophole থাকে না)।
- **লজিক:** `$order->quota_consumed_at === null && $newStatus !== 'pending'` হলে `consumeProcessingQuotaOrFail()` — মাসিক প্রসেসড-কাউন্ট এখন `quota_consumed_at`-এর মাস/বছর দিয়ে গণনা হয় (আগে `created_at` দিয়ে হতো, যেটা creation-time ব্লকের জন্য ছিল)। কোটা শেষ হলে `ValidationException` (stock-check-এর existing প্যাটার্নের মতোই) কিন্তু `->status = 402` সেট করে — Laravel-এর default JSON renderer এই status honor করে, তাই `bulkStatus()`-এর বিদ্যমান `catch (ValidationException $e)` ব্লক (স্টক-ব্যর্থতার মতোই per-row "failed" রিপোর্ট করে, পুরো ব্যাচ থামে না) কোনো পরিবর্তন ছাড়াই কোটা-ব্যর্থতাও একইভাবে হ্যান্ডেল করে। কোটা claim atomic (`whereNull('quota_consumed_at')->update(...)`) — একই অর্ডারে concurrent transition রেসে ডাবল-কনজিউম হবে না।
- **`OrderController::store()` ও `OrderBulkImportService::commit()`/`OrderBulkImportController`** — creation-time ব্লক সম্পূর্ণ সরানো হয়েছে (আগের মতো `max_orders` চেক নেই)। Bulk-import-এর `remainingQuota`/`skipped_for_quota` মেকানিজম পুরো সরানো হয়েছে (এখন সব valid সারি সবসময় তৈরি হয়, আংশিক স্কিপ করার দরকার নেই) — ফ্রন্টএন্ড (`bulk-import/page.tsx`)-এও সংশ্লিষ্ট UI/টেক্সট সরানো হয়েছে।
- `ConnectOrderController::sync()` (WooCommerce order create) `OrderController::store()`-কেই ভেতরে ডাকে — তাই আলাদা কোনো পরিবর্তন লাগেনি, creation-time ব্লক ওখান থেকেও এমনিতেই সরে গেছে।

**Verification:**
- Isolated pgsql schema: migration ক্লিন। নতুন `tests/Feature/OrderProcessingQuotaTest.php` (৮টা টেস্ট) — creation কখনো ব্লক হয় না, প্রথম non-pending transition-এ কোটা কাটে, ৪০২ + সঠিক HTTP status, `max_orders=null` আনলিমিটেড কিন্তু তবুও স্ট্যাম্প হয়, cancel/pending-এ ফেরা refund দেয় না, shop-wide (staff-scoped) কোটা, bulk-status আংশিক-সফল রিপোর্টিং, single-update endpoint ৪০২। `OrderBulkImportTest.php` ও `ConnectApiTest.php`-এর পুরনো creation-time-quota টেস্ট দুটো নতুন আচরণ অনুযায়ী rewrite করা হয়েছে (ConnectApiTest-এ নতুন করে status-sync-এর মাধ্যমে কোটা এনফোর্স হওয়ার টেস্টও যোগ)। ফুল সুইট: ৫২৯ পাস, শুধু ৩টা known baseline failure।
- `npx tsc --noEmit` clean, `deploy-safe.sh` 8/8 pass।
- **লাইভ প্রোডাকশন ভেরিফিকেশন** (disposable package `max_orders:1` + user + product, tinker দিয়ে তৈরি, cleanup করা হয়েছে): দুটো অর্ডার তৈরি — দুটোই `201` (unlimited placement প্রমাণিত) → প্রথমটা confirm → `200`, response-এ `quota_consumed_at` স্ট্যাম্প দেখা গেছে → দ্বিতীয়টা confirm → `402` সঠিক মেসেজ সহ। সব টেস্ট ডেটা (২টা order+item+status_log, product, user, package, token) মুছে ফেলা হয়েছে এবং delete কনফার্ম করা হয়েছে।

**যা এই ধাপে করা হয়নি:** ধাপ ৩-এর (order-credit addon) সাথে integration এখনো নেই — কোটা শেষ হলে এখনো কেবল ব্লক হয়, addon কিনে auto-bypass করার কোনো hook এখনো যোগ হয়নি (§9.2-B-এ ডিজাইন করা আছে, বিল্ড বাকি)। Frontend-এ ৪০২ পেলে "Add-on কিনুন" ধরনের বিশেষ UI/CTA এখনো নেই (ব্যাকএন্ড এরর সঠিকভাবে propagate করে, ফ্রন্টএন্ড এখনো generic এরর টেক্সট দেখাবে)।

---

## 10. ধাপ ৩ — Implementation log (2026-08-23, Order-credit add-on সম্পন্ন)

**যা তৈরি হয়েছে (§9.2-B-এর জেনেরিক addon ইনফ্রা + order_credit-এর প্রথম টাইপ একসাথে — দুটো আলাদা করে বানানো অর্থহীন, ৯.৬-এর ধাপ ৩/৪ কার্যত মার্জ হয়ে গেছে):**
- ৫টা নতুন migration: `addon_packages` (super-admin SKU, `type` কলাম — শুধু `order_credit` আপাতত creatable, বাকি ৩টা reserved string), `addon_purchases` (subscription_payments-এর হুবহু কপি), `order_credit_wallets` (single-balance + refreshing `expires_at`, §9.3 decision #1/#2), `order_credit_histories` (transparency log), `orders.quota_source` (`'plan'|'addon_credit'|null` — নিচে দেখো কেন লাগল)।
- `AddonPackage`/`AddonPurchase`/`OrderCreditWallet`/`OrderCreditHistory` মডেল, `OrderCreditService` (grant/consumeOne/getAvailableBalance, lazy expiry — cron sweep নেই, "derived not stored" নীতি Getting Started checklist-এর মতোই), `AddonApplyService` (purchase approve হলে effect apply করে, idempotent, আপাতত শুধু `order_credit` branch)।
- Seller-facing: `OrderCreditPurchaseController` (packages/balance/history/myPurchases/submitPayment) + `/dashboard/order-credits` পেজ — **শুধু manual bKash** (bKash Tokenized/PGW automated gateway ইচ্ছাকৃতভাবে বাদ, deliberate fast-follow — subscription/SMS-credit-এর নিজস্ব Phase A-আগে-B/C precedent অনুসরণ করে)। **✅ ২০২৬-০৮-৩১: এই fast-follow (এবং storefront add-on-এরও একই গ্যাপ) এখন পূরণ হয়েছে — 7-provider automated gateway এখন এখানেও উপলব্ধ, subscription/SMS-credit-এর সাথেই একটাই শেয়ার্ড ইনফ্রা দিয়ে। বিস্তারিত `online_payment_context.md §১২`।
- Admin: `AdminAddonPackageController` + `AdminAddonPurchaseController` + `/admin/addon-packages` পেজ (প্যাকেজ CRUD + pending-purchase approve/reject queue একই পেজে)।
- **`quota_source` কেন লাগল:** addon credit দিয়ে কভার হওয়া অর্ডার প্ল্যানের নিজস্ব কোটা-কাউন্টে গোনা যাবে না (নাহলে ক্রেডিট কেনা অর্থহীন হয়ে যেত — প্রতিটা addon-covered অর্ডার চিরকাল প্ল্যান-কোটার বিরুদ্ধে গোনা থেকে যেত)। তাই `quota_consumed_at` (কবে consume হলো) আর `quota_source` (কী দিয়ে কভার হলো) দুটো আলাদা কলাম — মাসিক-প্রসেসড-কাউন্ট শুধু `quota_source='plan'` গোনে।
- **`OrderStatusService::consumeProcessingQuotaOrFail()` rewrite:** প্ল্যান-কোটা শেষ হলে এখন সরাসরি ব্লক না করে প্রথমে `OrderCreditService::consumeOne()` ট্রাই করে — ক্রেডিট থাকলে auto-deduct করে অর্ডার প্রসেস হতে দেয় (`quota_source='addon_credit'`), না থাকলে তবেই ৪০২।

**🔧 ধাপ ২-এর একটা লেটেন্ট atomicity বাগ এই ধাপেই ধরা পড়ে ফিক্স হয়েছে:** কোটা-consume + status-update + stock-adjust তিনটাই আলাদা ছিল না — কোটা-চেক আগের `DB::transaction()`-এর **বাইরে** ছিল। মানে stock-insufficient হয়ে transaction rollback হলেও কোটা/ক্রেডিট ইতিমধ্যে consume হয়ে যেত (ব্যর্থ attempt-এই টাকার মতো মূল্যবান ক্রেডিট নষ্ট হতো)। এখন `consumeProcessingQuotaOrFail()` কল same `DB::transaction()`-এর ভেতরে সরানো হয়েছে (nested transaction, savepoint দিয়ে সঠিকভাবে rollback হয়) — নতুন টেস্ট `test_a_failed_transition_never_spends_a_credit_or_a_quota_slot` এটা কভার করে।

**🐛 লাইভ ভেরিফিকেশনের সময় ধরা পড়া real বাগ:** `AddonPurchase`-এর Fillable-এ `applied_at` বাদ ছিল — `AddonApplyService::apply()`-এর নিজস্ব idempotency stamp (`$purchase->update(['applied_at' => now()])`) silently no-op হচ্ছিল (mass-assignment protection)। ক্রেডিট ঠিকই গ্রান্ট হচ্ছিল (grant() স্বাধীনভাবে কাজ করে) কিন্তু `apply()`-কে দ্বিতীয়বার সরাসরি কল করলে (controller-এর নিজস্ব status!=='pending' guard bypass করে) ডাবল-গ্রান্ট হতো — normal flow-এ এই বাগ ধরা পড়েনি কারণ controller-এর নিজস্ব guard কাকতালীয়ভাবে মাস্ক করে রেখেছিল। **ফিক্স:** Fillable-এ `applied_at` যোগ + নতুন টেস্ট (`test_apply_service_itself_is_idempotent_not_just_the_controller_guard`) যেটা controller guard bypass করে সরাসরি service-level idempotency টেস্ট করে।

**Verification:**
- Isolated pgsql schema: সব migration ক্লিন। নতুন `tests/Feature/OrderCreditAddonApiTest.php` (১১টা, seller purchase flow + admin CRUD/approve/reject + idempotency regression) ও `OrderProcessingQuotaTest.php`-এ ৫টা নতুন টেস্ট যোগ (addon fallback succeeds, addon-covered orders don't inflate plan count, both exhausted still blocks, expired wallet not used, failed transition never spends)। ফুল সুইট: প্রথমে ৫৪৪ পাস (৩টা baseline), Fillable বাগ ফিক্সের পর ৫৪৫ পাস — দুবারই শুধু ৩টা known baseline failure।
- `npx tsc --noEmit` clean, `deploy-safe.sh` 8/8 pass।
- **লাইভ প্রোডাকশন ভেরিফিকেশন** (disposable admin+seller+package+product, tinker দিয়ে তৈরি, cleanup করা হয়েছে): admin package তৈরি (`order_credit` টাইপ ✅, `landing_page` টাইপ ৪২২ রিজেক্ট ✅) → সেলার প্যাকেজ দেখল → পেমেন্ট সাবমিট (amount সার্ভার-সাইড হিসাব হয়েছে ৫.০০) → admin approve (এখানেই Fillable বাগ প্রথম ধরা পড়ে, ফিক্স করে আবার ডিপ্লয়) → balance 5 → দুটো অর্ডার তৈরি → প্রথমটা confirm (`quota_source: 'plan'`) → দ্বিতীয়টা confirm (প্ল্যান-কোটা শেষ, `quota_source: 'addon_credit'`, balance 5→4) — সব সঠিক। সব টেস্ট ডেটা (২টা অর্ডার+আইটেম+লগ, প্রোডাক্ট, ওয়ালেট+হিস্ট্রি, addon purchase+package, সেলার+অ্যাডমিন ইউজার+টোকেন, subscription package) মুছে ফেলা হয়েছে এবং delete কনফার্ম করা হয়েছে।

**যা এই ধাপে করা হয়নি:**
- **Automated bKash gateway (Tokenized+PGW)** — শুধু manual bKash flow, ইচ্ছাকৃত স্কোপ-কমানো (উপরে ব্যাখ্যা করা)।
- **PDF ইনভয়েস** — subscription/SMS-credit-এ যেমন আছে, order-credit purchase-এ এখনো নেই।
- **Frontend polish** — `/dashboard/order-credits` পেজ functional কিন্তু SMS-credit পেজের মতো ২ দফা visual redesign হয়নি (hero ring, receipt-card ইত্যাদি `billing-ui.tsx` shared component ব্যবহার করা হয়নি — খরচ/সময় বাঁচাতে সরল `catv-panel` লেআউট)। Admin `/admin/addon-packages` পেজেও `/admin/packages`-এর edit-modal নেই (শুধু create+delete, edit করতে হলে delete+recreate)।
- **৪০২ পেলে "Add-on কিনুন" CTA** — অর্ডার লিস্ট/স্ট্যাটাস-আপডেট UI-তে এখনো generic error, `/dashboard/order-credits`-এ deep-link করা হয়নি।

---

## 11. ধাপ ৪ — Implementation log (2026-08-23, Storefront add-on সম্পন্ন)

**যা তৈরি হয়েছে:**
- নতুন কলাম `users.storefront_addon_until` (nullable timestamp, ইচ্ছাকৃতভাবে `$fillable`-এ নেই)। ল্যান্ডিং-পেজ/ট্র্যাকিং-বুস্টের মতো নিজস্ব `duration_days` নেই — বাইনারি, মেইন সাবস্ক্রিপশনের সাথে **co-terminous**।
- নতুন `StorefrontAddonService` — `hasActiveAddon()`, `activate()` (কেনার সময় `subscription_ends_at`-এ anchor করে, active subscription না থাকলে ৩০ দিন fallback), `extendToMatchIfActive()` (renewal-এ sync করার জন্য, lapsed হলে no-op — কখনো বিনামূল্যে পুনরুজ্জীবিত করে না)।
- `SubscriptionActivationService::activate()`-এ hook যোগ — প্রতিটা renewal/upgrade-এ ইতিমধ্যে-সক্রিয় addon-কে নতুন `subscription_ends_at`-এর সাথে sync করে (co-terminous behavior-এর মূল বাস্তবায়ন)।
- `AddonPackage::CREATABLE_TYPES`-এ `storefront` যোগ। Admin ভ্যালিডেশনে `quantity`/`duration_days` এখন `order_credit`-এর জন্য conditional-required (`Rule::requiredIf`), storefront-এ প্রযোজ্য না।
- `AddonApplyService`-এ নতুন `storefront` branch — approve হলে `StorefrontAddonService::activate()` কল করে।
- `EnsurePackageFeature` middleware ও `StorefrontCatalogController::home()` দুটোতেই override যোগ — প্ল্যান storefront বাদ দিলেও active addon থাকলে allow (দুই জায়গাতেই একই লজিক ডুপ্লিকেট এড়াতে `StorefrontAddonService::hasActiveAddon()` reuse করা হয়েছে)।
- Seller-facing `StorefrontAddonPurchaseController` + `/dashboard/storefront-addon` (status/history/manual-bKash submit — বাইনারি বলে balance/wallet কনসেপ্ট নেই)। Admin-এর দিকে নতুন কিছু লাগেনি — `AdminAddonPurchaseController` আগে থেকেই generic (যেকোনো টাইপের purchase approve করতে পারে); শুধু `/admin/addon-packages` ফর্মে টাইপ-selector যোগ হয়েছে (order_credit/storefront টগল করলে quantity/duration ফিল্ড conditionally দেখায়/লুকায়)। **✅ ২০২৬-০৮-৩১: এখানেও automated gateway যোগ হয়েছে — দেখো order_credit-এর নোট, `online_payment_context.md §১২`।**

**🐛 লাইভ ভেরিফিকেশনের আগেই টেস্টে ধরা পড়া বাগ (আগের ধাপের একই ক্লাসের ভুল আবার হতে গিয়েছিল):** `StorefrontAddonService`-এ প্রথমে `$owner->update(['storefront_addon_until' => ...])` লেখা হয়েছিল — কিন্তু `storefront_addon_until` ইচ্ছাকৃতভাবে `User::$fillable`-এ নেই (client-writable না রাখার জন্য), তাই `update()` silently no-op করত (ধাপ ৩-এর `applied_at` বাগের হুবহু একই প্যাটার্ন)। টেস্ট লেখার সময়ই (deploy-এর আগে) ধরা পড়ে — ফিক্স: `forceFill(['storefront_addon_until' => ...])->save()`।

**Verification:**
- Isolated pgsql schema: migration ক্লিন। নতুন `tests/Feature/StorefrontAddonTest.php` (১২টা টেস্ট — service-level activate/extend/lapse-protection, co-terminous renewal sync (`SubscriptionActivationService` দিয়ে সরাসরি), `AddonApplyService` integration, `EnsurePackageFeature` override (allow+still-blocks-when-lapsed দুটোই), public storefront home override, admin conditional validation)। ফুল সুইট: ৫৫৭ পাস, শুধু ৩টা known baseline failure (একবার আগের রানে অসম্পর্কিত `CollectionHistoryApiTest`-এ একটা flaky failure দেখা গিয়েছিল, isolation-এ ৩ বার consistently pass করে কনফার্ম করা হয়েছে এই কাজের সাথে সম্পর্কহীন)।
- `npx tsc --noEmit` clean, `deploy-safe.sh` 8/8 pass।
- **লাইভ প্রোডাকশন ভেরিফিকেশন** (disposable plan (storefront বাদ) + seller + admin, tinker দিয়ে তৈরি): সেলার storefront-settings হিট করল → `402` সঠিক → admin storefront প্যাকেজ তৈরি করল → সেলার status দেখল (`addon_active:false`) → পেমেন্ট সাবমিট → admin approve → status আবার চেক (`addon_active:true`, `addon_until` = সেলারের `subscription_ends_at`-এর সাথে হুবহু মিলেছে) → storefront-settings আবার হিট → `200` (unlock কাজ করেছে) → **co-terminous renewal সিমুলেট** করা হয়েছে (`SubscriptionActivationService::activate()` সরাসরি কল করে) → `subscription_ends_at` ও `storefront_addon_until` দুটোই একসাথে ১ মাস বেড়েছে, হুবহু মিলেছে। সব টেস্ট ডেটা (purchase, package, subscription payment, সেলার+অ্যাডমিন ইউজার+টোকেন, plan) মুছে ফেলা হয়েছে।

**যা এই ধাপে করা হয়নি:**
- Automated bKash gateway — আগের ধাপের মতোই manual-only।
- `/dashboard/settings/storefront`-এ deep-link/CTA — locked অবস্থায় সেলার এখনো নিজে থেকে `/dashboard/storefront-addon`-এ যাওয়া লাগবে, সরাসরি লিঙ্ক করা হয়নি।

---

## 12. ধাপ ৫ — Implementation log (2026-08-23, ল্যান্ডিং পেজ লিমিট সম্পন্ন, স্কোপ সরলীকৃত)

**🔧 স্কোপ পরিবর্তন (user-এর সরাসরি নির্দেশনা):** মূল প্ল্যানের §9.2-C (ল্যান্ডিং পেজ addon + মেয়াদ-শেষে auto-unpublish + কোনগুলো unpublish হবে সেই সিদ্ধান্ত) **শেলফড** — user সরাসরি সহজ ভার্সন চেয়েছেন: **শুধু প্যাকেজ-ভিত্তিক একটা ফ্ল্যাট মোট-সংখ্যা লিমিট, কোনো addon না।** যেমন একটা প্যাকেজে ৫টা লিমিট থাকলে ৫টার বেশি ল্যান্ডিং পেজ তৈরিই করা যাবে না (draft+published একসাথে গোনা)। §9.3-এর open question #৬ (কোনগুলো auto-unpublish হবে) তাই আর প্রাসঙ্গিক না — বাতিল।

**যা তৈরি হয়েছে:**
- নতুন কলাম `subscription_packages.max_landing_pages` (nullable int, `null = আনলিমিটেড` — `max_orders`/`max_staff`/`max_tracking_events_per_day`-এর same কনভেনশন)।
- `LandingPageController::store()`-এ নতুন `landingPageLimitResponse()` চেক (creation-time-এ, `subdomainMissingResponse()`-এর ঠিক পাশেই, একই response-shape কনভেনশন মেনে) — shop-এর মোট (draft+published, soft-deleted বাদে) landing page count প্যাকেজের `max_landing_pages`-এর সাথে তুলনা করে, পৌঁছালে `402 landing_page_limit_reached`। **আলাদা publish-time চেক লাগেনি** — যেহেতু creation-ই capped, কোনো over-limit draft কখনো তৈরিই হতে পারে না, তাই publish করার মতো "অতিরিক্ত" পেজ কখনো থাকে না।
- Admin প্যাকেজ ফর্মে (`/admin/packages`) নতুন ফিল্ড (create+edit+list টেবিল, তিন জায়গাতেই)।
- **বিদ্যমান সেলারদের retroactively স্পর্শ করা হয়নি** — কারো প্যাকেজের নতুন লিমিট তার বর্তমান পেজ-সংখ্যার চেয়ে কম হলেও, বিদ্যমান কোনো পেজ unpublish/delete হয় না; শুধু নতুন তৈরি ব্লক হয় (টেস্টে explicitly ভেরিফাই করা হয়েছে)।
- **ফ্রন্টএন্ডে নতুন কিছু করতে হয়নি** — `landing-page-builder.tsx`-এর সেভ হ্যান্ডলার ইতিমধ্যেই `json.message` জেনেরিকভাবে দেখায় (৪০২ রেসপন্সও একইভাবে সঠিক মেসেজ সহ প্রদর্শিত হবে)।

**Verification:**
- Isolated pgsql schema: migration ক্লিন। নতুন `tests/Feature/LandingPageLimitTest.php` (৭টা — unlimited-when-null, blocks-at-limit, draft+published-counted-together, delete-frees-a-slot, shop-wide-across-staff, existing-sellers-never-retroactively-touched, admin-can-set-limit)। ফুল সুইট: ৫৬২ পাস — ৩টা known baseline + সমান্তরাল সেশনের একটা আলাদা uncommitted কাজ (`LandingPageCostPriceLeakTest`, `LandingPageController.php`-এ) সাময়িকভাবে `git stash` (শুধু ওই একটা ফাইল, path-scoped) করে আলাদা রাখা হয়েছিল যাতে দুই সেশনের কাজ mix না হয় — commit করার পর stash পপ করে ফেরত দেওয়া হয়েছে।
- `npx tsc --noEmit` clean, `deploy-safe.sh` 8/8 pass।
- **লাইভ প্রোডাকশন ভেরিফিকেশন** (disposable package (`max_landing_pages:2`) + seller + shop, tinker দিয়ে তৈরি): ২টা পেজ তৈরি (দুটোই `201`) → তৃতীয়টা → `402 landing_page_limit_reached` সঠিক মেসেজ সহ। সব টেস্ট ডেটা (৩টা পেজ, শপ প্রোফাইল, সেলার+টোকেন, প্যাকেজ) মুছে ফেলা হয়েছে।

**পরবর্তী ধাপ (§9.6):** Tracking boost addon (শেষ ধাপ, ল্যান্ডিং পেজের প্যাটার্ন কিছুটা রিইউজ হবে)।
