# WordPress/WooCommerce Connector — BSOL Connect (Context)

এই ফাইলে BSOL-এর WordPress/WooCommerce কানেক্টর (backend API surface + `wordpress-plugin/bsol-connect/` প্লাগিন) নিয়ে সবকিছু একসাথে — কেন শুরু হলো, কীভাবে বানানো হলো, এখন কী কী কাজ করে, আর কী বাকি। নতুন কোনো ফিচার এখানে যোগ করার আগে এই ফাইলটা পড়ে নেওয়া উচিত।

Master/related context: [[bsol_history_and_new_context.md]] §৫ (মূল ডিজাইন প্রথম প্রস্তাব হয় এখানে), `CONTEXT.md`, `SAAS_MODULE_CONTEXT.md`।

---

## ১. পটভূমি — কেন এবং কীভাবে শুরু

`bsol_history_and_new_context.md`-এ আলোচিত হয়েছিল যে BSOL-এর সবচেয়ে বড় গ্যাপ হলো "যাদের নিজের WooCommerce ওয়েবসাইট আছে" — তাদের জন্য কোনো কানেক্টর ছিল না। ডিজাইন সরাসরি adapt করা হয়েছে `zyro/wordpress_plugin/zayroo-connect`-এর প্রমাণিত "thin client" আর্কিটেকচার (WordPress প্লাগিন কোনো বিজনেস লজিক রাখে না, শুধু WooCommerce থেকে ডেটা তুলে BSOL API-তে পাঠায়, ফলাফল দেখায়) থেকে — সেই legacy প্লাগিনের প্রতিটা মডিউলের exact hook/nonce/AJAX-action/payload-shape আলাদাভাবে explore করে BSOL-এর নিজের backend API-র উপর বসানো হয়েছে।

৫টা ফেজে তৈরি হয়েছে (সব লাইভ, `bsol.zyrotechbd.com`-এ ডিপ্লয়ড):

| ফেজ | বিষয় | মূল কমিট |
|---|---|---|
| ১ | Connect/disconnect + Order sync + Fraud check (MVP) | `2415286`, `ed680a3` |
| ২ | আসল WordPress প্লাগিন (bsol-connect v1.0.0) + disconnect endpoint + plugin-download বাটন | `ada15bf`, `286db65` |
| ৩ | Product/Variant sync (v1.1.0) | `3136143`, `e28d52f` |
| ৪ | Courier booking — book/track/cancel/balance (v1.2.0) | `ee578e8`, `c4eab5e` |
| ৫ | Waybill/sticker PDF প্রিন্ট (v1.3.0) | `8d6b627`, `8937026` |

---

## ২. আর্কিটেকচার — ২টা ভিন্ন trust boundary

**Plugin-facing (`/api/connect/v1/*`)** — WordPress প্লাগিন থেকে সরাসরি BSOL-এ কল করে, `X-API-KEY` + `X-Client-Domain` হেডার দিয়ে অথেন্টিকেট (`AuthenticatePlatformApiKey` middleware, alias `connect_api_key`)। কোনো Sanctum session না — একটা ডোমেইন-বাউন্ড API key যা BSOL ড্যাশবোর্ড থেকে জেনারেট করা হয়। middleware সফল হলে `Auth::guard('sanctum')->setUser($merchant)` কল করে, ফলে ভিতরের যেকোনো reused controller (`OrderController`, `ProductController`, `CourierController`...) `auth()->user()` স্বাভাবিকভাবেই resolve করে — কোনো auth শিম লাগে না।

**Dashboard-facing (`/api/wordpress/*`)** — সাধারণ Sanctum + `owner_only` (Pattern B, credential ম্যানেজমেন্ট)। এখানেই সেলার API key জেনারেট/রিভোক করে আর প্লাগিন ডাউনলোড করে — এটা প্লাগিনের নিজের কল না, ব্রাউজার থেকে সরাসরি ড্যাশবোর্ড ইউজার কল করে।

`PlatformApiKey` মডেল (`backend/app/Models/PlatformApiKey.php`) — sha256-hashed key (raw value শুধু জেনারেশনের সময় একবার দেখানো হয়), `domain` ফিল্ড normalize করে রাখা (`normalizeHost()`), `status: pending|connected|revoked`।

**মূল নীতি:** প্রতিটা নতুন Connect endpoint বিদ্যমান dashboard controller-কেই delegate করে — নতুন বিজনেস লজিক লেখা হয় না। একটা synthetic `Request::create(...)` বানিয়ে সরাসরি `OrderController::store()`/`ProductController::store()`/`CourierController::book()` ইত্যাদি কল করা হয়, ফলে plan-limit gate, stock check, accounting/SMS side-effect — সব ফ্রি-তে ইনহেরিট হয়।

---

## ৩. Backend API surface — পূর্ণ তালিকা

সব রুট `backend/routes/api.php`-তে `Route::prefix('connect/v1')->middleware('connect_api_key')` গ্রুপের ভিতরে। `orders/sync-status` ছাড়া বাকিগুলো `active_subscription` + `throttle:120,1` সাব-গ্রুপে (সাবস্ক্রিপশন এক্সপায়ার হলেও `/connect`/`/disconnect` কাজ করা উচিত বলে ওই দুটো বাইরে)।

| Method | Route | Controller@Method | কাজ |
|---|---|---|---|
| POST | `/connect/v1/connect` | `ConnectAuthController@connect` | হ্যান্ডশেক — key+domain ভেরিফাই |
| POST | `/connect/v1/disconnect` | `ConnectAuthController@disconnect` | self-revoke (একই key দিয়ে) |
| POST | `/connect/v1/orders/sync` | `ConnectOrderController@sync` | অর্ডার create/update, SKU দিয়ে product/variant লিংক |
| POST | `/connect/v1/orders/sync-status` | `ConnectOrderController@syncStatus` | BSOL-canonical status ট্রানজিশন |
| POST | `/connect/v1/products/sync` | `ConnectProductController@sync` | Simple/variable প্রোডাক্ট + ভ্যারিয়েন্ট create/update |
| POST | `/connect/v1/courier/book` | `ConnectCourierController@book` | Steadfast/Paperfly/manual বুকিং |
| POST | `/connect/v1/courier/track` | `ConnectCourierController@track` | স্ট্যাটাস রিফ্রেশ |
| POST | `/connect/v1/courier/cancel` | `ConnectCourierController@cancel` | বুকিং বাতিল |
| GET | `/connect/v1/courier/balance` | `ConnectCourierController@balance` | Steadfast ব্যালেন্স |
| GET | `/connect/v1/courier/waybill` | `ConnectCourierController@waybill` | Waybill/sticker PDF স্ট্রিম |
| POST | `/connect/v1/fraud/check-phone` | `ConnectFraudController@checkPhone` | ফোন ফ্রড/ডেলিভারি-হিস্ট্রি চেক |

Dashboard-facing (Sanctum, `/api/wordpress/*`, `backend/app/Http/Controllers/Api/WordpressApiKeyController.php`):

| Method | Route | কাজ |
|---|---|---|
| GET | `/wordpress/api-key` | বর্তমান key স্ট্যাটাস দেখা |
| POST | `/wordpress/api-key` | Key জেনারেট/রিজেনারেট |
| DELETE | `/wordpress/api-key` | Key রিভোক (soft) |
| GET | `/wordpress/plugin-download` | (পাবলিক) প্লাগিন zip — সোর্স থেকে **প্রতি রিকোয়েস্টে dynamically তৈরি**, তাই কখনো stale হয় না |

Backend সোর্স: `backend/app/Http/Controllers/Api/Connect/{ConnectAuthController,ConnectOrderController,ConnectProductController,ConnectCourierController,ConnectFraudController}.php` + `backend/app/Models/PlatformApiKey.php` + `backend/app/Http/Middleware/AuthenticatePlatformApiKey.php`।

---

## ৪. WordPress প্লাগিন — ফাইল স্ট্রাকচার

```
wordpress-plugin/bsol-connect/          (v1.3.0)
  bsol-connect.php                      — bootstrap, প্লাগিন হেডার, constants (BSOL_API_URL ইত্যাদি)
  includes/
    class-bsol-activator.php            — activation hook: bsol_api_key/domain/shop_name/connected_at options seed
    class-bsol-master.php               — module loader + is_connected() গেট + WooCommerce-active গার্ড
    classes/
      class-bsol-api.php                — HTTP ক্লায়েন্ট (সব BSOL কলের একমাত্র জায়গা)
      class-bsol-helpers.php            — BD ফোন ক্লিনিং, site_domain(), WC→BSOL status map
    admin/
      class-bsol-admin.php              — Settings + Dashboard ট্যাব (connect/disconnect ফর্ম, fraud-check tester, Steadfast balance widget)
    modules/
      order-sync/class-bsol-order-sync.php     — woocommerce_new_order / order_status_changed hooks
      product-sync/class-bsol-product-sync.php — save_post_product / quick_edit / reduce_order_stock hooks
      courier/class-bsol-courier.php           — Courier কলাম, book/track/cancel AJAX, waybill admin-post proxy
      fraud/class-bsol-fraud-check.php         — Customer Health কলাম + AJAX (shared bsol-admin script/style এখানেই enqueue হয়)
  assets/
    css/bsol-admin.css
    js/bsol-admin.js                    — health-bar polling + courier book/track/cancel বাটন হ্যান্ডলার (delegated events)
  changelog.md, SETUP.md
```

`Bsol_Master::load_dependencies()`-এ সব require + `Bsol_Admin` সবসময় ইনস্ট্যান্শিয়েট (menu সবসময় দেখা যায়), বাকি ৪টা মডিউল (`Bsol_Order_Sync`, `Bsol_Fraud_Check`, `Bsol_Product_Sync`, `Bsol_Courier`) শুধু `is_connected() && class_exists('WooCommerce')` হলে।

---

## ৫. প্রতিটা মডিউলের বিস্তারিত

### Connect/disconnect (`class-bsol-admin.php`)
প্লেইন self-posting ফর্ম (AJAX না) — `bsol_submit_connect`/`bsol_disconnect` POST field, nonce `bsol_save_settings`/`bsol_disconnect_action`। কানেক্ট হলে `bsol_domain`/`bsol_shop_name`/`bsol_connected_at` অপশন সেভ হয়। Disconnect best-effort (BSOL আনরিচেবল হলেও লোকাল অপশন ক্লিয়ার হয়ে যায়, সাইট কখনো "আটকে" থাকে না)।

### Order sync (`class-bsol-order-sync.php`)
`woocommerce_new_order` → `/orders/sync` (create), `woocommerce_order_status_changed` → status map দিয়ে ট্রান্সলেট করে (`Bsol_Helpers::status_map()`, filterable via `bsol_connect_status_map`) → `/orders/sync-status`। **WC স্ট্যাটাস ভোকাবুলারি ট্রান্সলেশন প্লাগিনের দায়িত্ব** — backend শুধু BSOL-canonical স্ট্যাটাস (`pending,confirmed,processing,shipped,delivered,cancelled,returned`) নেয়, যাতে API ভবিষ্যতে অন্য প্ল্যাটফর্মের জন্যও স্থিতিশীল থাকে।

### Product sync (`class-bsol-product-sync.php`)
`save_post_product`/`quick_edit_save`/`reduce_order_stock` হুক (zayroo-connect-এর প্রমাণিত trigger সেট)। Simple + variable — variable প্রোডাক্টের প্রতিটা variation আলাদা payload এন্ট্রি। WC-এর regular/sale price BSOL-এর amount-discount মডেলে ট্রান্সলেট হয়। SKU না থাকলে `WC-{id}` fallback (BSOL-এ SKU required)। **শুধু outbound (WC→BSOL)** — inbound stock push-back (BSOL→WC) এখনো তৈরি হয়নি (§৭ দেখুন)।

### Courier booking (`class-bsol-courier.php`)
Order-list-এ "Courier" কলাম (legacy + HPOS হুক জোড়া)। বুক না হলে "Send via Steadfast"/"Send via Paperfly" বাটন; বুক হলে consignment info + refresh/cancel/print লিংক। **শুধু Steadfast আর Paperfly সাপোর্টেড** — Pathao/RedX/Carrybee-এর নিজস্ব city/zone/area **ID** লাগে যা একটা WooCommerce অর্ডারে থাকে না (§৭-এ বিস্তারিত)। Meta HPOS-native (`WC_Order::get_meta()`/`update_meta_data()`, zayroo-connect-এর `update_post_meta()`-এর চেয়ে ভালো — legacy কোডটা HPOS হুক রেজিস্টার করেও আসলে HPOS-safe ছিল না)।

### Waybill PDF (`class-bsol-courier.php`-এর অংশ)
বুক করা অর্ডারের পাশে প্রিন্টার আইকন — নতুন কোনো PDF লজিক না, BSOL-এর আগে থেকেই থাকা ২২-টেমপ্লেট `WaybillPdfService` (বারকোড/QR/বাংলা HarfBuzz শেপিং) সরাসরি reuse। **এটা AJAX না, প্লেইন লিংক + `admin-post.php` handler** — ব্রাউজার নিজে থেকে প্লাগিনের API key attach করতে পারে না, তাই WordPress সার্ভার-সাইডে PDF fetch করে (যেখানে key জানা আছে) ব্রাউজারে স্ট্রিম করে দেয় (zayroo-connect-এর CSV-export-এর মতোই standard WP প্যাটার্ন)।

### Fraud check (`class-bsol-fraud-check.php`)
Order-list-এ "Customer Health" কলাম, AJAX-লোডেড, ২৪ ঘণ্টা transient cache। এই ফাইলই shared `bsol-admin` script/style enqueue করে + `bsol_ajax` object localize করে (health nonce + courier nonce একসাথে) — courier মডিউল এই একই enqueue-এর উপর নির্ভর করে।

### Plugin download (`WordpressApiKeyController::downloadPlugin()`, backend)
`/dashboard/settings/wordpress` পেজের "Download Plugin" বাটন এই এন্ডপয়েন্টে যায়। **প্রতি রিকোয়েস্টে `wordpress-plugin/bsol-connect/` সোর্স থেকে zip ডায়নামিকভাবে তৈরি হয়** (ভার্সন নাম্বার প্লাগিন হেডার থেকে regex দিয়ে পড়া) — একটা আলাদা pre-built zip মেইনটেইন করার দরকার নেই, কখনো stale হবে না। পাবলিক (কোনো secret নেই zip-এ), শুধু `throttle:20,1`।

---

## ৬. টেস্টিং কনভেনশন (এই কানেক্টরের জন্য প্রতিষ্ঠিত)

- Feature test ফাইল: `backend/tests/Feature/{ConnectApiTest,PlatformApiKeyApiTest,ConnectProductSyncTest,ConnectCourierTest}.php`।
- সব টেস্ট **isolated Postgres schema**-তে যাচাই করা হয়েছে, `hybrid_platform` প্রোডাকশন DB কখনো টাচ হয়নি:
  ```bash
  PGPASSWORD='...' psql -U hybrid_app -h 127.0.0.1 -d hybrid_platform -c "CREATE SCHEMA IF NOT EXISTS test_xxx;"
  # config/database.php-এর pgsql.search_path সাময়িকভাবে env('DB_SCHEMA','public') করে
  DB_SCHEMA=test_xxx php artisan test ...
  # তারপর schema DROP + config/database.php রিভার্ট
  ```
- প্রতিটা নতুন migration-এর পর **`php artisan migrate --force` প্রোডাকশনে আলাদাভাবে রান করতে হয়** — Phase ১-এ একবার ভুলে যাওয়ায় লাইভ সাইটে 500 হয়েছিল (দেখুন memory: `deploy-checklist-bsol`)।
- Plugin ফাইল: `php -l` সব ফাইলে + hook-name/nonce-action/AJAX-action name cross-check (`grep` দিয়ে PHP আর JS-এর মধ্যে মিল যাচাই) — কোনো WordPress ইনস্টল এই ডেভ এনভায়রনমেন্টে নেই, তাই real end-to-end QA-এর জন্য `SETUP.md`-এর চেকলিস্ট ব্যবহার করতে হয় আসল WooCommerce স্টাজিং সাইটে।

---

## ৭. যা এখনো বাকি (স্পষ্টভাবে deferred, ভুলে না-করা না)

| ফিচার | কেন এখনো নেই |
|---|---|
| Inbound stock push-back (BSOL→WooCommerce) | BSOL-কে নতুন করে সেলারের নিজস্ব ডোমেইনে outbound HTTP client হতে হবে (নতুন `Http::post()` কল, queue job, আর প্লাগিনে একটা reverse-auth ইনবাউন্ড REST route — zayroo-connect-এর `handle_api_sync()` + hook-unhook infinite-loop-প্রতিরোধ প্যাটার্ন)। আলাদা ফেজের যোগ্য স্কোপ। |
| Pathao/RedX/Carrybee কুরিয়ার বুকিং (WooCommerce অর্ডারের জন্য) | এই ৩টা কুরিয়ারের নিজস্ব city/zone/area **ID** লাগে যা WooCommerce অর্ডারে কখনো থাকে না। দরকার: address→location-ID resolver (reverse-geocode/fuzzy-match)। |
| OTP (চেকআউট) | ব্যাকএন্ডে `CheckoutOtpController` আছে কিন্তু `landing_page_id`-স্কোপড, WC-এর জন্য জেনারেলাইজ করতে হবে। |
| Facebook CAPI (WooCommerce অর্ডার থেকে) | বর্তমান `FacebookCapiClient`/`SendFacebookCapiPurchaseEventJob` শুধু ল্যান্ডিং-পেজ চেকআউট থেকে ফায়ার করে, external order source নিতে জেনারেলাইজ করতে হবে। |
| WP-admin bulk/historical sync UI | zayroo-connect-এর "Sync Data" ট্যাব (progress bar-সহ bulk historical sync) — ভালো UX কিন্তু নতুন প্রোডাক্ট/অর্ডার সিঙ্ক শুরু করার জন্য জরুরি না। |
| Order invoice PDF (waybill থেকে আলাদা, seller→customer sales invoice) | `OrderController::invoicePdf()` একই delegate প্যাটার্নে সহজেই এক্সপোজ করা যায়, শুধু এখনো করা হয়নি। |

---

## ৮. মূল ডিজাইন সিদ্ধান্ত (ভবিষ্যতে অনুসরণ করার জন্য)

1. **Delegate, duplicate না** — প্রতিটা Connect controller বিদ্যমান dashboard controller-কে synthetic `Request::create()` দিয়ে কল করে। এতে প্ল্যান-লিমিট, stock check, accounting side-effect ফ্রি-তে আসে, আর দুই জায়গায় লজিক maintain করতে হয় না।
2. **WC→BSOL সিমান্টিক ট্রান্সলেশন প্লাগিনের দায়িত্ব**, ব্যাকএন্ডের না — status vocabulary, price/discount মডেল অনুবাদ সব প্লাগিন সাইডে হয়, যাতে backend API ভবিষ্যতে অন্য প্ল্যাটফর্মের (Shopify ইত্যাদি) জন্যও reuse করা যায়।
3. **যা কাজ করে না তার জন্য পরিষ্কার লোকাল এরর দাও, রিমোট API-কে ক্রিপ্টিক ফেইল করতে দিও না** — Pathao/RedX/Carrybee-এর `unsupported_courier` এরর এর সবচেয়ে ভালো উদাহরণ।
4. **Global-uniqueness collision handle করো, crash না করে** — `product_variants.sku` পুরো ইনস্টলজুড়ে ইউনিক, তাই দুই সেলারের SKU কলিশন হতে পারে; per-variant warning দিয়ে বাকি সিঙ্ক চালিয়ে যাওয়া হয় (`ConnectProductController::sync()`)।
5. **HPOS-native মেটা** — `WC_Order::get_meta()`/`update_meta_data()`, কখনো `update_post_meta()` না, এমনকি legacy hook variant রেজিস্টার করলেও।
6. **ফাইল-ডাউনলোড এন্ডপয়েন্ট ≠ JSON এন্ডপয়েন্ট** — ব্রাউজার থেকে trigger হওয়া যেকোনো কিছু (waybill PDF) এর API key ব্রাউজারে পাঠানো যাবে না; সার্ভার-সাইড proxy (`admin-post.php`) লাগবেই।
7. **Dynamic generation যেখানেই সম্ভব, pre-built artifact না** — প্লাগিন zip প্রতি রিকোয়েস্টে সোর্স থেকে বানানো হয়, কখনো stale হয় না।
