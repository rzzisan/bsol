# Subscription + Billing + SMS Credit — Work Context

এই ফাইলে এই কনভারসেশনে সাবস্ক্রিপশন/বিলিং ফিচার উন্নয়ন এবং SMS credit কেনার ফিচার প্ল্যানিং সংক্রান্ত সব কাজের context লিপিবদ্ধ থাকবে (user-এর বাধ্যতামূলক নির্দেশনা অনুযায়ী)। Master context: `CONTEXT.md` (server/ops), `SAAS_MODULE_CONTEXT.md` (product/feature — subscription §15.8/§18, SMS §15.5)।

> **🚨 Staff/Team role সচেতনতা (2026-08-10):** Subscription billing (`SubscriptionController`, bKash payment routes) এবং SMS credit purchase/wallet (`SmsCreditPurchaseController`, `SmsCreditBkash*Controller`) — এই পুরো ফিচার-সেট **সবসময় Pattern B (owner-only)**, `routes/api.php`-এ `owner_only` middleware দিয়ে wrapped — staff account কখনো নিজের subscription কিনতে/দেখতে বা SMS credit কিনতে পারবে না, এটা ইচ্ছাকৃত ডিজাইন। SMS **পাঠানো** (send/history/automation) আলাদা এবং Pattern A/staff-permission-gated (`sms` module) — SMS credit wallet balance staff ব্যবহার করতে পারে (owner-এর wallet থেকে কাটে, `AdminSmsGatewayController::send()`-এ `shopOwnerId()` দিয়ে resolve করা হয়) কিন্তু কেনা/রিচার্জ করতে পারে না। এই ফিচারে নতুন payment/billing-সম্পর্কিত কাজ করলে এই owner-only boundary বজায় রাখতে হবে — বিস্তারিত: CONTEXT.md §৩১, `staff_team_role_context.md §3.3`।

> **🚨 সেলার সাবডোমেইন — পেমেন্ট কলব্যাক এখন host-aware (2026-08-15):** সেলার এখন নিজের ঠিকানায় (`{label}.zyrotechbd.com`) ড্যাশবোর্ড চালায়, তাই bKash subscription ও SMS-credit কলব্যাক দুটোই সেলারকে **তার নিজের ঠিকানায়** ফেরত পাঠায়, প্ল্যাটফর্ম ডোমেইনে নয়। এটা `App\Support\FrontendUrl` দিয়ে হয়, আর ঠিকানা resolve হয় **payment রেকর্ডের মালিক থেকে — রিকোয়েস্টের `Host` হেডার থেকে নয়**। এই পার্থক্যটা নিরাপত্তাগত: bKash এই রিডাইরেক্ট নিয়ন্ত্রণ করে, তাই Host বিশ্বাস করলে প্রতিটি কলব্যাক একটা open redirect হয়ে যেত। payment না মিললে প্ল্যাটফর্ম URL-ই একমাত্র নিরাপদ গন্তব্য। **নতুন কোনো gateway/কলব্যাক যোগ করলে একই নিয়ম মানতে হবে** — বিস্তারিত `custom_domain_context.md §15`, CONTEXT.md §৩২।

Last updated: 2026-08-10 — **Phase 4: Phase 3-এর ডিজাইন user-এর কাছে যথেষ্ট মনে হয়নি ("ভাল লাগে নাই"), তাই আরেকবার সম্পূর্ণ visual concept upgrade করা হয়েছে, deploy + live-verify করা হয়েছে।** নিচে §8-এ implementation log। Phase 1/2/3 আগেই সম্পন্ন (§5, §6, §7)।

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
