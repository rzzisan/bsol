# ডিজিটাল প্রোডাক্ট সিস্টেম — গবেষণা রিপোর্ট (Research, no code yet)

শেষ আপডেট: 2026-08-20 — প্রাথমিক গবেষণা। কোনো migration/কোড এখনো লেখা হয়নি — এই ফাইল শুধু architecture সিদ্ধান্ত ও existing-infra ম্যাপিং। `feature_roadmap_context.md`-এ pointer যোগ করা হয়েছে (আইটেম #৮), `SAAS_MODULE_CONTEXT.md §20`-এও।

## ০. সমস্যা (user-এর ভাষায়)

সেলাররা এখন শুধু ফিজিকাল প্রোডাক্ট বিক্রি করে (কুরিয়ার ডেলিভারি)। এখন ডিজিটাল প্রোডাক্টও (e-book, software, template, course file, ইত্যাদি) বিক্রি করতে দিতে হবে — যেটা কুরিয়ারে না গিয়ে **instant** email/WhatsApp/SMS/download-link দিয়ে ডেলিভার হয়। যেহেতু ডেলিভারি instant, **পেমেন্টও instant কনফার্ম হতে হবে** (মানুষ বসে বসে অপেক্ষা করবে না)। ফাইল সাইজ/ফরম্যাট সুপার-অ্যাডমিন নিয়ন্ত্রণ করবে, ফাইল আমাদের নিজেদের সার্ভারেই host হবে।

## ১. বিদ্যমান ইনফ্রা যা সরাসরি reuse করা যাবে (বড় সুখবর — অনেকটাই আগে থেকেই আছে)

### ১ক. Admin-controlled global file-policy — hুবহু template ইতিমধ্যে আছে
`ProductMediaSetting` মডেল + `Admin\ProductMediaSettingsController` + `ProductMediaController::effectivePolicy()` ([app/Http/Controllers/Api/ProductMediaController.php:212](backend/app/Http/Controllers/Api/ProductMediaController.php)) — এটা ঠিক যা user চাইছে: একটা single "latest active" গ্লোবাল রো (`is_active=true` `latest('id')->first()`), শুধু admin role লিখতে পারে ([Admin/ProductMediaSettingsController.php](backend/app/Http/Controllers/Api/Admin/ProductMediaSettingsController.php)), seller শুধু পড়ে (`policy()` এন্ডপয়েন্ট) এবং upload-time এ enforce হয় (mime type whitelist + size limit)। ডিজিটাল ফাইলের জন্য এই প্যাটার্নটাই কপি করলেই হবে — নতুন কিছু ডিজাইন করার দরকার নেই।

### ১খ. Email আসলে already কাজ করে — এইটা না জানলে ভুল করে নতুন বানানোর ঝুঁকি ছিল
`EmailConfiguration` + `NotificationTemplate` + `NotificationUseCaseBinding` + `NotificationDispatchService` ([app/Services/NotificationDispatchService.php](backend/app/Services/NotificationDispatchService.php)) — এটা একটা generic **use-case → SMS+Email dual-channel dispatcher**, PHPMailer দিয়ে সত্যিকারের ইমেইল পাঠায় (seller নিজের SMTP কনফিগার করে, ঠিক WhatsApp/Facebook credential-paste এর মতোই)। `priority_channel` (sms/email) অনুযায়ী fallback করে। **auto-recharge feature-এ এই সিস্টেমেই নতুন `sms_auto_recharge_*` use-case keys যোগ করা হয়েছিল** ([NotificationUseCaseBindingController.php](backend/app/Http/Controllers/Api/NotificationUseCaseBindingController.php)-এর `Rule::in()` whitelist) — ডিজিটাল ডেলিভারির জন্যও ঠিক এই একই রাস্তা: নতুন `digital_product_delivered` use-case key যোগ করলেই email+SMS দুটোই কাজ করবে, নতুন mail-sending কোড লাগবে না।

⚠️ ক্যাভিয়েট: `.env`-এ `MAIL_MAILER=log` (প্ল্যাটফর্মের নিজের কোনো central email না) — কিন্তু এটা relevant না কারণ email আসলে **সেলারের নিজের** `EmailConfiguration` (তাদের নিজের SMTP) দিয়ে পাঠানো হয়, platform-wide মেইলার দিয়ে না। সেলারকে অন্তত একটা `EmailConfiguration` সেট করতে হবে, নাহলে email চ্যানেল silently skip হয়ে যাবে (`filled($recipientEmail)` চেক আছে কিন্তু `email_configuration_id` না থাকলে template resolve হবে না) — dashboard-এ prompt দেখানো দরকার।

### ১গ. WhatsApp — বোনাস চ্যানেল, primary না
`WhatsappCloudApiClient::sendTemplateMessage()` ([whatsapp_context.md](whatsapp_context.md)) কোড আছে কিন্তু ফিচারটাই এখন **⏸️ পজড** (সেলার-সাইড Meta Business Verification বাকি)। ডিজিটাল ডেলিভারিতে reuse করা যাবে (connected থাকলে সরাসরি `sendTemplateMessage()` কল, `WhatsappAutomationService`-এর order-status trigger মেশিনারি বাইপাস করে) — কিন্তু guaranteed চ্যানেল হিসেবে ধরা যাবে না যতক্ষণ না WhatsApp ফিচার নিজেই আনপজড হয়।

### ১ঘ. Secure token-link প্যাটার্ন — hুবহু আছে, reuse করা যাবে
`Order.public_token` + `hash_equals($order->public_token, $token)` — timing-safe token compare — এই প্যাটার্ন এখন ৩ জায়গায় ব্যবহৃত ([CheckoutOtpController.php:129](backend/app/Http/Controllers/Api/CheckoutOtpController.php), [LandingPageController.php:239](backend/app/Http/Controllers/Api/LandingPageController.php), [OnlinePaymentController.php:256](backend/app/Http/Controllers/Api/OnlinePaymentController.php))। ডাউনলোড-লিংক টোকেনের জন্য একই hash_equals কনভেনশন ব্যবহার হবে, নতুন security প্যাটার্ন উদ্ভাবন করার দরকার নেই।

### ১ঙ. Storage disk — private disk আগে থেকেই আলাদা, exposed না
`config/filesystems.php`-এ `'local'` disk (`storage_path('app/private')`, web-serve না, root ছাড়া অ্যাক্সেসযোগ্য না) `'public'` disk (`storage/app/public`, সরাসরি URL-এ খোলা, symlinked) থেকে ইতিমধ্যেই আলাদা। প্রোডাক্ট ইমেজ `'public'` disk ব্যবহার করে ([ProductMediaController.php:88](backend/app/Http/Controllers/Api/ProductMediaController.php)) — কিন্তু **paid ডিজিটাল ফাইল কখনোই `'public'` disk-এ যাবে না**, সবসময় `'local'` (private) disk-এ যাবে এবং শুধু একটা controller route দিয়ে (token/permission চেক করে) স্ট্রিম হবে। এটা এই ফিচারের সবচেয়ে গুরুত্বপূর্ণ নিরাপত্তা সিদ্ধান্ত — প্রথম দিনেই ঠিক করে রাখা দরকার, পরে migrate করা কষ্টকর।

Object storage (S3-compatible) কনফিগও filesystems.php-এ রেডি আছে (`'s3'` disk, কিন্তু `.env`-এ `AWS_*` ফাঁকা — এখনো সেট করা হয়নি) — ভবিষ্যতে ডিজিটাল ফাইলের জন্য দরকার হতে পারে (নিচে §৬ দ্রষ্টব্য)।

### ১চ. checkout ইতিমধ্যে shipping-optional
`StoreOrderRequest`-এ `customer_address` আগে থেকেই `nullable` ([StoreOrderRequest.php:19](backend/app/Http/Requests/StoreOrderRequest.php)) — মানে একটা pure-digital অর্ডারে shipping address না দিলেও validation ফেল করবে না। ভালো — checkout ফর্ম লেভেলে আলাদা কিছু করতে হবে না, শুধু ফ্রন্টএন্ডে ডিজিটাল-অনলি কার্টে ঠিকানা ফিল্ড লুকাতে হবে।

---

## ২. যা নতুন লাগবে

### নতুন কলাম — `products` টেবিল
```
product_type ENUM('physical','digital') DEFAULT 'physical'
```
`has_variants`/`track_stock`/`stock` ফিজিকাল-নির্দিষ্ট — ডিজিটালে এগুলো অর্থহীন (একটা ডিজিটাল ফাইল একসাথে অসীমবার বিক্রি করা যায়, ফিজিকাল ইনভেন্টরির মতো "শেষ হয়ে যাওয়া" নেই) — ব্যতিক্রম নিচে §৮-এ (license-limited digital stock)।

### নতুন টেবিল `digital_product_files` (parallel to `ProductImage`)
```
product_id, user_id, file_path (private disk), file_name (original),
mime_type, file_size_bytes, version (int, default 1),
checksum_sha256 (nullable — future integrity check), is_active
```
একটা প্রোডাক্টে একাধিক ফাইল থাকতে পারে (যেমন e-book + bonus PDF) — তাই `ProductImage`-এর মতোই hasMany।

### নতুন টেবিল `digital_product_settings` (hুবহু `product_media_settings`-এর ক্লোন, admin-controlled)
```
user_id (admin), max_file_size_mb, allowed_extensions (jsonb — mime-type
এর চেয়ে extension whitelist ইউজারের কাছে বেশি বোধগম্য: pdf, zip, epub,
mp3, mp4 ইত্যাদি), max_files_per_product, download_link_expiry_hours
(default), max_downloads_per_purchase (default), is_active
```
`Admin\DigitalProductSettingsController` — `ProductMediaSettingsController`-এর হুবহু কপি-প্যাটার্ন (single latest-active global row, admin role gate)।

### নতুন টেবিল `digital_deliveries` (একটা কেনা = একটা ডেলিভারি রেকর্ড)
```
order_id, order_item_id, product_id, digital_product_file_id,
customer_phone, customer_email (nullable),
download_token (unique, random 32+ byte, hash_equals দিয়ে compare),
download_count, max_downloads, expires_at,
delivered_via (jsonb array — যেসব চ্যানেলে সফলভাবে পাঠানো হয়েছে:
  ['in_app','email','sms','whatsapp']),
last_downloaded_at, last_download_ip (nullable), status
  ('pending'|'delivered'|'expired'|'revoked')
```
`payment_status === 'paid'` কনফার্ম হওয়ার পরই এই রো তৈরি হবে ও token জেনারেট হবে — আগে না (নিচে §৪ দ্রষ্টব্য, এটাই এই ফিচারের আসল গেট)।

### নতুন controller: `DigitalDeliveryController`
`GET /d/{token}` (পাবলিক রুট, কোনো auth লাগে না — কাস্টমারের কাছে শুধু লিংক থাকে) — `hash_equals` দিয়ে token যাচাই → `expires_at`/`download_count < max_downloads` চেক → `Storage::disk('local')` থেকে ফাইল স্ট্রিম (`response()->download()` বা signed inline stream) → counter increment + IP/UA লগ (piracy deterrent, প্রতিরোধ না — নিচে §৭ দ্রষ্টব্য)।

### নতুন service: `DigitalDeliveryService`
`OrderStatusService`-এর প্যাটার্ন অনুসরণ করে — কিন্তু trigger হবে order **status** না, order **payment_status === 'paid'** ইভেন্টে (§৪ দেখুন)। কাজ: প্রতিটা ডিজিটাল `OrderItem`-এর জন্য `digital_deliveries` রো তৈরি, `NotificationDispatchService::dispatch($user, 'digital_product_delivered', $phone, $email, ['download_link' => ..., 'product_name' => ..., 'expires_at' => ...])` কল, WhatsApp connected থাকলে সেটাও ট্রাই।

---

## ৩. Staff/Team permission
নতুন `StaffPermission::MODULE_KEYS` এন্ট্রি `'digital_products'` — Pattern A (shared, `whereIn(shopUserIds())`), ফিজিকাল প্রোডাক্ট ম্যানেজমেন্টের মতোই — ফাইল আপলোড/প্রোডাক্ট এডিট staff করতে পারবে। প্ল্যাটফর্ম-লেভেল ফাইল পলিসি (`digital_product_settings`) আলাদা — সেটা `role === 'admin'` গেটেড, স্টাফ পারমিশনের বাইরে (ProductMediaSettings যেভাবে আছে ঠিক সেভাবেই)।

---

## ৪. 🔴 সবচেয়ে গুরুত্বপূর্ণ আর্কিটেকচারাল সিদ্ধান্ত — "instant পেমেন্ট" আসলে কোন গেটওয়েগুলোতে সত্যি instant

এই প্ল্যাটফর্মে বর্তমানে অনলাইন পেমেন্টের ২টা আলাদা রকম ফ্লো আছে (`online_payment_context.md`):

1. **Personal-wallet "send & verify"** (Phase A, bKash/Nagad/Rocket personal নম্বর) — কাস্টমার টাকা পাঠায়, TrxID সাবমিট করে, **সেলার ম্যানুয়ালি ভেরিফাই করে অ্যাপ্রুভ করার পর** `payment_status` পাল্টায়। এটা **instant না** — সেলার ঘুমিয়ে থাকলে বা ব্যস্ত থাকলে কাস্টমার ঘণ্টার পর ঘণ্টা অপেক্ষা করবে। ডিজিটাল প্রোডাক্টের মূল দাবির (instant delivery) সাথে সরাসরি সাংঘর্ষিক।
2. **৭টা automated merchant gateway** (SSLCommerz, AamarPay, ZiniPay, ShurjoPay, EPS, bKash Merchant, Nagad Merchant) — webhook/IPN দিয়ে সয়ংক্রিয়ভাবে `payment_status = 'paid'` হয়ে যায়, সেকেন্ডের মধ্যে। **এগুলোই একমাত্র সত্যিকারের instant পেমেন্ট পথ।**
3. **COD** — ডিজিটাল প্রোডাক্টে অর্থহীন (ডেলিভার করার কিছু নেই যা "হাতে দিয়ে" টাকা তোলা যায়), সম্পূর্ণ বাদ দিতে হবে।

**সিদ্ধান্ত দরকার (user confirm করবে):**
- ডিজিটাল-অনলি চেকআউটে personal-wallet "send & verify" সম্পূর্ণ **বন্ধ** রাখা হবে (শুধু ৭টা automated gateway + হয়তো balance/wallet-credit পদ্ধতি দেখানো হবে), নাকি
- wallet allow করা হবে কিন্তু UI-তে স্পষ্ট লেখা থাকবে "এই পদ্ধতিতে সেলার ভেরিফাই করার পর ডাউনলোড লিংক পাবেন (instant না)" — কম কড়াকড়ি কিন্তু requirement-এর সাথে আপোষ।

**সুপারিশ:** প্রথম option — ডিজিটাল প্রোডাক্ট চেকআউটে শুধু automated gateway দেখানো, কারণ এটাই আসল product promise ("instant") রক্ষা করে। যেসব সেলারের কোনো automated gateway কানেক্ট নাই তারা আপাতত ডিজিটাল প্রোডাক্ট বিক্রি করতে পারবে না — dashboard-এ স্পষ্ট prompt ("ডিজিটাল প্রোডাক্ট বিক্রি করতে আগে একটা automated payment gateway কানেক্ট করুন")।

`DigitalDeliveryService`-এর ট্রিগার পয়েন্ট হবে `OnlinePaymentController`-এর gateway webhook/IPN handler-এ (`gatewayIpn()`, [OnlinePaymentController.php:139](backend/app/Http/Controllers/Api/OnlinePaymentController.php)) যেখানে `payment_status` `'paid'` সেট হয় — `OrderStatusService::transition()`-এর মতো কোনো status-change হুক না, কারণ ডিজিটাল ডেলিভারি order **status** (confirmed/shipped/delivered) না, order **payment** ইভেন্টে বাঁধা।

---

## ৫. Mixed cart (এক অর্ডারে ফিজিকাল + ডিজিটাল একসাথে) — স্কোপ সিদ্ধান্ত

ফিজিকাল ফুলফিলমেন্ট (কুরিয়ার বুকিং eligibility, waybill/label PDF, "ready to ship" লিস্ট, ইনভেন্টরি রিজার্ভেশন — `OrderStatusService::adjustInventoryForStatusTransition()`) সবকিছুই ধরে নেয় পুরো অর্ডার ফিজিকাল। একই অর্ডারে ডিজিটাল আইটেম মিশে গেলে এই সবগুলো জায়গায় "ডিজিটাল আইটেম বাদ দিয়ে চিন্তা করো" লজিক ছড়িয়ে দিতে হবে — বড় blast radius, অনেক জায়গায় টাচ করতে হবে।

**সুপারিশ (Phase 1 স্কোপ):** cart-এ ফিজিকাল ও ডিজিটাল আইটেম একসাথে থাকলে checkout-এ বাধা দেওয়া/আলাদা করে দুইটা অর্ডার বানানো — landing page/storefront-এ "cart-এ ডিজিটাল প্রোডাক্ট আছে, ফিজিকাল প্রোডাক্টের সাথে একসাথে চেকআউট করা যাবে না, আলাদা অর্ডার করুন" মেসেজ। এতে বিদ্যমান courier/waybill/inventory কোডের কোথাও touch করতে হবে না — ডিজিটাল অর্ডার সম্পূর্ণ নতুন, প্যারালাল পাইপলাইন। Mixed-cart সাপোর্ট চাইলে পরে আলাদা ফেজে করা যাবে।

---

## ৬. Storage capacity — ops-level সতর্কতা (honest flag, glossed over করা হচ্ছে না)

এই সার্ভারে (`df -h /`) মোট 49G-এর মধ্যে **এখন 21G ফাঁকা**। শুধু `'local'` disk ব্যবহার হচ্ছে, `.env`-এ S3/object-storage credential ফাঁকা। একাধিক সেলার বড় সাইজের ফাইল (video course, software installer) আপলোড শুরু করলে ডিস্ক দ্রুত ভরে যেতে পারে, আর এই একই ডিস্কে production DB + সব সেলারের প্রোডাক্ট ইমেজ + কোডবেসও আছে — ডিস্ক ফুল হলে পুরো প্ল্যাটফর্ম ডাউন হয়ে যাওয়ার ঝুঁকি।

**সুপারিশ:**
- Phase 1-এ `max_file_size_mb` ডিফল্ট রক্ষণশীল রাখা (যেমন ১০০-২০০ MB) যতক্ষণ না real ব্যবহার প্যাটার্ন দেখা যায়।
- Super-admin policy-তে per-seller **total storage quota** (শুধু per-file সাইজ না) যোগ করা বিবেচনা করা — Phase 1-এ নাও থাকতে পারে কিন্তু schema-তে জায়গা রাখা ভালো (`digital_product_settings.max_total_storage_mb` কলাম রেডি রাখা, enforce না করলেও)।
- ডিস্ক ব্যবহার একটা admin ড্যাশবোর্ড মেট্রিক হিসেবে দেখানো (মোট ডিজিটাল স্টোরেজ ব্যবহার) যাতে সমস্যা বড় হওয়ার আগে ধরা পড়ে।
- বড় স্কেলে (ভবিষ্যতে) S3-compatible object storage-এ migrate করার পথ খোলা রাখা — `filesystems.php`-এ `'s3'` disk আগে থেকেই কনফিগার-রেডি, শুধু `.env`-এ ক্রেডেনশিয়াল লাগবে, কোড পরিবর্তন লাগবে না (Laravel-এর disk abstraction দিয়েই কাজ হবে)।

---

## ৭. Anti-piracy — সীমাবদ্ধতা honest declare করা (bKash/WhatsApp ডকের মতোই)

Phase 1-এ যা থাকবে: expiring signed link + download-count cap + IP/user-agent লগ। এগুলো **casual reselling deterrent**, কিন্তু কেউ ফাইল ডাউনলোড করে অন্য কোথাও আপলোড করে দিলে সেটা আটকানোর কোনো উপায় এই ফেজে নেই (কোনো DRM/watermarking/streaming-only protection না)। এটা প্রায় সব ছোট SaaS ডিজিটাল-ডেলিভারি সিস্টেমের বাস্তবতা (Gumroad/SendOwl-এর মতো প্ল্যাটফর্মও একই মডেল ব্যবহার করে) — সম্পূর্ণ পাইরেসি-প্রুফ করা এই স্কোপের বাইরে, ভবিষ্যতে দরকার হলে আলাদা ফেজ।

---

## ৮. Phase 1-এর বাইরে (Non-goals)

- License-key generation (সফটওয়্যার কী বিক্রি — raw file download-এর চেয়ে ভিন্ন প্যাটার্ন, `digital_product_files`-এর বদলে `license_keys` pool দরকার হবে)
- DRM / watermarking / streaming-protected video
- Mixed cart (physical+digital একসাথে, §৫ দ্রষ্টব্য)
- Recurring/subscription ডিজিটাল প্রোডাক্ট (membership-স্টাইল)
- Affiliate/reseller
- S3/object storage migration (এখন schema-ready রাখা হবে শুধু, §৬)

---

## ৯. এখনো user-conferm বাকি সিদ্ধান্ত (কাজ শুরুর আগে দরকার)

1. §৪ — ডিজিটাল চেকআউটে personal-wallet "send & verify" বন্ধ রাখা হবে, নাকি "not instant" ওয়ার্নিং দিয়ে allow করা হবে?
2. §৫ — Mixed cart Phase 1-এ block করা ঠিক আছে?
3. ডাউনলোড লিংক ডিফল্ট মেয়াদ ও max-download সংখ্যা কত রাখা উচিত (যেমন ৭ দিন / ৫ বার) — সুপার-অ্যাডমিন কনফিগারযোগ্য হবে, কিন্তু ডিফল্ট লাগবে।
4. Phase 1-এ কি "unlimited digital stock" ধরে নেওয়া ঠিক আছে, নাকি license-limited সংখ্যা (যেমন "শুধু ১০০ কপি বিক্রি হবে") দরকার এখনই?
5. File-size ডিফল্ট ক্যাপ (§৬ অনুযায়ী রক্ষণশীল সুপারিশ ১০০-২০০MB) — এটা গ্রহণযোগ্য?

---

## ১০. Build order (confirm হওয়ার পর)

1. Migrations: `products.product_type`, `digital_product_files`, `digital_product_settings`, `digital_deliveries` — isolated pgsql schema টেস্ট কনভেনশনে।
2. `Admin\DigitalProductSettingsController` (ProductMediaSettings-এর ক্লোন)।
3. Product create/edit ফ্লোতে `product_type` টগল + ফাইল আপলোড (policy enforce করে, ProductMediaController-এর প্যাটার্নে)।
4. `DigitalDeliveryController` (`GET /d/{token}`, পাবলিক, hash_equals + expiry + count চেক)।
5. `DigitalDeliveryService` + `OnlinePaymentController`-এর automated-gateway webhook-এ হুক (§৪)।
6. `NotificationUseCaseBindingController`-এর whitelist-এ `digital_product_delivered` যোগ + ডিফল্ট SMS/Email টেমপ্লেট।
7. চেকআউট UI: ডিজিটাল-অনলি কার্টে ঠিকানা ফিল্ড লুকানো, COD/wallet বাদ (§৪ সিদ্ধান্ত অনুযায়ী), mixed-cart block (§৫)।
8. Thank-you/order-status পেজে ডাউনলোড লিংক দেখানো (in-app চ্যানেল, সবচেয়ে reliable)।
9. `StaffPermission::MODULE_KEYS` `'digital_products'` এন্ট্রি + ফ্রন্টএন্ড mirror (তিন জায়গায়)।
10. Backend টেস্ট: policy enforcement, token expiry/count, payment→delivery ট্রিগার শুধু automated gateway-তে, cross-shop leak না হওয়া, mixed-cart block।
11. ডকস: এই ফাইল আপডেট + `SAAS_MODULE_CONTEXT.md`/`feature_roadmap_context.md` ফ্লিপ।
