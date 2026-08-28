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

## ক. Core Commerce (Order / Product / Customer)

**সোর্স:** `SAAS_MODULE_CONTEXT.md` §15.1, §17.1

**Feature bug (backend):**
- ☐ `OrderController::store()` — শুধু `product_variant_id` পাঠালে (কোনো `product_id` ছাড়া) ownership check bypass সম্ভব, অন্য seller-এর variant নিজের অর্ডারে যোগ করা যায় তাত্ত্বিকভাবে
- ☐ Stock check `store()`-এ creation-time validate হয় কিন্তু decrement হয় status-transition-এ (TOCTOU) — দুটো concurrent order একই limited stock pass করতে পারে
- ☐ `Order::generateOrderNumber()` lock ছাড়া `orderByDesc('id')` — রেসে raw `QueryException` (500) সম্ভব, data করাপ্ট হয় না কিন্তু user raw error পায় (২০২৬-০৮-২২-এ ধরা পড়া cross-shop collision বাগের মতোই ক্লাস, ওইটা ফিক্স হয়েছে কিন্তু এই lock-less pattern নিজেই এখনো আছে)

**Hardening/cleanup:**
- ☐ Product SKU uniqueness এখনো global (per-user না) — এক seller-এর SKU অন্য seller-কে block করতে পারে
- ☐ `Customer::orders()` relation define করা কিন্তু ব্যবহার হয় না (dead code, `show()` manually query করে) — cleanup
- ☐ `CustomerController::syncAll()` পুরো seller-এর সব order মেমোরিতে লোড করে, কোনো chunking নেই — বড় seller-এ memory/perf ঝুঁকি

**UI/UX অডিট (এখনো করা হয়নি):**
- ☐ Order list/detail, Product list/detail, Customer list/detail — bn/en টেক্সট length change-এ layout না ভাঙে তা mobile+tablet-এ verify করা
- ☐ Variant picker/table UI large variant-count-এ (২০+ combination) usability check
- ☐ Order status badge/color consistency অন্য মডিউলের (courier, subscription) status badge-এর সাথে মেলে কিনা

---

## খ. Fraud & Risk

**সোর্স:** §15.2, §17.2

- ☐ Global blacklist propagation (+40 score) — যেকোনো এক seller ব্লকলিস্ট করলেই সব seller-এর জন্য "medium risk" হয়ে যায়, কোনো validation/audit trail ছাড়া — abuse-able, দরকার হলে audit log বা dispute-flow যোগ করা বিবেচনা করা
- ☐ Paperfly fraud-check heuristic parsing (`str_contains` on status string) — fragile, verify/harden করা
- ☐ `/fraud/courier-check` রুটে কোনো per-user throttle নেই

**UI/UX:**
- ☐ Fraud-check ও blacklist পেজ — risk-level রং/ব্যাজ consistency অন্য মডিউলের সাথে মেলে কিনা

---

## গ. Courier Integration

**সোর্স:** §15.3, §17.3, §17.8 item 9, `courier_status_sync_context.md`, `courier_waybill_context.md`

- ☐ Pathao-তে দুইটা আলাদা, ডাইভার্জড token-fetch implementation (`PathaoService` vs `PathaoLocationService`) — maintenance trap, unify করা
- ☐ Carrybee bulk-booking থেকে এখনো বাদ (per-order area-search UI দরকার) — এটা করলে ৪ provider পূর্ণ parity পাবে
- ☐ RedX/Carrybee-এর জন্য test-connection endpoint এখনো নেই
- ☐ Carrybee/Paperfly tracking-refresh UI-তে নেই কোনো provider-এই (শুধু manual booking/cancel আছে)
- ☐ Paperfly — schema-লেভেলে column আছে কিন্তু service/route নেই, **product decision দরকার**: সম্পূর্ণ করা বা schema বাদ দেওয়া
- ☐ কোনো provider-এ retry/backoff নেই, status sync purely on-demand + hourly scheduled job (webhook নেই কোনো courier-এর)

**UI/UX অডিট:**
- ☐ ৪-৫টা courier provider-এর settings ফর্ম UI consistency (field label, validation message বাংলা/ইংরেজি দুটোতেই)
- ☐ Multi-courier rate/ETA compare UI আছে কিনা যাচাই (§16.5 — booking-এর আগে পাশাপাশি compare করার UX এখনো uncertain, verify করে দরকার হলে বানানো)

---

## ঘ. Landing Page / Checkout / Abandoned Checkout

**সোর্স:** §15.4, §17.4, `landing_page_context.md`

- ☐ `LandingPageAnalyticsController::linkVisitToOrder` — `order_id` caller-এর নিজের order-এ scoped না (শুধু global exists চেক) — analytics data pollution সম্ভব (low impact কিন্তু ফিক্স সহজ)

**UI/UX অডিট:**
- ☐ Landing page builder editor — element library-তে নতুন যোগ হওয়া সব element bn/en + dark/light-এ preview মেলে কিনা
- ☐ Public checkout ফর্ম (mobile network slow-connection-এ) loading/error state polish
- ☐ Abandoned checkout dashboard পেজ — resume-link flow real ডেটা দিয়ে আরেকবার end-to-end click-through করা

---

## ঙ. Seller Storefront (ফুল ইকমার্স শপ)

**সোর্স:** `seller_storefront_context.md` §২৪-২৫, feature_roadmap আইটেম #৯

- ☐ Follow-up আইটেম (২০২৬-০৮-২২-এ নোট করা, এখনো unconfirmed status): ন্যাভ বার কালার কাস্টমাইজেশন, ব্যানার প্রোডাক্ট-লিংক পিকার, ফিচারড ক্যাটাগরি থাম্বনেইল — `seller_storefront_context.md` খুলে বর্তমান status verify করো, এখনো বাকি থাকলে এখানেই সেরা জায়গা এটা শেষ করার

**UI/UX অডিট:**
- ☐ Standard ও CareSolution — দুটো থিমেই মোবাইল bottom-nav/drawer, cart badge, checkout flow ফ্রেশ চোখে verify (নতুন সেলার হিসেবে) করা
- ☐ Homepage banner/featured-category/product-card — বড় ক্যাটালগ (১০০+ product) দিয়ে load-time/pagination UX চেক
- ☐ Review/rating UI — spam/empty-state handling

---

## চ. Communication (SMS / Email / WhatsApp / Notification)

**সোর্স:** §15.5, §17.5, `whatsapp_context.md`, `zyro_sms.md`

- ☐ শুধু `khudebarta` provider বাস্তবে supported — schema provider-agnostic কিন্তু বাস্তবে single-provider; multi-provider দরকার হলে scope করা, নাহলে UI-তে honest রাখা
- ☐ SMS automation UI-তে `payment_due`/`failed_delivery_retry` trigger-type সিলেক্ট করা যায় কিন্তু কোনো কোড path কখনো fire করে না — dead UI option, হয় implement করো নাহলে dropdown থেকে সরাও
- ☐ Delayed SMS-এ orphaned "queued" log row থেকে যাওয়ার সম্ভাবনা এখনো আছে (queue worker চালু আছে ২০২৬-০৮-০৮ থেকে, কিন্তু edge-case retry-exhaustion-এ log স্টেট আটকে যাচ্ছে কিনা periodically চেক করা)
- ☐ WhatsApp (§পজড, external blocker) — Meta Business verification সেলার নিজে করেছে কিনা periodically ping করা, ব্লকার সরলে সাথে সাথে resume করার জন্য
- ☐ Marketing broadcast (SMS+Email, segment-targeted) — এখনো শুরু হয়নি (feature_roadmap #৭/P6), Customer Intelligence-এর existing segment-tagging reuse করে নতুন `SmsBroadcastController` — নতুন ফিচার হিসেবে যোগ করার সময় এখানেই স্লট করা যাবে

**UI/UX অডিট:**
- ☐ SMS/Email template editor — variable placeholder ({customer_name} ইত্যাদি) preview WYSIWYG কিনা

---

## ছ. Accounting + Subscription/Billing

**সোর্স:** §15.6, §15.8, §17.6, §18, `subscription_billing_context.md`

- ☐ Auto-ledger dedup `updateOrCreate` (select-then-write) — DB-তে কোনো unique constraint নেই, concurrent status change/retry হলে race সম্ভব; unique constraint যোগ করা বিবেচনা করা
- ☐ `OrderController::destroy` soft-delete করে কিন্তু accounting entry cleanup করে না — orphaned ledger row থেকে যায়
- ☐ Expired subscription-এ seller নিজের delivered COD order status update করতে পারে না → real delivered cash accounting-এ কখনো confirm হয় না যতক্ষণ renew না করে — **product decision দরকার** (এই behavior রাখা হবে নাকি delivered-confirm exempt করা হবে expired subscription-এও)
- ☐ কোনো default subscription package সেট না থাকলে নতুন user permanently unmetered/free থেকে যায় — admin panel-এ warning/guard যোগ করা
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

## ত. Cross-cutting Security Hardening

**সোর্স:** §17.8, `production_audit_report_context.md §৩`, `domain_security_audit.md`

- ✅ **(2026-08-28) 2FA + admin audit trail সম্পন্ন** — বিস্তারিত §জ ও `security_hardening_context.md`
- 🟡 **(2026-08-28) Payment gateway sandbox verify — EPS ✅ সম্পন্ন (২০২৬-০৮-১৯-এই ছিল, ডকুমেন্টেশন stale ছিল, এখন sync হয়েছে), Nagad Merchant এখনো ⬜** — real Nagad merchant sandbox account/credential external dependency, verify()-এ success-path logging hardening যোগ হয়েছে কিন্তু আসল field-shape এখনো unconfirmed — বিস্তারিত §ছ ও `online_payment_context.md §৯.১, §১১`
- ☐ প্রতিটা নতুন module merge/deploy-এর আগে `CONTEXT.md` §25 (`adminScopeUserIds()`)-এর checklist অনুযায়ী shared-vs-per-user scoping re-verify — বিশেষ করে recent addon-packages/marketing-events মডিউলগুলোতে এটা প্রয়োগ হয়েছে কিনা একবার audit করা

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
