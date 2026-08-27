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
- ☐ **P2 (payment gateway sandbox verify, এখনো Not started):** Nagad Merchant ও EPS-এর verify endpoint response shape real sandbox দিয়ে verify করা — financial-critical, soft-launch batch-এর আগে করা উচিত (`online_payment_context.md`, `production_audit_report_context.md §৭`)

**UI/UX অডিট:**
- ☐ Subscription/billing পেজ — প্যাকেজ ফিচার-লিস্ট (recent `max_staff`/`features` wiring commit-এর পর) UI-তে সঠিকভাবে reflect করছে কিনা end-to-end verify
- ☐ Collection History + Invoice payment-table — bn/en টেক্সট length সহ table column alignment

---

## জ. Admin Panel

**সোর্স:** §15.9, §17.6, §17.8 item 7, recent commits (dashboard homepage, package form)

- ☐ এখনো কোনো super-admin tier নেই (last-admin lockout guard আছে, কিন্তু granular admin-role নেই) — স্কেল বাড়লে দরকার হবে
- ☐ 2FA + admin audit trail (P8, feature_roadmap) — এখনো Not started, security hardening pass-এ প্রথম candidate
- ☐ Recent commit `56acf11`/`62bb4b2` (dashboard homepage real data + package `max_staff`/`features` form) — নতুন করে যোগ হওয়া অংশ ফ্রেশ eye দিয়ে একবার browser-এ ক্লিক-থ্রু verify করা (real data edge case: শূন্য সেলার, শূন্য প্যাকেজ ইত্যাদি)

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

- ☐ **2FA + admin audit trail** — এখনো Not started (P8), soft-launch scale বাড়ার আগে করা উচিত
- ☐ Payment gateway sandbox verify (Nagad/EPS) — উপরে §ছ-তেও আছে, financial risk হওয়ায় এখানেও ক্রস-লিস্টেড
- ☐ প্রতিটা নতুন module merge/deploy-এর আগে `CONTEXT.md` §25 (`adminScopeUserIds()`)-এর checklist অনুযায়ী shared-vs-per-user scoping re-verify — বিশেষ করে recent addon-packages/marketing-events মডিউলগুলোতে এটা প্রয়োগ হয়েছে কিনা একবার audit করা

---

## থ. Cross-cutting Design/UI/UX Consistency (`CONTEXT.md` §22 অনুযায়ী পূর্ণ সুইপ)

কোনো নির্দিষ্ট মডিউলের বাগ না, পুরো অ্যাপ জুড়ে একবার পূর্ণ sweep দরকার — মাসের পর মাস আলাদা সেশনে ফিচার যোগ হয়েছে, design drift জমেছে হতে পারে:

- ✅ **(2026-08-27) Dark-mode hardcoded-color sweep, ব্যাচ ১ সম্পন্ন ও deploy করা হয়েছে** — admin/dashboard টেবিল পেজে systemic bug পাওয়া গেছে: `bg-white even:bg-[#f8fbff] hover:bg-[#eaf4ff]` (row zebra/hover, ১৩ occurrence) এবং `border-[#e5ebf5]`/`border-[#d7e1ee]` (cell/header border, ১৫০+ occurrence) — dark theme-এ ভাঙত, এখন `var(--surface)`/`var(--surface-soft)`/`var(--accent)`/`var(--border)` টোকেনে বদলানো হয়েছে। প্লাস ৩টা status-badge (`bg-blue-100`/`bg-gray-100`) ও ৫টা Edit-button (দুই ভিন্ন style ছিল, `bg-blue-600` বনাম `bg-blue-50`) টোকেনে unify। ফাইল: `admin/tracking`, `admin/customers/active`, `admin/courier-cache`, `admin/sms/{credit,history,gateways}`, `admin/settings/notification-{templates,use-cases}`, `admin/landing/{pages,templates}`, `admin/packages`, `dashboard/sms/history`। `tsc --noEmit` + `npm run build` clean, `hybrid-frontend.service` restart + home/api/CSS-chunk smoke check সব `200`। **ইচ্ছাকৃতভাবে বাদ:** storefront/public-facing পেজ (customer-facing, আলাদা theme rule), toggle-knob/logo-container/sticker-preview-এর `bg-white` (structural, bug না), stat-card categorical color palette (`#0f7c7b`/`#2f7ec1` ইত্যাদি, ইচ্ছাকৃত multi-color pattern মনে হচ্ছে — পরের ব্যাচে verify করা উচিত)
- ☐ **পরের ব্যাচ candidate:** টেবিল header-এর হার্ডকোডেড `bg-[#2f7ec1]` (blue) — ~১৪টা admin পেজে ঠিক একইভাবে ব্যবহৃত (তাই inconsistency না) কিন্তু app-এর বাকি সব primary-button/accent color টিল (`var(--accent)`) — এই ব্লু টেবিল-হেডার design-সিদ্ধান্ত (রাখা vs টিল-এ বদলানো) owner-confirm লাগবে, unilaterally বদলানো হয়নি
- ☐ **পরের ব্যাচ candidate:** stat-card categorical color palette (`#0f7c7b`, `#2f7ec1`, `#27ae60`, `#8e44ad`, `#c0392b`, `#ff7a59` ইত্যাদি, `dashboard/page.tsx`, `admin/page.tsx`, `products/page.tsx` ইত্যাদি) — verify করা দরকার ইচ্ছাকৃত multi-color pattern কিনা, নাকি token-এ move করা উচিত (অন্তত `#0f7c7b` লাইটমোড `--accent`-এর হুবহু duplicate, সেটা অন্তত token-এ বদলানো যায়)
- ☐ সব dashboard/admin পেজে sidebar/topbar/card/table spacing-radius-shadow সত্যিই এক কিনা — একটা systematic pass (page-by-page স্ক্রিনশট নিয়ে compare) এখনো করা হয়নি ২০২৬-০৪-২৪-এর policy লেখার পর থেকে
- ☐ Status badge (order/courier/payment/subscription — ৪টাই আলাদা ডোমেইন) color/style পুরো অ্যাপে একই pattern মেনে চলে কিনা
- ☐ bn/en টেক্সট length ভিন্নতায় (বাংলা সাধারণত দীর্ঘ) button/label overflow — বিশেষ করে সাম্প্রতিক নতুন পেজ (addon-packages, order-credits, storefront-addon, whatsapp automation/inbox)-এ চেক হয়নি এখনো
- ☐ Mobile-first — storefront ছাড়া dashboard-এর নতুন পেজগুলো (order-credits, addon-packages, marketing-events) ছোট স্ক্রিনে টেবিল overflow/scroll আচরণ verify

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
