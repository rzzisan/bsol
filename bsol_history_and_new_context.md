# BSOL — History &amp; All-in-One SaaS Context

> **🚨 আপডেট (২০২৬-০৮-১৭):** এই ফাইলের মূল বিষয় ছিল §৫-এ প্রস্তাবিত WordPress/WooCommerce Connector — সেটা এখন **সম্পূর্ণ তৈরি ও লাইভ** (২০ ফেজ, `wordpress_connect_context.md`)। নিচের §৩/§৪/§৫/§৮/§৯-এ যেখানে "সম্পূর্ণ absent"/"এই ডকুমেন্টের মূল ফোকাস" লেখা আছে সেগুলো এখন **ঐতিহাসিক** — তখনকার প্রস্তাবনা হিসেবে অপরিবর্তিত রাখা হয়েছে, কিন্তু বর্তমান স্ট্যাটাসের জন্য `wordpress_connect_context.md`-ই একমাত্র সত্য উৎস। §১০-এর নিজের "doc lag" সতর্কতা অনুযায়ী এই আপডেট করা হলো।

এই ফাইলের উদ্দেশ্য: user-এর পুরোনো সব প্রজেক্ট (`oldproject/`, `zyro/`, `catv/`) এবং বর্তমান BSOL (`CONTEXT.md`, `SAAS_MODULE_CONTEXT.md` + সব `*_context.md`) একসাথে দেখে — "All-in-One SaaS" বানাতে (WordPress কানেক্ট সহ) আর কী কী ফিচার দরকার তার একটা সিঙ্গেল প্ল্যানিং ডকুমেন্ট তৈরি করা। এটা একটা **living roadmap/history doc** — status doc না (module-এর লাইভ স্ট্যাটাসের জন্য `SAAS_MODULE_CONTEXT.md` §15 এবং `feature_roadmap_context.md` কেই source of truth ধরতে হবে)।

Master reference files: [[CONTEXT.md]], [[SAAS_MODULE_CONTEXT.md]], [[feature_roadmap_context.md]], [[landing_page_context.md]], [[facebook_integration_context.md]], [[courier_waybill_context.md]], [[staff_team_role_context.md]], [[subscription_billing_context.md]], [[zyro_sms.md]], [[redx_api_doc.md]].

---

## ১. ইতিহাস — কীভাবে BSOL পর্যন্ত এলাম

1. **শুরু:** ফেসবুক অ্যাডে চালিয়ে WordPress + WooCommerce + Elementor + CartFlows দিয়ে ল্যান্ডিং পেজ বানিয়ে পণ্য বিক্রয়। নিজে নিজে অ্যাড চালিয়ে কিছু কাস্টমার পাওয়া গেলেও ফেক অর্ডার/রিটার্ন/ফ্রড কাস্টমারের কারণে অ্যাড কস্ট প্রচুর burn হত — একটা ক্যাম্পেইনে বাস্তব কাস্টমার আসত মাত্র ৬-৭টা।
2. **সমস্যা সমাধানে প্লাগিন তৈরি (`oldproject/`):** এই বাস্তব সমস্যাগুলো (ফেক অর্ডার, ফ্রড, courier delivery-rate, OTP, abandoned cart) সমাধানের জন্য নিজে প্লাগিন লেখা শুরু — `sapi` → `ZSapi`(+ লাইসেন্স সার্ভার `zsapi-server-manager`) → `sales-booster-pro.2.0` (ফিচার-সুপারসেট, anti-tamper + remote kill-switch সহ) → বিশেষায়িত প্লাগিনে split (`customer-leads-manager`, `fraud-checker-integration`, `zzt-sms-v3.6`, `incomplete-orders-tracker-v3.5-1`)।
3. **পাইরেসি সমস্যা:** প্লাগিন বিক্রি করতে গিয়ে সোর্স কোড ক্লায়েন্টের সার্ভারে থাকায় সহজেই বাইপাস/কপি হয়ে যেত (`sales-booster-pro`-তে file-hash integrity guard আর RSA-signed remote kill-switch পর্যন্ত বানানো হয়েছিল ঠেকাতে — তাও যথেষ্ট ছিল না, কারণ সমস্যাটা architectural, protection-এর অভাব না)।
4. **`zyro` শুরু — সমাধান: SaaS thin-client মডেল।** সোর্স কোড ক্লায়েন্টের কাছে না রেখে, বিজনেস লজিক পুরোপুরি সার্ভারে (`saas.zyrotechbd.com`) রেখে WordPress প্লাগিন (`zayroo-connect`) কে শুধু "থিন ক্লায়েন্ট" বানানো হলো — এটাই পাইরেসি সমস্যার আসল সমাধান, আর এটাই এখনো BSOL-এর WordPress integration ডিজাইনের ভিত্তি হওয়া উচিত। zyro ধীরে ধীরে বড় হয়ে fraud checker + Facebook CAPI + landing page builder + SMS/OTP + finance/marketing/support suite-এ পরিণত হয়।
5. **MERN/MariaDB শেখা — `catv`।** নতুন কিছু শেখার জন্য MERN স্ট্যাক ট্রাই করতে গিয়ে নিজের Dish/Cable ব্যবসার জন্য একটা আলাদা বিলিং সফটওয়্যার (`catv`, আসলে React+Vite+Node/Express+Prisma+**MariaDB**, MongoDB না) বানানো হয় — এটা এখন নিজের ব্যবসায় প্রোডাকশনে সফলভাবে চলছে, একটা Android অ্যাপও আছে (Bluetooth thermal printer সহ), কিন্তু কখনো মার্কেটিং/বিক্রি করা হয়নি। আকর্ষণীয় ব্যাপার: `catv`-এর কোডেই ইতিমধ্যে multi-tenant SaaS-এর কাঠামো (Company→Package→CompanySubscription→SUPER_ADMIN) বানানো আছে, যদিও কখনো ব্যবহার হয়নি অন্য tenant-এর জন্য।
6. **এখন — `bsol`।** পুরোনো তিনটা প্রজেক্টের অভিজ্ঞতা (fraud/courier logic zyro থেকে, UI shell catv থেকে, API-key+domain-binding security প্যাটার্ন zayroo-connect থেকে) নিয়ে Laravel 13 + Next.js 16 দিয়ে গ্রাউন্ড-আপ রিরাইট। লক্ষ্য: নিজের ব্যবসার সমস্যার সমাধানগুলোকেই একটা পূর্ণাঙ্গ multi-tenant SaaS প্রোডাক্ট বানিয়ে বাংলাদেশি Facebook/social commerce সেলারদের কাছে বিক্রি করা।

**মূল শিক্ষা যা এই ডকুমেন্ট জুড়ে বারবার আসবে:** থিন-ক্লায়েন্ট + ডোমেইন-বাউন্ড API-key মডেলই bypass/piracy ঠেকানোর প্রমাণিত পথ; পুরোনো প্রতিটা প্রজেক্টেই একই ৫টা কোর সমস্যা (fraud/courier delivery-rate, OTP, Facebook CAPI, abandoned cart, SMS) বারবার সমাধান করা হয়েছে — এগুলোই bsol-এর "must-have" কোর, বাকি সব তার উপর layer।

---

## ২. প্রজেক্ট বংশলতিকা (lineage)

```
sapi (v1.0.3, FB CAPI + license client)
  └─ ZSapi (v1.1.2, + blacklist, customer health, custom updater)
       └─ zsapi-server-manager (লাইসেন্স/নোটিশ সার্ভার, WP প্লাগিন হিসেবে বানানো REST backend)
  └─ sales-booster-pro.2.0 (v2.0, ফিচার সুপারসেট + anti-tamper + remote kill-switch)
       ├─ customer-leads-manager (v4.4, all-in-one checkout+lead+SMS+fraud+CAPI)
       ├─ fraud-checker-integration (v1.4.0, VPN block + repeat-order block + remote subscription/usage-metering DB)
       ├─ zzt-sms-v3.6 (v3.7.0, transactional SMS + OTP)
       └─ incomplete-orders-tracker-v3.5-1 (v3.5.2, abandoned cart + WhatsApp recovery link)
            └─ zayroo-connect (v1.6.x, ★ সব উপরের ফিচার একীভূত + "Thin Client" আর্কিটেকচারে মাইগ্রেট,
                                   লাইভ SaaS ব্যাকএন্ড `saas.zyrotechbd.com` = zyro প্রজেক্ট-এর সাথে কানেক্টেড)

zyro (native PHP, no framework) — fraud checker + landing page builder + Facebook CAPI hub +
                                    SMS/OTP + courier + finance/marketing/support suite + headless-WP renderer (আটকে আছে)

catv (React+Vite + Node/Express+Prisma + MariaDB, + Android/Kotlin)
  — নিজের ব্যবসার জন্য, কিন্তু multi-tenant SaaS কাঠামো (Company/Package/Subscription/SUPER_ADMIN) already built-in

bsol (Laravel 13 + Next.js 16 + PostgreSQL, বর্তমান) ← সব প্রজেক্টের প্যাটার্ন/শিক্ষা একত্র করে rewrite
  — এই ডকুমেন্টের বিষয়: bsol-এ zayroo-connect-এর উত্তরসূরি WordPress প্লাগিন + zyro/catv-এর বাকি
    reusable মডিউলগুলো যোগ করে সত্যিকারের "All-in-One" বানানো
```

`oldproject/zyro/` (খালি `index.php` স্টাব) — কোনো কোড নেই, সম্ভবত `zyro`/`Zayroo`/`Zyrotech` নাম রিজার্ভ করার জন্য রাখা একটা placeholder, উপেক্ষা করা যায়।

---

## ৩. BSOL-এ এখন কী আছে (কম্প্যাক্ট সামারি)

পূর্ণ, authoritative স্ট্যাটাস `SAAS_MODULE_CONTEXT.md` §15 আর `feature_roadmap_context.md`-তে — এখানে শুধু cross-reference-এর জন্য সংক্ষিপ্ত তালিকা:

| ক্যাটাগরি | ✅ যা আছে (built &amp; deployed) |
|---|---|
| Core Commerce | Auth+OTP, Order mgmt, Product+variants/SKU, Customer CRM, phone-based lookup |
| Fraud/Risk | Internal fraud score + blacklist, courier-cross-provider fraud/delivery-history check (shared cache, `courier_fraud_stats`) |
| Courier | Steadfast, Pathao, RedX, Carrybee (পূর্ণ), Paperfly (অসম্পূর্ণ — schema আছে, service নেই), common `CourierProviderInterface`+Factory abstraction, bulk booking, cancel |
| Landing Page | Block-based builder, bn/en, templates, media library, analytics, checkout OTP, **abandoned checkout recovery** (নতুন, zyro-এর incomplete-orders-tracker-এর উন্নত সংস্করণ), product-variant checkout |
| Communication | Manual+automation SMS (order-status trigger), SMS credit wallet+self-service purchase, generic notification template+dispatch (SMS+Email) |
| Accounting | Auto-ledger (order→income, courier charge→expense), manual transaction CRUD, summary/expense/profit pages |
| Analytics | Sales funnel, top products, customer intelligence (VIP/risky/LTV), courier analytics; Ads ROI এখনো placeholder |
| Subscription/Billing | Package plans, manual bKash + **live bKash gateway (Tokenized+PGW)**, upgrade/downgrade/proration, PDF invoice, SMS-credit বিলিং একই প্যাটার্নে |
| Support | Seller↔admin threaded chat (per-user, polling-based) |
| Waybill/Sticker | ২২টা selectable label template + order invoice PDF, barcode+QR, real HarfBuzz বাংলা শেপিং, shop profile |
| Staff/Team | পূর্ণ Pattern A (team-shared)/Pattern B (owner-only) permission সিস্টেম, seat limit, সব মডিউলে coverage |
| Facebook/Meta | Page comment+Messenger lead capture, reply, CAPI Purchase event (landing-page checkout-only) — **কোড শেষ, কিন্তু Meta App Review পেন্ডিং থাকায় সাধারণ সেলারদের জন্য এখনো লাইভ না** |
| Admin Panel | User/Package/Billing/SMS-gateway/Email/Notification-template/Landing-template/Branding — সব আছে |

**একদম শুরু হয়নি:** চেকআউটে real অনলাইন পেমেন্ট (এখনো সব COD), WhatsApp, Nagad/SSLCommerz, Bulk/CSV import, PWA।

**✅ আপডেট (২০২৬-০৮-১৭) — এই টেবিলে আগে "একদম শুরু হয়নি" লেখা ছিল, এখন সম্পূর্ণ:** **WordPress/WooCommerce connector** (২০ ফেজ, `wordpress_connect_context.md`), Invoice/Waybill PDF (২২ sticker template + order invoice + payment history, `courier_waybill_context.md`), Per-seller subdomain (`custom_domain_context.md`), Tracking Platform/Facebook Pixel+CAPI (`tracking_capi_context.md`), Staff/Team roles (`staff_team_role_context.md`)।

---

## ৪. দুই ধরনের কাস্টমার, দুই ধরনের প্রয়োজন

BSOL-কে সত্যিকারের "All-in-One" করতে দুই ভিন্ন সেলার-সেগমেন্টের জন্য দুই ভিন্ন entry point দরকার — user-এর নিজের কথাতেই এই বিভাজন স্পষ্ট:

**(ক) যাদের নিজের ওয়েবসাইট নেই** — BSOL-এর নিজস্ব Landing Page Builder + checkout ব্যবহার করবে। **এই অংশটা মোটামুটি সম্পূর্ণ** (§৩ দেখুন) — এখানে সবচেয়ে বড় গ্যাপ হলো checkout-এ real পেমেন্ট কালেকশন (এখনো COD-only)।

**(খ) যাদের নিজের WooCommerce ওয়েবসাইট আছে** — তাদের জন্য দরকার BSOL-এর সাথে কানেক্টেড একটা WordPress প্লাগিন (`zayroo-connect`-এর উত্তরসূরি)। **এই অংশটা BSOL-এ এখনো একদমই নেই** — এটাই এই ডকুমেন্টের মূল ফোকাস, নিচে §৫-এ পুরো ডিজাইন।

এছাড়া একটা তৃতীয় সম্ভাব্য সেগমেন্ট — **যাদের ওয়েবসাইটই নেই, ডোমেইন/হোস্টিং লাগবে** — সেটা §৭-এ আলাদাভাবে আলোচনা করা হলো, কারণ সেটা প্রোডাক্ট-ডিজাইন না, বরং একটা ops/business সিদ্ধান্ত।

---

## ৫. WordPress/WooCommerce Connector — মূল গ্যাপ, প্রস্তাবিত ডিজাইন

> **✅ এই সম্পূর্ণ সেকশন এখন বাস্তবায়িত (২০ ফেজ, `wordpress_connect_context.md`)।** নিচের ডিজাইন-প্রস্তাবনা ঐতিহাসিক রেফারেন্স হিসেবে অপরিবর্তিত রাখা হলো (কতটা কাছাকাছি বাস্তবায়ন হয়েছে তা দেখার জন্য আকর্ষণীয়), কিন্তু বর্তমান API surface/ফাইল-লিস্ট/ডিজাইন সিদ্ধান্তের জন্য `wordpress_connect_context.md` পড়ো, এই সেকশন না।

`zayroo-connect` (in `oldproject/` এবং তার হালনাগাদ সংস্করণ `zyro/wordpress_plugin/`) ইতিমধ্যে এই সমস্যাটার একটা **প্রমাণিত, লাইভ প্রোডাকশন সমাধান** — এটা নতুন করে ডিজাইন না করে, তার architecture-ই BSOL-এর existing backend-এর উপর বসিয়ে দেওয়া উচিত।

### ৫.১ কোর আর্কিটেকচার নীতি (zayroo-connect থেকে সরাসরি ক্যারি-ফরওয়ার্ড)
- **Thin Client** — প্লাগিনে কোনো বিজনেস লজিক না; শুধু WooCommerce hook থেকে ডেটা তুলে BSOL API-তে পাঠানো/BSOL থেকে ফলাফল দেখানো। fraud scoring, blacklist check, OTP generation, SMS templating, CAPI payload — সবকিছু BSOL সার্ভারে হবে।
- **Domain-bound API key auth** — প্রতিটা কলে `X-API-KEY` header + `client_domain` (=`get_site_url()`) পাঠানো, সার্ভারে `hash_equals` দিয়ে ভেরিফাই + স্টোর্ড ডোমেইনের সাথে মিলিয়ে দেখা। catv-এর `APIKey` মডেল (hashed key, JSON permissions, hourly rate limit, expiry) থেকে shape ধার করা যায়।
- **Non-blocking webhook calls** যেখানে দরকার (SMS trigger, CAPI event) — 5s timeout, blocking:false — যাতে WooCommerce checkout স্লো না হয়।
- **Fail-open বনাম fail-closed — স্পষ্ট সিদ্ধান্ত দরকার প্রতিটা চেকের জন্য।** zayroo-connect-এ OTP/blacklist validation ইচ্ছাকৃতভাবে fail-open (SaaS আনরিচেবল হলে checkout ব্লক না করে দেওয়ার সিদ্ধান্ত) — BSOL-এও একই কনভেনশন রাখা উচিত, কিন্তু প্রতিটা নতুন চেক যোগ করার সময় এই সিদ্ধান্তটা explicit ভাবে নিতে হবে (silent default না)।

### ৫.২ নতুন BSOL API সারফেস দরকার — `/api/connect/v1/*` (external, API-key-authenticated, `auth:sanctum`-এর বাইরে আলাদা middleware)

| Endpoint | কাজ | BSOL-এ যা reuse করা যাবে |
|---|---|---|
| `POST /connect` | API key যাচাই, ডোমেইন রেজিস্টার, website_id ফেরত | নতুন `PlatformApiKey` মডেল/মিডলওয়্যার |
| `POST /disconnect` | সাইট আনরেজিস্টার | — |
| `GET /dashboard` | প্ল্যান স্ট্যাটাস, SMS ব্যালেন্স, active courier তালিকা | `SubscriptionController`, `SmsCreditService`, `CourierSettings` — সরাসরি reuse |
| `POST /orders/sync` | WooCommerce অর্ডার তৈরি/আপডেট (`source: woocommerce`) | `OrderController::store`/`OrderStatusService` — প্রায় সরাসরি reuse, শুধু source ট্যাগ যোগ |
| `POST /products/sync` | WC পণ্য/স্টক পুশ (BSOL-এ) | `ProductController`+`ProductVariantController` |
| Inbound: `wp-json/bsol-connect/v1/sync-product` | BSOL থেকে স্টক আপডেট → WooCommerce-এ push-back (bidirectional) | zayroo-connect-এর proven pattern — নিজের save hook temporarily unhook করে infinite-loop এড়ানো |
| `POST /checkout/validate` | রিয়েল-টাইম fraud/blacklist চেক (checkout-এর আগে) | `FraudController::checkPhone` + `CustomerBlacklist` |
| `POST /otp/send`, `POST /otp/verify` | চেকআউট OTP | `CheckoutOtpController/Service` — generalize করতে হবে (landing_page_id-এর বদলে external site_id নিতে) |
| `POST /sms/trigger` | অর্ডার-স্ট্যাটাস-চেঞ্জ ওয়েবহুক (non-blocking) | `SmsAutomationService::processEvent` — একই automation rule engine reuse |
| `POST /courier/action` | Steadfast/Pathao/RedX/Carrybee বুকিং/স্ট্যাটাস/ব্যালেন্স | `CourierFactory` abstraction — ইতিমধ্যে provider-agnostic, প্রায় ফ্রি reuse |
| `POST /fraud/check-phone` | কুরিয়ার ডেলিভারি-হিস্ট্রি ফ্রড চেক | `CourierFraudCheckService` — ইতিমধ্যে global shared cache-backed |
| `POST /capi/track` | Facebook CAPI ইভেন্ট (Purchase + optionally funnel events) | `FacebookCapiClient`/`SendFacebookCapiPurchaseEventJob` — **generalize করতে হবে**, এখন শুধু landing-page checkout থেকে ফায়ার করে |
| `GET /waybill/{order}/pdf` | ২২-টেমপ্লেট waybill/sticker PDF WooCommerce সেলারদেরও দেওয়া | `WaybillPdfService` — যেহেতু sync হওয়া অর্ডার আসলে BSOL-এরই অর্ডার (source ট্যাগ ছাড়া), প্রায় ফ্রি reuse |
| Blacklist manage | block/unblock টগল (Customer Health bar) | `FraudController::blacklist*` — Pattern B/owner-scoped |

### ৫.৩ WordPress প্লাগিন সাইড — zayroo-connect-এর hook তালিকা reuse করা (already proven, HPOS-compatible)
`woocommerce_order_status_changed`, `woocommerce_new_order`, `woocommerce_checkout_process`, `woocommerce_checkout_order_processed` + Blocks Store API সমতুল্য, `save_post_product`/`woocommerce_reduce_order_stock`, HPOS-aware order-list column filters (`manage_woocommerce_page_wc-orders_columns` ইত্যাদি), bulk actions জন্য কুরিয়ার bulk-booking — এই পুরো hook set ইতিমধ্যে production-tested, নতুন করে ডিজাইন করার দরকার নেই, শুধু endpoint টার্গেট বদলাতে হবে।

### ৫.৪ Staff/Team সচেতনতা (BSOL-এর নতুন mandatory rule, zyro-তে ছিলই না)
Connector দিয়ে তৈরি অর্ডার/কাস্টমার অবশ্যই API key-এর মালিক shop owner-এর `shopOwnerId()`-এ resolve হতে হবে — কোনো raw user_id trust করা যাবে না ([[staff_team_role_context.md]]-এ ডকুমেন্টেড বাগ ক্লাসের মতোই)। নতুন module হিসেবে `StaffPermission::MODULE_KEYS`-এ একটা `integrations`/`wordpress_connect` এন্ট্রি লাগবে যদি স্টাফদের কানেকশন ম্যানেজ করার অনুমতি দিতে হয় (Pattern B — owner-only হওয়াই স্বাভাবিক, credential-জাতীয়)।

### ৫.৫ zyro-প্লাগিনের যেসব ভুল রিপিট করা যাবে না
- Pixel ID/site hardcode করা একটা নির্দিষ্ট মার্চেন্টের জন্য (zyro-তে `1084518286886173`/`zisan.me` hardcoded পাওয়া গেছে) — প্রতিটা সাইটের নিজস্ব Pixel ID/CAPI token config-driven হতে হবে (BSOL-এ ইতিমধ্যে সেলার-প্রদত্ত Pixel ID/token সাপোর্ট আছে — ভালো ভিত্তি)।
- অব্যবহৃত/misleading কনস্ট্যান্ট রাখা (`ZAYROO_API_URL` বনাম আসল hardcoded base) — একটাই সোর্স অফ ট্রুথ।
- দুইটা প্যারালাল async queue mechanism (`jobs` টেবিল + আলাদা `pending_capi_queue`) — BSOL-এ ইতিমধ্যে একটা Redis queue worker আছে, WC-triggered async কাজও সেটাই ব্যবহার করবে, নতুন কোনো প্যারালাল queue না।
- Activation-এ dead legacy টেবিল তৈরি করা (`zayroo_failed_otp_logs`, যেটার ফাংশনালিটি সার্ভার-সাইডে মাইগ্রেট হয়ে গেছে) — ক্লিন ডিজাইন থেকেই বাদ দেওয়া।
- Headless-WordPress-rendering প্রশ্নে ৪টা প্রতিদ্বন্দ্বী ডিজাইন রেখে অমীমাংসিত রাখা (§৬.১ দেখুন) — একটাই পথ বেছে নিতে হবে, অথবা স্কোপ থেকে বাদ দিতে হবে।

---

## ৬. zyro/oldproject/catv থেকে যা এখনো BSOL-এ নেই

### ৬.১ zyro থেকে (native PHP SaaS)
| ফিচার | zyro-তে অবস্থা | BSOL সুপারিশ |
|---|---|---|
| Headless WordPress rendering (Elementor JSON→HTML) | ৯৫% হয়েও Apache config সমস্যায় আটকে ছিল, ৪টা প্রতিদ্বন্দ্বী ডিজাইন অমীমাংসিত | **স্কিপ করা উচিত** — BSOL-এর নিজস্ব block-based landing builder ইতিমধ্যে ভালো কাজ করছে; Elementor-compat আনার দরকার নেই যদি না কোনো seller স্পেসিফিক্যালি চায় |
| Finance module (invoices/budgets/recurring transactions/reconciliation/tax records/P&amp;L-balance sheet-cashflow) | পূর্ণ built | BSOL-এর Accounting module সহজ (auto-ledger+manual tx) — বড় সেলারদের জন্য পরে extend করা যায়, এখনই দরকার নেই |
| Marketing engine (SMTP campaign email, background batch send) | পূর্ণ built | **candidate** — `feature_roadmap_context.md`-এর "Marketing broadcast campaign" আইটেমের সাথে ওভারল্যাপ করে, কিন্তু ওখানে শুধু SMS; email campaign আলাদাভাবে যোগ করা যায় |
| Support ticketing + Knowledge Base | পূর্ণ built (priority/status/attachment/KB) | BSOL-এর সহজ threaded chat যথেষ্ট এখনকার স্কেলে — বড় হলে upgrade করা যায় |
| Inventory/procurement (suppliers, purchase orders, stock movement log) | পূর্ণ built | **candidate** — BSOL-এর product stock qty আছে কিন্তু supplier/PO workflow নেই; physical inventory চালানো সেলারদের জন্য দরকারি হতে পারে |
| Wallet + ZiniPay (local bKash/Nagad aggregator) | পূর্ণ built | চেকআউট online-payment রোডম্যাপ আইটেমের সাথে relevant — বাড়তি গেটওয়ে অপশন হিসেবে বিবেচনা |
| Custom event tracking (link/scroll/click → FB event, server-config) | পূর্ণ built, client pixel coordination সহ | Ads ROI tracker আইটেমের সাথে relevant — BSOL-এর CAPI এখন শুধু Purchase-only, ফানেলের বাকি ইভেন্ট নেই |
| VPN/Proxy checkout detection | `fraud-checker-integration`-এ ছিল | **candidate নতুন fraud সিগন্যাল** — বর্তমান fraud score-এ নেই |
| Repeat-order time-window blocking | একাধিক oldproject প্লাগিনে ও zayroo-connect-এ ছিল | ভেরিফাই করতে হবে BSOL-এর fraud score এটা যথেষ্ট কভার করে কিনা, নাকি আলাদা hard-toggle দরকার |

### ৬.২ catv থেকে (multi-tenant SaaS skeleton)
| প্যাটার্ন | catv-তে অবস্থা | BSOL সুপারিশ |
|---|---|---|
| Package/CompanySubscription প্ল্যান-লিমিট enforcement | `Package.maxCustomers/maxStorage/apiRateLimit` + `CompanySubscription.status/endDate` মডেল করা আছে | **ভেরিফাই করতে হবে** — BSOL-এর `active_subscription` middleware শুধু active/inactive গেট করে, package অনুযায়ী hard usage cap (max orders, max staff seat, ইত্যাদি) সত্যিকারে enforce হয় কিনা তা যাচাই করা দরকার |
| Self-service signup + demo-seed-on-signup + PENDING-trial hard caps | পূর্ণ built (register-company → auto demo data → capped trial) | **candidate onboarding upgrade** — BSOL-এ নতুন সেলার সাইনআপের পর demo/sample data auto-seed হয় কিনা অস্পষ্ট; থাকলে churn কমতে পারে |
| Super-admin Activity Log + Audit Trail (old/new diff) | পূর্ণ built (দুটো আলাদা মডেল) | BSOL অডিটে uncovered — অ্যাডমিন প্যানেলে যোগ করার যোগ্য |
| System settings key-value + category store | পূর্ণ built | BSOL-এ platform settings প্রায় একই রকম আলাদা কন্ট্রোলারে ছড়ানো — centralize করার বিকল্প হতে পারে |
| 2FA/account-lockout fields | মডেল আছে, enforce হয়নি catv-তেও | BSOL-এও নেই বলে মনে হচ্ছে — নিরাপত্তা upgrade candidate |
| `APIKey` + `IPWhitelist` মডেল (external programmatic access) | schema আছে, route-এ wired না | **এটাই সরাসরি §৫-এর WordPress connector-এর জন্য দরকারি ভিত্তি** — catv-এর shape থেকে ধার করে BSOL-এ বানানো যায় |

---

## ৭. ওয়েবসাইট/হোস্টিং/ডোমেইন ম্যানেজমেন্ট — আলাদা কৌশলগত প্রশ্ন

user-এর মূল লিস্টে ছিল "ওয়েব সাইট ম্যানেজ, হোস্টিং, ডোমেইন" — এটা কোনো পুরোনো প্রজেক্টেই সমাধান করা হয়নি (zyro/catv/oldproject কেউই ডোমেইন/হোস্টিং প্রোভিশনিং করে না), তাই এখানে দুইটা ভিন্ন মাত্রার অপশন:

- **হালকা (already on roadmap #6):** BSOL-এর নিজস্ব landing page-এর জন্য custom domain CNAME connect + auto-SSL — সেলার নিজেই ডোমেইন কেনে, শুধু CNAME পয়েন্ট করে। Ops স্কোপ: nginx/certbot automation।
- **ভারী (নতুন, বড় সিদ্ধান্ত):** সেলারদের জন্য সরাসরি ডোমেইন রেজিস্ট্রেশন + হোস্টিং প্রোভিশনিং (WordPress+WooCommerce+connector প্লাগিন auto-install) সার্ভিস — এটা কার্যত একটা mini hosting-panel/WHMCS-এর মতো লেয়ার হয়ে যায়, রেজিস্ট্রার API (যেমন — Namecheap/local BD রেজিস্ট্রার) ও hosting-provisioning API লাগবে। এটা প্রোডাক্ট স্কোপের বাইরের একটা বড় সিদ্ধান্ত — user-এর সাথে confirm না করে শুরু করা ঠিক হবে না (§৯-এ open question হিসেবে রাখা হলো)।

---

## ৮. সম্পূর্ণ ফিচার গ্যাপ ম্যাট্রিক্স (মাস্টার লিস্ট)

| ফিচার | সেলার-নিজের-সাইট-নেই (BSOL landing page) | সেলার-নিজের-WooCommerce-আছে (connector) | সোর্স/precedent | অবস্থা |
|---|---|---|---|---|
| চেকআউটে online পেমেন্ট | ⬜ Not started (highest priority, roadmap #1) | ⬜ connector-এর সাথে একসাথে ডিজাইন করা উচিত | bKash pattern already proven (subscription billing); zyro-এর ZiniPay বাড়তি অপশন | 🔴 |
| **WordPress/WooCommerce Connector প্লাগিন** | N/A | ✅ **সম্পূর্ণ, ২০ ফেজ, v1.17.0** (২০২৬-০৮-১৭ আপডেট) | zayroo-connect (§৫) → `wordpress_connect_context.md` | ⚫ done |
| Fraud check/blacklist | ✅ আছে | ✅ connector-এ expose করা হয়েছে (checkout-time blacklist block সহ) | `FraudController`+`CourierFraudCheckService` | ⚫ done |
| Courier booking | ✅ আছে | ✅ connector-এ expose করা হয়েছে (৫টা কুরিয়ারই, address-resolver সহ) | `CourierFactory` | ⚫ done |
| Facebook CAPI | 🟡 App Review এখনো পেন্ডিং (landing-page + WooCommerce দুটোই কোড-সম্পূর্ণ) | ✅ connector generalize করা হয়েছে (Phase ১০) | `FacebookCapiClient` | 🟡 App Review বাকি |
| SMS automation | ✅ আছে | ✅ status-sync দিয়ে স্বয়ংক্রিয় trigger + wp-admin থেকে Manual SMS বাটনও যোগ হয়েছে | `SmsAutomationService` | ⚫ done |
| Waybill/sticker PDF | ✅ আছে (২২ টেমপ্লেট) | ✅ connector-এ expose করা হয়েছে (order invoice PDF-ও) | `WaybillPdfService` | ⚫ done |
| WhatsApp integration | ⬜ Not started | ⬜ Not started | Messenger architecture reuse করা যায় | 🔴 roadmap #2 |
| Auto-top-up billing | ⬜ Not started | N/A | SMS credit/subscription infra রেডি | 🔴 roadmap #3 |
| Custom domain (হালকা) | ⬜ Not started | N/A | — | 🟡 roadmap #6 |
| ডোমেইন/হোস্টিং রিসেল (ভারী) | ⬜ Not started, স্কোপ-সিদ্ধান্ত দরকার | N/A | কোনো পুরোনো প্রজেক্টেই নেই | ⚪ open question (§৯) |
| Marketing broadcast (SMS) | ⬜ Not started | ⬜ Not started | Customer intelligence segment ইতিমধ্যে আছে | 🟡 roadmap #7 |
| Marketing broadcast (Email campaign) | ⬜ Not started | ⬜ Not started | zyro Marketing engine | ⚪ candidate |
| Inventory/procurement (suppliers/PO) | ⬜ Not started | ⬜ Not started | zyro | ⚪ candidate |
| Finance suite (budgets/tax/reconciliation) | ⬜ Not started (Accounting সহজ ভার্সন আছে) | — | zyro | ⚪ candidate, বড় সেলারদের জন্য |
| Plan-based usage-limit enforcement | 🟡 শুধু active/inactive, hard cap অস্পষ্ট | — | catv Package/CompanySubscription | 🟡 ভেরিফাই দরকার |
| Self-service signup + demo-seed | 🟡 অস্পষ্ট, অডিটে uncovered | — | catv register-company flow | ⚪ candidate |
| Admin Activity Log/Audit Trail | ⬜ অডিটে uncovered | — | catv ActivityLog/AuditTrail | ⚪ candidate |
| 2FA/account lockout | ⬜ Not started | — | catv মডেল আছে, enforce হয়নি ওখানেও | ⚪ candidate |
| External `APIKey`+`IPWhitelist` মডেল | N/A | ⬜ এটাই §৫-এর ভিত্তি হওয়া উচিত | catv schema | 🔴 connector-এর জন্য দরকার |
| Bulk/CSV order import | ⬜ Not started | connector আংশিক সমাধান দেয় (sync) | — | 🟡 roadmap item |
| PWA / native app | ⬜ Not started | — | catv-এর Android app (Bluetooth thermal print) রেফারেন্স | ⚪ দীর্ঘমেয়াদী |

🔴 = উচ্চ প্রায়োরিটি/এখনই সিদ্ধান্ত দরকার, 🟡 = মাঝারি/আংশিক, ⚪ = candidate/দীর্ঘমেয়াদী, ⚫ done (উপরে বাদ দেওয়া হয়েছে, §৩ দেখুন)।

---

## ৯. প্রায়োরিটাইজড পরবর্তী পদক্ষেপ (updated)

> **আপডেট (২০২৬-০৮-১৭):** নিচের লিস্টের #2 (WordPress/WooCommerce Connector) সম্পূর্ণ হয়ে গেছে — `wordpress_connect_context.md`। বাকি #1/#3/#4 এখনো প্রযোজ্য, অগ্রাধিকার অপরিবর্তিত।

`feature_roadmap_context.md`-এর বিদ্যমান অর্ডার এখনো ভ্যালিড, শুধু connector-কে explicit ভাবে যোগ করা হলো:

1. **চেকআউটে online পেমেন্ট কালেকশন** — কোর "ফেক/অনুপস্থিত COD অর্ডার" সমস্যার সরাসরি সমাধান, bKash pattern রেডি।
2. ~~**WordPress/WooCommerce Connector**~~ — ✅ **সম্পূর্ণ (২০২৬-০৮-১৭)**, ২০ ফেজ, `wordpress_connect_context.md`।
3. **Auto-top-up/usage-based billing** — প্রায় বিনামূল্যে upsell, infra রেডি।
4. **WhatsApp Business** — Messenger architecture reuse।

তারপর (গ্যাপ-অ্যানালাইসিস থেকে নতুন candidate, প্রায়োরিটি user confirm করবে): plan-usage-limit enforcement যাচাই, marketing broadcast (SMS+email), সেলারের নিজস্ব custom domain (T8b — per-seller সাবডোমেইন অংশ ইতিমধ্যে সম্পূর্ণ, `custom_domain_context.md`), inventory/procurement, admin audit trail।

---

## ১০. আর্কিটেকচার সতর্কতা — যা রিপিট করা যাবে না

- **doc lag** — SAAS_MODULE_CONTEXT.md নিজেই স্বীকার করে §12-14 stale; এই নতুন ফাইলও নিয়মিত audit ছাড়া একই ভাবে stale হয়ে যাবে। প্রতিটা বড় মডিউল শেষ হলে এই ফাইলের §৩/§৮ টেবিল আপডেট করা উচিত।
- **hardcoded single-tenant config** কখনো shared plugin/service কোডে না (zyro pixel-ID বাগ)।
- **dual/ambiguous async queue** — একটাই queue worker (Redis) ব্যবহার করা, নতুন সমান্তরাল queue টেবিল/মেকানিজম না বানানো (zyro-এর `jobs` বনাম `pending_capi_queue` বিভ্রান্তির পুনরাবৃত্তি এড়ানো)।
- **Staff/Team Pattern A/B শৃঙ্খলা** যেকোনো নতুন মডিউলে (connector-সহ) মানতে হবে — `CONTEXT.md` §৩১ এখনো মান্ডেটরি চেকলিস্ট।
- **fail-open/fail-closed সিদ্ধান্ত explicit রাখা**, silent default না — প্রতিটা নতুন external-facing চেকের জন্য।
- **অমীমাংসিত ডিজাইন প্রশ্ন রেখে দেওয়া চলবে না** (zyro-এর headless-WP ৪-পথ বিতর্কের মতো) — একটা পথ বেছে নিয়ে এগোনো, নাহলে স্কোপ থেকে বাদ দেওয়া।
- **Anti-piracy/licensing** এখন মূলত অপ্রাসঙ্গিক bsol-এর নিজের কোডের জন্য (fully-hosted SaaS, সোর্স ক্লায়েন্টের কাছে নেই) — কিন্তু WordPress প্লাগিনটা distributed কোড, তাই সেখানে domain-bound API-key মডেলটাই (§৫.১) piracy-প্রতিরোধের আসল হাতিয়ার, code-obfuscation/anti-tamper (sales-booster-pro-এর মতো) দরকার নেই।

---

## ১১. সিদ্ধান্ত দরকার এমন প্রশ্ন (user confirm করার পর এগোনো উচিত)

1. ~~WordPress connector-এর scope~~ — ✅ উত্তর: MVP দিয়ে শুরু করে ধাপে ধাপে (২০ ফেজে) পূর্ণ §৫.২ লিস্ট + আরও বেশি কভার হয়ে গেছে (`wordpress_connect_context.md`)।
2. zyro-এর কোন মডিউলগুলো সত্যিই দরকার — Finance suite? Marketing email campaign? Inventory/procurement? নাকি এগুলো ভবিষ্যতের জন্য রেখে দেওয়া?
3. পেমেন্ট গেটওয়ে — bKash-ই যথেষ্ট, নাকি Nagad/SSLCommerz/ZiniPay-ও যোগ করা?
4. ডোমেইন/হোস্টিং — শুধু custom-domain-connect (হালকা) নাকি পূর্ণ হোস্টিং/ডোমেইন রিসেল সার্ভিস (ভারী, নতুন ops স্কোপ)?
5. `catv`-এর multi-tenant/plan-limit/audit-trail প্যাটার্নগুলো BSOL-এ পোর্ট করা হবে, নাকি `catv` নিজে ভবিষ্যতে BSOL-এর একটা আলাদা "vertical" (cable/billing) প্রোডাক্ট হিসেবে থাকবে?
