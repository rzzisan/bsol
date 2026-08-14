# WordPress/WooCommerce Connector — BSOL Connect (Context)

এই ফাইলে BSOL-এর WordPress/WooCommerce কানেক্টর (backend API surface + `wordpress-plugin/bsol-connect/` প্লাগিন) নিয়ে সবকিছু একসাথে — কেন শুরু হলো, কীভাবে বানানো হলো, এখন কী কী কাজ করে, আর কী বাকি। নতুন কোনো ফিচার এখানে যোগ করার আগে এই ফাইলটা পড়ে নেওয়া উচিত।

Master/related context: [[bsol_history_and_new_context.md]] §৫ (মূল ডিজাইন প্রথম প্রস্তাব হয় এখানে), `CONTEXT.md`, `SAAS_MODULE_CONTEXT.md`।

---

## ১. পটভূমি — কেন এবং কীভাবে শুরু

`bsol_history_and_new_context.md`-এ আলোচিত হয়েছিল যে BSOL-এর সবচেয়ে বড় গ্যাপ হলো "যাদের নিজের WooCommerce ওয়েবসাইট আছে" — তাদের জন্য কোনো কানেক্টর ছিল না। ডিজাইন সরাসরি adapt করা হয়েছে `zyro/wordpress_plugin/zayroo-connect`-এর প্রমাণিত "thin client" আর্কিটেকচার (WordPress প্লাগিন কোনো বিজনেস লজিক রাখে না, শুধু WooCommerce থেকে ডেটা তুলে BSOL API-তে পাঠায়, ফলাফল দেখায়) থেকে — সেই legacy প্লাগিনের প্রতিটা মডিউলের exact hook/nonce/AJAX-action/payload-shape আলাদাভাবে explore করে BSOL-এর নিজের backend API-র উপর বসানো হয়েছে।

১৮টা ফেজে তৈরি হয়েছে (সব লাইভ, `bsol.zyrotechbd.com`-এ ডিপ্লয়ড):

| ফেজ | বিষয় | মূল কমিট |
|---|---|---|
| ১ | Connect/disconnect + Order sync + Fraud check (MVP) | `2415286`, `ed680a3` |
| ২ | আসল WordPress প্লাগিন (bsol-connect v1.0.0) + disconnect endpoint + plugin-download বাটন | `ada15bf`, `286db65` |
| ৩ | Product/Variant sync (v1.1.0) | `3136143`, `e28d52f` |
| ৪ | Courier booking — book/track/cancel/balance (v1.2.0) | `ee578e8`, `c4eab5e` |
| ৫ | Waybill/sticker PDF প্রিন্ট (v1.3.0) | `8d6b627`, `8937026` |
| ৬ | Reliability/hygiene — HPOS compat, Activity Log, sync retry, uninstall.php, product trash sync (v1.4.0) | `8376732` |
| ৭ | Inbound stock push-back (BSOL→WooCommerce, v1.5.0) | `90d711d` |
| ৮ | Pathao/RedX/CarryBee location resolver (v1.6.0) | `6a687d1` |
| ৯ | Checkout OTP for WooCommerce (v1.7.0) | `eb312f1` |
| ১০ | Facebook CAPI for WooCommerce (v1.8.0) | `3a5162a` |
| ১১ | Bulk/historical sync UI (v1.9.0) | `8de63b6` |
| ১২ | Order invoice PDF (v1.10.0) | `e1dfa2a` |
| ১৩ | Distribution/polish — self-update notice, .pot, readme.txt (v1.11.0) | `1c06c5a` |
| ১৪ | Admin UI redesign (BSOL brand) + courier column "Book to Courier" picker (v1.12.0) | `f2c8f9a` |
| ১৫ | Customer Health redesign — কুরিয়ার ডেলিভারি-হিস্ট্রি প্রোগ্রেস বার + breakdown popover (v1.13.0) | `86cc12f` |
| ১৬ | Multi-site WooCommerce connections — একাধিক সাইট, order/product site-tagging, order-list site filter (backend + frontend, প্লাগিন অপরিবর্তিত) | `4715d92` |
| ১৭ | Incomplete/Abandoned Order Tracking (WooCommerce) — checkout-in-progress ক্যাপচার, সাইট-ফ্ল্যাগড, বিদ্যমান abandoned-checkouts সিস্টেম reuse (v1.14.0) | `9fe4ff8` |
| ১৮ | Repeat order block (WooCommerce) — একই ফোন নম্বর দিয়ে X ঘণ্টার মধ্যে repeat checkout ব্লক, ক্লাসিক + block-based checkout দুটোতেই, সম্পূর্ণ WP-লোকাল (v1.15.0) | `830c761` |

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
| POST | `/connect/v1/orders/sync` | `ConnectOrderController@sync` | অর্ডার create/update, SKU দিয়ে product/variant লিংক; create-এ OTP send + Facebook CAPI Purchase event dispatch (উভয়ই টগল/সেটিংসের উপর নির্ভরশীল, no-op ডিফল্ট); `is_historical_sync:true` হলে দুটোই স্কিপ (bulk-sync backfill, Phase ১১) |
| POST | `/connect/v1/orders/sync-status` | `ConnectOrderController@syncStatus` | BSOL-canonical status ট্রানজিশন |
| GET | `/connect/v1/orders/invoice` | `ConnectOrderController@invoicePdf` | সেলস ইনভয়েস PDF স্ট্রিম, কোনো booking precondition ছাড়াই |
| POST | `/connect/v1/products/sync` | `ConnectProductController@sync` | Simple/variable প্রোডাক্ট + ভ্যারিয়েন্ট create/update |
| POST | `/connect/v1/checkout/abandoned` | `ConnectAbandonedCheckoutController@save` | checkout-in-progress ক্যাপচার (Phase ১৭) — best-effort, `abandoned_checkouts`-এ delegate |
| POST | `/connect/v1/courier/book` | `ConnectCourierController@book` | Steadfast/Paperfly/manual বুকিং |
| POST | `/connect/v1/courier/track` | `ConnectCourierController@track` | স্ট্যাটাস রিফ্রেশ |
| POST | `/connect/v1/courier/cancel` | `ConnectCourierController@cancel` | বুকিং বাতিল |
| GET | `/connect/v1/courier/balance` | `ConnectCourierController@balance` | Steadfast ব্যালেন্স |
| GET | `/connect/v1/courier/waybill` | `ConnectCourierController@waybill` | Waybill/sticker PDF স্ট্রিম |
| POST | `/connect/v1/fraud/check-phone` | `ConnectFraudController@checkPhone` | ফোন ফ্রড/ডেলিভারি-হিস্ট্রি চেক (in-house fraud_score) |
| POST | `/connect/v1/fraud/courier-health` | `ConnectFraudController@courierHealth` | প্রতি-কুরিয়ার ডেলিভারি breakdown (Customer Health প্রোগ্রেস বার-এর ডেটা সোর্স) |
| POST | `/connect/v1/orders/verify-otp` | `ConnectCheckoutOtpController@verify` | চেকআউট OTP ভেরিফাই (order-received পেজ থেকে relay) |
| POST | `/connect/v1/orders/resend-otp` | `ConnectCheckoutOtpController@resend` | OTP পুনরায় পাঠানো |

Dashboard-facing (Sanctum, `/api/wordpress/*`, `backend/app/Http/Controllers/Api/WordpressApiKeyController.php`):

| Method | Route | কাজ |
|---|---|---|
| GET | `/wordpress/api-keys` | কানেক্টেড সাইটগুলোর **লিস্ট** (Phase ১৬-এর আগে সিঙ্গেল অবজেক্ট ছিল) |
| POST | `/wordpress/api-keys` | নতুন সাইটের জন্য key জেনারেট, অথবা একই domain হলে রিজেনারেট (id অপরিবর্তিত থাকে) |
| DELETE | `/wordpress/api-keys/{id}` | নির্দিষ্ট সাইটের key রিভোক (soft) |
| PUT | `/wordpress/api-keys/{id}/otp-settings` | নির্দিষ্ট সাইটের চেকআউট OTP টগল অন/অফ (key regenerate ছাড়াই) |
| GET | `/wordpress/plugin-download` | (পাবলিক) প্লাগিন zip — সোর্স থেকে **প্রতি রিকোয়েস্টে dynamically তৈরি**, তাই কখনো stale হয় না |
| GET | `/wordpress/plugin-version` | (পাবলিক) `{version, download_url}` — self-update notice-এর জন্য (Phase ১৩) |

Backend সোর্স: `backend/app/Http/Controllers/Api/Connect/{ConnectAuthController,ConnectOrderController,ConnectProductController,ConnectCourierController,ConnectFraudController}.php` + `backend/app/Models/PlatformApiKey.php` + `backend/app/Http/Middleware/AuthenticatePlatformApiKey.php`।

**Multi-site (Phase ১৬)**: একজন সেলার একাধিক WooCommerce সাইট কানেক্ট করতে পারে — `platform_api_keys`-এর আগের `unique('user_id')` তুলে `unique(['user_id','domain'])` করা হয়েছে (`FacebookPageConnection`-এর precedent অনুসরণ করে)। প্রতিটা synced order/product-এ এখন `platform_api_key_id` কলাম আছে (কোন সাইট থেকে এসেছে), আর `orders`/`products`-এর `(user_id, source_ref)` unique index widen করে `(user_id, platform_api_key_id, source_ref)` করা হয়েছে — কারণ দুইটা আলাদা WooCommerce সাইট নিজেদের অর্ডার/প্রোডাক্ট ১, ২, ৩... থেকে নাম্বার করে, `platform_api_key_id` ছাড়া দ্বিতীয় সাইট কানেক্ট করলেই ডেটা কলিশন হতো। প্রতিটা Connect-surface অর্ডার/প্রোডাক্ট lookup (`ConnectOrderController`, `ConnectCourierController::findOrder()`, `ConnectCheckoutOtpController::findOrder()`, `ConnectProductController::sync()`) এখন requesting site-এর `platform_api_key_id` দিয়ে scoped। `PushWooCommerceStockJob` এখন "যেকোনো connected key" না, প্রোডাক্ট/ভ্যারিয়েন্টের নিজস্ব `platform_api_key_id` থেকে সঠিক সাইট resolve করে। ড্যাশবোর্ডে: WordPress Connect পেজ এখন একটা লিস্ট UI (`frontend/src/app/dashboard/settings/wordpress/page.tsx`), Order লিস্টে site filter + domain badge (`frontend/src/app/dashboard/orders/page.tsx`)।

**উল্টো দিক — BSOL → WordPress (inbound, শুধু stock push-back, Phase ৭)**: এটা `/connect/v1/*`-এর অংশ না, বরং প্লাগিন নিজেই একটা WP REST route এক্সপোজ করে — `POST https://{seller-domain}/wp-json/bsol-connect/v1/stock-update`, body `{wc_id, stock_quantity}`, header `X-BSOL-Webhook-Secret` দিয়ে অথেন্টিকেট। BSOL-সাইড ট্রিগার: `Product::booted()`/`ProductVariant::booted()`-এর `saved` hook (`stock`/`stock_qty` পরিবর্তন + `source=woocommerce` + `source_ref` থাকলে) → `PushWooCommerceStockJob` (queued, Redis) → `WooCommerceStockPushService`। `ConnectProductController::sync()` নিজের ২টা write-কে `Product::withoutEvents()`/`ProductVariant::withoutEvents()`-এ wrap করে রাখে, নাহলে নিজের গ্রহণ করা ইনবাউন্ড sync-ই সাথে সাথে এই push আবার ট্রিগার করে ফেলত।

---

## ৪. WordPress প্লাগিন — ফাইল স্ট্রাকচার

```
wordpress-plugin/bsol-connect/          (v1.15.0)
  bsol-connect.php                      — bootstrap, প্লাগিন হেডার, constants (BSOL_API_URL ইত্যাদি), HPOS compatibility declaration
  uninstall.php                         — সব option/transient cleanup + best-effort key revoke (শুধু Delete-এ, deactivate-এ না)
  includes/
    class-bsol-activator.php            — activation hook: bsol_api_key/domain/shop_name/connected_at/webhook_secret options seed
    class-bsol-master.php               — module loader + is_connected() গেট + WooCommerce-active গার্ড
    classes/
      class-bsol-api.php                — HTTP ক্লায়েন্ট (সব BSOL কলের একমাত্র জায়গা, প্রতিটা কল Bsol_Activity_Log-এ লগ হয়)
      class-bsol-activity-log.php       — শেষ ৫০টা sync কলের success/fail লগ (capped option, Activity Log ট্যাবে দেখা যায়)
      class-bsol-helpers.php            — BD ফোন ক্লিনিং, site_domain(), WC→BSOL status map
      class-bsol-update-checker.php     — self-update notice; `is_connected()` গেটের **বাইরে**, সবসময় সক্রিয় (Phase ১৩)
    admin/
      class-bsol-admin.php              — Settings + Dashboard + Activity Log + Sync Data ট্যাব (connect/disconnect ফর্ম, fraud-check tester, Steadfast balance widget, bulk-sync বাটন)
    modules/
      order-sync/class-bsol-order-sync.php     — woocommerce_new_order / order_status_changed hooks + ব্যর্থ sync retry (WP-Cron, ৩ বার, ৫ মিনিট পরপর) + OTP-required মেটা সেভ; `handle_new_order()`/`build_order_payload()` এখন `$is_historical_sync` প্যারামিটার নেয় (Phase ১১)
      product-sync/class-bsol-product-sync.php — outbound: save_post_product / quick_edit / reduce_order_stock / trashed-deleted hooks + retry (২ মিনিট পরপর); inbound: `rest_api_init`-এ `/wp-json/bsol-connect/v1/stock-update` রুট রেজিস্টার (stock push-back, §৩ দেখুন)
      courier/class-bsol-courier.php           — Courier কলাম (৫ কুরিয়ার বাটন), book/track/cancel AJAX, waybill admin-post proxy
      fraud/class-bsol-fraud-check.php         — Customer Health কলাম + AJAX (shared bsol-admin script/style এখানেই enqueue হয়)
      checkout-otp/class-bsol-checkout-otp.php — **প্রথম storefront (wp-admin না) মডিউল** — order-received পেজে OTP গেট, nopriv AJAX verify/resend (Phase ৯)
      bulk-sync/class-bsol-bulk-sync.php       — "Sync Data" ট্যাবের AJAX ব্যাকএন্ড; `Bsol_Master`-এর inject করা `Bsol_Product_Sync`/`Bsol_Order_Sync` ইনস্ট্যান্স reuse করে, নিজে কখনো `new` করে না (Phase ১১)
      invoice/class-bsol-invoice.php           — "Invoice" কলাম, কোনো booking precondition নেই; admin-post proxy waybill-এরই মতো (Phase ১২)
      abandoned-checkout/class-bsol-abandoned-checkout.php — **দ্বিতীয় storefront মডিউল** (checkout-otp-এর পরে) — checkout-in-progress ক্যাপচার, WC()->cart থেকে সরাসরি (DOM scraping না); nopriv AJAX relay (Phase ১৭)
      repeat-order-block/class-bsol-repeat-order-block.php — একই ফোনে repeat checkout ব্লক, সম্পূর্ণ WP-লোকাল (কোনো BSOL API কল নেই); classic (`woocommerce_checkout_process`) + block checkout (`woocommerce_store_api_checkout_update_order_from_request` + `RouteException`) দুটোই কভার্ড, সেটিংস wp-admin-এই (Phase ১৮)
  assets/
    css/bsol-admin.css, js/bsol-admin.js       — wp-admin-only (health-bar polling, courier বাটন হ্যান্ডলার, bulk-sync progress bar — এই দুটোর জন্য আলাদা স্বাধীন jQuery(ready) ব্লক, যেহেতু `bsol_ajax`/`bsol_bulk_sync` আলাদা স্ক্রিনে লোকালাইজ হয়)
    css/bsol-checkout-otp.css, js/bsol-checkout-otp.js — storefront-only, শুধু order-received পেজে enqueue হয়
  languages/bsol-connect.pot            — hand-রোল করা (এই ডেভ এনভায়রনমেন্টে `wp-cli` নেই, তাই `wp i18n make-pot` চালানো যায়নি) — নতুন স্ট্রিং যোগ হলে regenerate করতে হবে, হাতে মেইনটেইন না
  changelog.md, SETUP.md, readme.txt
```

`Bsol_Master::load_dependencies()`-এ সব require + `Bsol_Admin` সবসময় ইনস্ট্যান্শিয়েট (menu সবসময় দেখা যায়), বাকি মডিউলগুলো (`Bsol_Order_Sync`, `Bsol_Fraud_Check`, `Bsol_Product_Sync`, `Bsol_Courier`, `Bsol_Checkout_Otp`, `Bsol_Bulk_Sync`, `Bsol_Invoice`, `Bsol_Abandoned_Checkout`, `Bsol_Repeat_Order_Block`) শুধু `is_connected() && class_exists('WooCommerce')` হলে। `Bsol_Order_Sync`/`Bsol_Product_Sync` এখন `$this->admin`-এর মতোই `Bsol_Master`-এ property হিসেবে রাখা হয় (আগে create-then-discard ছিল) — `Bsol_Bulk_Sync`-এর constructor-এ inject করার জন্য, যাতে সেই ২টা ক্লাস দ্বিতীয়বার `new` না করতে হয় (করলে তাদের constructor-এর hook রেজিস্ট্রেশন duplicate হয়ে যেত)।

---

## ৫. প্রতিটা মডিউলের বিস্তারিত

### Connect/disconnect (`class-bsol-admin.php`)
প্লেইন self-posting ফর্ম (AJAX না) — `bsol_submit_connect`/`bsol_disconnect` POST field, nonce `bsol_save_settings`/`bsol_disconnect_action`। কানেক্ট হলে `bsol_domain`/`bsol_shop_name`/`bsol_connected_at` অপশন সেভ হয়। Disconnect best-effort (BSOL আনরিচেবল হলেও লোকাল অপশন ক্লিয়ার হয়ে যায়, সাইট কখনো "আটকে" থাকে না)।

### Order sync (`class-bsol-order-sync.php`)
`woocommerce_new_order` → `/orders/sync` (create), `woocommerce_order_status_changed` → status map দিয়ে ট্রান্সলেট করে (`Bsol_Helpers::status_map()`, filterable via `bsol_connect_status_map`) → `/orders/sync-status`। **WC স্ট্যাটাস ভোকাবুলারি ট্রান্সলেশন প্লাগিনের দায়িত্ব** — backend শুধু BSOL-canonical স্ট্যাটাস (`pending,confirmed,processing,shipped,delivered,cancelled,returned`) নেয়, যাতে API ভবিষ্যতে অন্য প্ল্যাটফর্মের জন্যও স্থিতিশীল থাকে।

**Facebook CAPI (Phase ১০)**: `build_order_payload()` এ ৩টা এক্সট্রা ফিল্ড — `client_ip`, `user_agent` (`WC_Order::get_customer_ip_address()`/`get_customer_user_agent()`, WooCommerce নিজেই checkout-এ ক্যাপচার করে, প্লাগিনের নতুন কিছু ট্র্যাক করার দরকার নেই), আর `event_source_url` (`wc_get_checkout_url()`)। BSOL-সাইড: `ConnectOrderController::sync()` এই ৩টা দিয়ে `SendFacebookCapiPurchaseEventJob::dispatch()` করে (create-এ, একবারই) — এটাই আগে থেকে ল্যান্ডিং-পেজ checkout-এর জন্য থাকা একমাত্র job/client, নতুন কিছু বানাতে হয়নি; `FacebookPixelSetting` আগে থেকেই shop-wide (`landing_page_id` স্কোপড না), তাই কনফিগ-লেয়ারেও কোনো কাজ লাগেনি।

**`is_historical_sync` ফ্ল্যাগ (Phase ১১)**: `handle_new_order( $order_id, $is_historical_sync = false )` — bulk-sync থেকে কল হলে `true`, লাইভ `woocommerce_new_order` হুক থেকে হলে `false` (ডিফল্ট)। `true` হলে BSOL-সাইড OTP SMS আর Facebook CAPI Purchase event দুটোই স্কিপ করে (নিচে দেখুন) — পুরনো অর্ডার backfill করার সময় এই সাইড-ইফেক্টগুলো ভুল। WP-Cron রিট্রাই-তেও ফ্ল্যাগটা propagate হয় (`add_action('bsol_retry_order_sync', ..., 10, 2)`), নাহলে রিট্রাই হওয়া historical sync ভুলভাবে OTP/CAPI ফায়ার করে ফেলত।

### Product sync (`class-bsol-product-sync.php`)
**Outbound**: `save_post_product`/`quick_edit_save`/`reduce_order_stock` হুক (zayroo-connect-এর প্রমাণিত trigger সেট), + trashed/deleted হলে inactive sync। Simple + variable — variable প্রোডাক্টের প্রতিটা variation আলাদা payload এন্ট্রি। WC-এর regular/sale price BSOL-এর amount-discount মডেলে ট্রান্সলেট হয়। SKU না থাকলে `WC-{id}` fallback (BSOL-এ SKU required)। ব্যর্থ sync WP-Cron দিয়ে ৩ বার রিট্রাই হয় (২ মিনিট পরপর), তারপর Activity Log-এ permanent-failure এন্ট্রি।

**Inbound (Phase ৭, stock push-back)**: অন্য চ্যানেলে (Facebook/manual) বিক্রি হয়ে গেলে BSOL এই সাইটের `/wp-json/bsol-connect/v1/stock-update` কল করে স্টক আপডেট করে দেয় — WooCommerce কখনো oversell করে না। `X-BSOL-Webhook-Secret` হেডার দিয়ে অথেন্টিকেট (API key-এর মতো না — API key BSOL-সাইডে শুধু hash আকারে থাকে, তাই BSOL-এর কাছে ফেরত পাঠানোর মতো কিছু নেই; connect handshake-এ আলাদা একটা `webhook_secret` ইস্যু হয়, দুই পাশেই plaintext/encrypted আকারে থাকে)। নিজের `save_post_product`/`quick_edit_save` হুক সাময়িকভাবে `remove_action()` করে রাখে যাতে এই write আবার BSOL-এ ফেরত সিঙ্ক না হয় (zayroo-connect-এর `handle_api_sync()`-এর প্রমাণিত প্যাটার্ন)।

### Courier booking (`class-bsol-courier.php`)
Order-list-এ "Courier" কলাম (legacy + HPOS হুক জোড়া)। বুক না হলে ৫টা বাটন — Steadfast, Paperfly, Pathao, RedX, CarryBee; বুক হলে consignment info + refresh/cancel/print লিংক। Meta HPOS-native (`WC_Order::get_meta()`/`update_meta_data()`, zayroo-connect-এর `update_post_meta()`-এর চেয়ে ভালো — legacy কোডটা HPOS হুক রেজিস্টার করেও আসলে HPOS-safe ছিল না)।

**Pathao/RedX/CarryBee-এর জন্য location resolution (Phase ৮)**: এই ৩টা কুরিয়ারের নিজস্ব city/zone/area **ID** লাগে, যা WooCommerce অর্ডারে কখনো থাকে না (শুধু এক টুকরো ফ্রি-টেক্সট `customer_address`)। প্লাগিন সাইডে কোনো নতুন লজিক নেই — পুরো resolution BSOL-সাইডে, `CourierLocationResolverService`-এ:
- **Pathao**: `PathaoLocationService`-এর cached city→zone→area হায়ারার্কি-র বিপরীতে address ম্যাচ করে (substring hit → high confidence, না মিললে `similar_text()` fallback, `MIN_CONFIDENCE=60`)। City+zone দুটোই কনফিডেন্টলি না মিললে booking-ই হয় না।
- **RedX**: address থেকে district-name candidate বের করে `RedxService::getAreas()` (live API) কল করে area লিস্ট আনে, তারপর ম্যাচ।
- **CarryBee**: নিজস্ব free-text resolver আছে (`CarrybeeService::searchAreas()`) — BSOL শুধু top result নেয়, লোকাল ম্যাচিং লাগে না।

কনফিডেন্ট ম্যাচ না পেলে `error_code: location_unresolved` + স্পষ্ট মেসেজ (কোন courier-র remote API ক্রিপ্টিক ফেইল করে না) — "কাজ না করলে পরিষ্কার লোকাল এরর দাও" নীতির সরাসরি এক্সটেনশন (§৮ item ৩)।

### Waybill PDF (`class-bsol-courier.php`-এর অংশ)
বুক করা অর্ডারের পাশে প্রিন্টার আইকন — নতুন কোনো PDF লজিক না, BSOL-এর আগে থেকেই থাকা ২২-টেমপ্লেট `WaybillPdfService` (বারকোড/QR/বাংলা HarfBuzz শেপিং) সরাসরি reuse। **এটা AJAX না, প্লেইন লিংক + `admin-post.php` handler** — ব্রাউজার নিজে থেকে প্লাগিনের API key attach করতে পারে না, তাই WordPress সার্ভার-সাইডে PDF fetch করে (যেখানে key জানা আছে) ব্রাউজারে স্ট্রিম করে দেয় (zayroo-connect-এর CSV-export-এর মতোই standard WP প্যাটার্ন)।

### Fraud check (`class-bsol-fraud-check.php`)
Order-list-এ "Customer Health" কলাম, AJAX-লোডেড, ফোন-নম্বর-কী দিয়ে ২৪ ঘণ্টা transient cache (একই ফোনের একাধিক অর্ডার একটাই cache শেয়ার করে, বারবার order list view করলেও BSOL-এ নতুন রিকোয়েস্ট যায় না যতক্ষণ cache fresh থাকে)। এই ফাইলই shared `bsol-admin` script/style enqueue করে + `bsol_ajax` object localize করে (health nonce + courier nonce একসাথে) — courier মডিউল এই একই enqueue-এর উপর নির্ভর করে।

**Phase ১৫ (v1.13.0)-এ redesign**: আগে `fraud/check-phone` (in-house `fraud_score`, ০-১০০) দেখাতো — এই স্কোর যেকোনো ফোনের জন্য ০ থাকে যদি সেই ফোনের কোনো আগের BSOL অর্ডার হিস্ট্রি না থাকে (WooCommerce-only সেলারদের বেশিরভাগ কাস্টমারের জন্যই সত্যি)। এখন নতুন `POST /connect/v1/fraud/courier-health` এন্ডপয়েন্ট (`ConnectFraudController@courierHealth`) ব্যবহার করে, যেটা সরাসরি `CourierFraudCheckService::check()`-কে delegate করে — dashboard-এর নিজের "Courier Delivery History" প্যানেলের (`frontend/src/components/courier/courier-delivery-report.tsx`) একই ডেটা। কলামে এখন একটা delivered-vs-not প্রোগ্রেস বার দেখায় (green = success_rate%, বাকিটা লাল), ক্লিক করলে প্রতিটা কুরিয়ারের breakdown popover-এ দেখা যায়। কোনো ডেটা না থাকলে (নতুন কাস্টমার) লাল না দেখিয়ে neutral "No data" — ভুল আতঙ্ক এড়াতে।

### Bulk/historical sync (`class-bsol-bulk-sync.php`, Phase ১১)
"Sync Data" ট্যাব — connect করার **আগে** থেকে থাকা প্রোডাক্ট/অর্ডার ব্যাকফিল করার জন্য (নতুনগুলো এমনিতেই auto-sync হয়)। **কোনো নতুন sync লজিক নেই** — `Bsol_Master` inject করা `Bsol_Product_Sync`/`Bsol_Order_Sync` ইনস্ট্যান্সের `sync_product()`/`handle_new_order()` মেথডই আবার কল করা হয় ব্যাচে (১০টা করে, `wc_get_products()`/`wc_get_orders()`-এর `paginate=>true` মোড দিয়ে সস্তায় total count পাওয়া যায়)। **নিজে কখনো `new Bsol_Product_Sync()`/`new Bsol_Order_Sync()` করে না** — করলে তাদের constructor-এর হুক রেজিস্ট্রেশন duplicate হয়ে যেত (`save_post_product` দুইবার ফায়ার হতো প্রতি সেভে)। অর্ডার ব্যাকফিলের সময় `is_historical_sync=true` পাস করা হয় (উপরে দেখুন) + `handle_status_change()` দিয়ে অর্ডারের আসল বর্তমান status আলাদাভাবে push করা হয় (নাহলে সব অর্ডার BSOL-এ "pending"-এ আটকে থাকত)। ক্লায়েন্ট-সাইড ব্যাচ লুপে প্রতি ব্যাচের মাঝে ১ সেকেন্ড gap — `/connect/v1` গ্রুপের `throttle:120,1`-এর নিচে থাকার জন্য।

### Order invoice PDF (`class-bsol-invoice.php`, Phase ১২)
Order-list-এ "Invoice" কলাম, waybill-এর মতো `admin-post.php` proxy — কিন্তু **কোনো courier-booking precondition নেই**, যেকোনো synced অর্ডারেই কাজ করে। BSOL-সাইড: `OrderController::invoicePdf()` আগে থেকেই ছিল (dashboard-facing), `ConnectOrderController::invoicePdf()` এটাকে সরাসরি কল করে — waybill-এর `Request` দরকার হতো (`?size=`), এখানে সেটাও লাগে না (`ConnectCourierController::track()`-এর মতোই direct call, synthetic `Request::create()` ছাড়া)।

### Plugin download (`WordpressApiKeyController::downloadPlugin()`, backend)
`/dashboard/settings/wordpress` পেজের "Download Plugin" বাটন এই এন্ডপয়েন্টে যায়। **প্রতি রিকোয়েস্টে `wordpress-plugin/bsol-connect/` সোর্স থেকে zip ডায়নামিকভাবে তৈরি হয়** (ভার্সন নাম্বার প্লাগিন হেডার থেকে regex দিয়ে পড়া) — একটা আলাদা pre-built zip মেইনটেইন করার দরকার নেই, কখনো stale হবে না। পাবলিক (কোনো secret নেই zip-এ), শুধু `throttle:20,1`।

### Self-update notice (`class-bsol-update-checker.php`, Phase ১৩)
প্লাগিন WordPress.org-এ নেই, তাই নতুন ভার্সন এলে wp-admin-এ notice দেখানো ছাড়া জানার উপায় নেই। `is_connected()` গেটের বাইরে সবসময় সক্রিয় (disconnected সাইটও আপডেট দরকার হতে পারে)। BSOL-সাইড: `WordpressApiKeyController::pluginVersion()` — `downloadPlugin()`-এর সাথে শেয়ার করা `resolvePluginVersion()` হেল্পার ব্যবহার করে, `{version, download_url}` রিটার্ন করে (প্লাগিনকে ২টা আলাদা URL হার্ডকোড করতে হয় না)। WP-সাইড: transient-cached (হিট হলে ১২ ঘণ্টা, miss/unreachable হলে ১ ঘণ্টা — যাতে BSOL সাময়িক ডাউন থাকলেও প্রতি admin পেজ লোডে রিমোট কল না হয়)।

### Checkout OTP (`class-bsol-checkout-otp.php`, Phase ৯)
এই প্লাগিনের **প্রথম storefront-facing মডিউল** — বাকি সব শুধু wp-admin-এ কাজ করে। `platform_api_keys.otp_verification_enabled` টগল দিয়ে per-connection অন/অফ (ডিফল্ট off), BSOL dashboard → Settings → WordPress Connect থেকে টগল করা যায়।

- **BSOL-সাইড ইঞ্জিন পুরোপুরি reuse** — landing-page checkout OTP-এর জন্য যে `CheckoutOtpService`/`phone_otp_verifications` মেকানিজম আগে থেকেই ছিল, সেটাই এখন WooCommerce-এর জন্যও কাজ করে। শুধু `LandingPage $page` প্যারামিটার সরিয়ে প্লেইন `array $settings` করা হয়েছে (attempts/expiry/resend-cooldown লজিক অপরিবর্তিত)। নতুন `ConnectCheckoutOtpController` একই `CheckoutOtpService::verify()`/`resend()` কল করে, শুধু order resolution আলাদা (token-based না, `wc_order_id` + API key)।
- **Flow**: `ConnectOrderController::sync()`-এ অর্ডার create হলে (update-এ না), toggle অন থাকলে SMS পাঠানো হয় + response-এ `otp_required: true` আসে → প্লাগিন `_bsol_otp_required` order meta সেভ করে → `woocommerce_before_thankyou` হুকে order-received পেজে একটা কোড-ইনপুট কার্ড দেখায় (মেটা true + `_bsol_otp_verified` false হলেই)।
- **ব্রাউজার থেকে সরাসরি BSOL-এ যাওয়া যায় না** (শপার-এর কাছে API key নেই) — verify/resend `wp_ajax_nopriv_*` হ্যান্ডলার দিয়ে সার্ভার-সাইড relay হয় (চেকআউট সাধারণত anonymous), অন্য সব মডিউলের wp-admin AJAX relay-র একই প্যাটার্ন, শুধু storefront থেকে ট্রিগার হওয়া।
- **`public_token` bug fix**: `phone_otp_verifications.token` NOT NULL+unique, কিন্তু WooCommerce-সোর্সড অর্ডারে কখনো `public_token` সেট হতো না (শুধু landing-page order creation flow সেটা সেট করত) — `CheckoutOtpService::maybeSendForOrder()` এখন প্রয়োজনে on-demand একটা জেনারেট করে দেয়।

### Abandoned checkout tracking (`class-bsol-abandoned-checkout.php`, Phase ১৭)

**দ্বিতীয় storefront-facing মডিউল** — checkout-otp-এর পরে। WooCommerce checkout-এ কাস্টমার নাম/ফোন/ইমেইল/ঠিকানা টাইপ করার সময়ই (submit করার আগে) ক্যাপচার করে BSOL-এ পাঠায় — কোনো নতুন storage সিস্টেম না, ল্যান্ডিং পেজের `abandoned_checkouts` টেবিল/ড্যাশবোর্ড UI-ই reuse হয় (§৮ item ১, delegate-না-duplicate)।

- **`abandoned_checkouts` widen করা হয়েছে, নতুন টেবিল না**: `landing_page_id` nullable করা হয়েছে, নতুন `source` (`landing_page`|`woocommerce`) আর `platform_api_key_id` (Phase ১৬-এর প্যাটার্ন) কলাম যোগ। বিদ্যমান ল্যান্ডিং-পেজ মেথড (`capture`/`resume`/`convertMatching`/`applyEdit`/`snapshotItems`) **অপরিবর্তিত** — WooCommerce-এর জন্য `AbandonedCheckoutService::captureWooCommerce()`/`convertMatchingWooCommerce()` নতুন, additive মেথড, কারণ `snapshotItems()` ল্যান্ডিং-পেজ ক্যাটালগ পিভট (`$page->products`, pinned variant/price override) রিজলভ করে — WooCommerce-এর জন্য প্রযোজ্য না (একটা WC cart line ইতিমধ্যেই WooCommerce নিজে রিজলভ করে রাখে)।
- **DOM scraping না, `WC()->cart` সরাসরি**: legacy `zayroo-iot-checkout.js` প্রোডাক্ট নাম/লিংক checkout টেবিলের রেন্ডার করা DOM থেকে CSS সিলেক্টর দিয়ে scrape করত (theme-নির্ভর, ভঙ্গুর)। এখানে JS শুধু ফর্ম-ফিল্ড ভ্যালু পাঠায়; PHP AJAX হ্যান্ডলার সরাসরি `WC()->cart->get_cart()` থেকে item রিজলভ করে — এই প্লাগিনের বাকি সবকিছুর মতোই "WooCommerce নিজেই সোর্স অফ ট্রুথ" নীতি।
- **ট্রিগার প্যাটার্ন legacy থেকে reuse**: `sessionStorage`-বেসড সেশন কী, ১.৫ সেকেন্ড debounce, যেকোনো checkout ফিল্ড input/change/blur + WooCommerce-এর নিজস্ব `updated_checkout` ইভেন্ট + কার্ট qty/remove ক্লিকে ট্রিগার হয় — `zayroo-iot-checkout.js`-এ প্রমাণিত শেপ, শুধু DOM-scraping অংশটা বাদ।
- **Conversion matching, hidden form field ছাড়া**: session key browser `sessionStorage`-এ থাকে, `woocommerce_new_order` ফায়ার হওয়ার সময় সার্ভার-সাইডে দেখা যায় না। AJAX capture হ্যান্ডলার সেশন টোকেনটা `WC()->session->set()` দিয়েও সেভ করে রাখে (checkout-type-agnostic — classic আর block-based Store API checkout দুটোতেই কাজ করে, hidden ফর্ম ফিল্ড দিয়ে classic-only প্লাম্বিং করলে যা হতো না) — `build_order_payload()` পরে `WC()->session->get()` দিয়ে ফেরত পড়ে, `orders/sync`-এর `session_token` ফিল্ডে পাঠায়। BSOL-সাইড: `ConnectOrderController::sync()`-এর create ব্র্যাঞ্চে (historical sync বাদে) `convertMatchingWooCommerce()` কল হয় — session-token ম্যাচ আগে, ফোন-নম্বর fallback (cross-device completion বা পুরনো প্লাগিন ভার্সনের জন্য যেটা session_token পাঠায় না)।
- **কোনো wp-admin UI যোগ হয়নি** — legacy zayroo নিজের admin list/CSV-export বানিয়েছিল (তখন "cloud"-এ কিছু ছিল না), BSOL-এর ড্যাশবোর্ডে আগে থেকেই পূর্ণাঙ্গ Abandoned Checkouts list/detail/stats/export UI আছে — সেলার সেখান থেকেই WooCommerce-সোর্সড এন্ট্রি ম্যানেজ করে, ল্যান্ডিং-পেজ এন্ট্রির মতোই।

### Repeat order block (`class-bsol-repeat-order-block.php`, Phase ১৮)

একই ফোন নম্বর দিয়ে configurable ঘণ্টার মধ্যে দ্বিতীয় অর্ডার আটকায় — অপশনাল, ডিফল্ট বন্ধ। **সম্পূর্ণ WP-লোকাল** — `wc_get_orders(['billing_phone' => $phone, ...])` দিয়ে এই সাইটের নিজের অর্ডার হিস্ট্রি চেক করে, BSOL API কল লাগে না; সেটিংস (enable, block window, error message) তাই wp-admin option হিসেবে রাখা হয়েছে, BSOL ড্যাশবোর্ডে না।

- **Classic + Block checkout দুটোই কভার্ড**: `woocommerce_checkout_process` (classic, `wc_add_notice()`) আর `woocommerce_store_api_checkout_update_order_from_request` (Block/Store API checkout — draft order-এ billing data সেট হয়ে যাওয়ার পর, payment-এর আগে ফায়ার করে; `\Automattic\WooCommerce\StoreApi\Exceptions\RouteException` থ্রো করলে WooCommerce কোর নিজেই সেটাকে normal checkout error-এ কনভার্ট করে) — দুটোই একই প্রাইভেট `evaluate()` মেথড শেয়ার করে।
- **বাকি সময় দেখায়, পুরো window না**: `ceil($hours - $hours_since_last_order)` — legacy zayroo সবসময় পুরো configured window দেখাত, elapsed time যাই হোক না কেন।
- **ফোন নরমালাইজ করে ম্যাচ করা হয়** (`Bsol_Helpers::clean_bd_phone_number()`), raw `$_POST`/`$order->get_billing_phone()` না — `+880`/স্পেস/ড্যাশ ভ্যারিয়েশনেও আগের প্লেইন `01XXXXXXXXX` অর্ডারের সাথে ম্যাচ করে (legacy zayroo raw ভ্যালু দিয়ে সরাসরি কোয়েরি করত)।

---

## ৬. টেস্টিং কনভেনশন (এই কানেক্টরের জন্য প্রতিষ্ঠিত)

- Feature test ফাইল: `backend/tests/Feature/{ConnectApiTest,PlatformApiKeyApiTest,ConnectProductSyncTest,ConnectCourierTest,WooCommerceStockPushTest,CourierLocationResolverTest,ConnectCheckoutOtpTest}.php`।
- সব টেস্ট **isolated Postgres schema**-তে যাচাই করা হয়েছে, `hybrid_platform` প্রোডাকশন DB কখনো টাচ হয়নি:
  ```bash
  PGPASSWORD='...' psql -U hybrid_app -h 127.0.0.1 -d hybrid_platform -c "CREATE SCHEMA IF NOT EXISTS test_xxx;"
  # config/database.php-এর pgsql.search_path সাময়িকভাবে env('DB_SCHEMA','public') করে
  DB_CONNECTION=pgsql DB_DATABASE=hybrid_platform DB_SCHEMA=test_xxx php artisan test ...
  # তারপর schema DROP + config/database.php রিভার্ট
  ```
  **`phpunit.xml`-এ `DB_CONNECTION=sqlite`/`DB_DATABASE=:memory:` হার্ডকোড করা আছে** — শুধু `DB_SCHEMA` শেল-এ export করলে যথেষ্ট না, `DB_CONNECTION=pgsql` আর `DB_DATABASE=hybrid_platform`-ও একসাথে override করতে হয় (Phase ৭-এ প্রথমবার এই পুরো তিনটা লাগল, courier_settings-এর মতো migration-এ raw `ALTER COLUMN ... TYPE` থাকায় sqlite-এ সবসময় fail করে)।
- প্রতিটা নতুন migration-এর পর **`php artisan migrate --force` প্রোডাকশনে আলাদাভাবে রান করতে হয়** — Phase ১-এ একবার ভুলে যাওয়ায় লাইভ সাইটে 500 হয়েছিল (দেখুন memory: `deploy-checklist-bsol`)।
- Plugin ফাইল: `php -l` সব ফাইলে + hook-name/nonce-action/AJAX-action name cross-check (`grep` দিয়ে PHP আর JS-এর মধ্যে মিল যাচাই) — কোনো WordPress ইনস্টল এই ডেভ এনভায়রনমেন্টে নেই, তাই real end-to-end QA-এর জন্য `SETUP.md`-এর চেকলিস্ট ব্যবহার করতে হয় আসল WooCommerce স্টাজিং সাইটে।

---

## ৭. যা এখনো বাকি

মূল ফিচার-গ্যাপ লিস্ট (bsol_history_and_new_context.md-এ প্রথম চিহ্নিত করা) Phase ১২-তে শেষ — connect/disconnect, order/product sync, fraud check, courier booking (Steadfast/Paperfly/Pathao/RedX/CarryBee সবগুলো), waybill, stock push-back, checkout OTP, Facebook CAPI, bulk sync, invoice — সবই লাইভ।

"Group C" (polish/distribution)-এর ৪টার মধ্যে ৩টা Phase ১৩-তে শেষ: self-update notice, translation-ready `.pot`, `readme.txt`। **বাকি ১টা — আসল WooCommerce স্টেজিং সাইটে পূর্ণ end-to-end QA পাস — এই ডেভ এনভায়রনমেন্টে করা সম্ভব না** (এখানে কোনো WordPress/WooCommerce ইনস্টল নেই, Phase ১ থেকে প্রতিটা `SETUP.md` নোটে এটা বারবার স্পষ্ট করা হয়েছে) — এটা ব্যবহারকারীকে নিজে একটা real staging সাইটে `SETUP.md`-এর পুরো চেকলিস্ট ধরে করতে হবে।

---

## ৭.১ Zayroo Connect-এ ছিল, BSOL Connect-এ এখনো নেই

`zyro/wordpress_plugin/zayroo-connect` (legacy precursor) এর প্রতিটা মডিউল ঘেঁটে (2026-08-13) বর্তমান `bsol-connect`-এর সাথে তুলনা করে পাওয়া গ্যাপ — কোনোটাই এখনো implement হয়নি, শুধু চিহ্নিত করা আছে এখানে যাতে ভবিষ্যতে ভুলে না যাওয়া হয় বা দুবার আবিষ্কার করতে না হয়:

1. **Facebook পূর্ণাঙ্গ ফানেল ট্র্যাকিং** — zayroo-তে client-side Pixel বেস কোড ইনজেকশন (`wp_head`), PageView/ViewContent, AddToCart, আর কাস্টম-স্ট্যাটাস-ভিত্তিক ইভেন্ট (Confirmed/Shipping/Returned/Delivered — প্রতিটা আলাদা ইভেন্ট নামে) ছিল, Pixel + server-side CAPI একসাথে (`event_id` দিয়ে dedup)। BSOL-এর Phase ১০ শুধু **server-side Purchase** পাঠায় (`SendFacebookCapiPurchaseEventJob`) — client pixel install করে না, funnel-এর বাকি ধাপ ট্র্যাক করে না। *সতর্কতা: zayroo-র কোডে পিক্সেল আইডি hardcoded ছিল একটা নির্দিষ্ট সাইটের জন্য (zisan.me, Website ID 12) — as-is কপি করার মতো না; ধারণাটা জেনেরিকভাবে re-implement করতে হবে (সেলারের নিজস্ব `FacebookPixelSetting` থেকে)।*
2. ~~**Incomplete/Abandoned Order Tracking (WooCommerce)**~~ — **সমাধান হয়েছে, Phase ১৭ (v1.14.0)।** নিচে §৯ দেখুন।
3. **চেকআউট-টাইম ব্লকিং (fraud/blacklist)** — zayroo ফোন+IP দিয়ে চেকআউটের আগে SaaS-কে জিজ্ঞেস করত ("allowed" কিনা), `false` হলে সরাসরি order block করত (`woocommerce_checkout_process` হুকে `wc_add_notice()`)। BSOL-এর Customer Health কলাম শুধু তথ্যভিত্তিক (admin দেখে সিদ্ধান্ত নেয়) — কোনো ব্ল্যাকলিস্টেড/high-risk নম্বর দিয়ে আজও চেকআউট সম্পূর্ণ করা যায়, আটকায় না।
4. ~~**Repeat-order block**~~ — **সমাধান হয়েছে, Phase ১৮ (v1.15.0)।** উপরে §১০ দেখুন।
5. **BSOL vocabulary-এর কাস্টম WooCommerce order status** — zayroo WooCommerce-এর নিজস্ব status taxonomy-তে সরাসরি ৫টা কালার-কোডেড status রেজিস্টার করত (+ bulk action দিয়ে একসাথে বদলানো)। BSOL শুধু ম্যাপ করে ভেতরে ভেতরে (`Bsol_Helpers::status_map()`), WooCommerce-এর native status/UI স্পর্শ করে না — এটা আংশিক ইচ্ছাকৃত ডিজাইন-চয়েসও (native status বদলালে অন্য প্লাগিন/রিপোর্ট ভাঙতে পারে), কিন্তু সেলারের জন্য "এক জায়গায় ইউনিফাইড ভোকাবুলারি" সুবিধাটা নেই।
6. **wp-admin থেকে সরাসরি Manual "Send SMS"** — ছোট সুবিধা, BSOL dashboard-এই আছে (`/sms/send`) কিন্তু প্লাগিন থেকে শর্টকাট নেই।

**যাচাই করে "মিসিং না" বলে বাতিল করা হয়েছে** (যাতে ভুল করে আবার "গ্যাপ" মনে না হয়): SMS automation on status change — zayroo-র `trigger_sms.php` webhook-এর সমতুল্য কাজ BSOL-এ ভিন্নভাবে কভার্ড, `OrderStatusService::transition()` (যেটা `ConnectOrderController::syncStatus()`-ও ব্যবহার করে) প্রতিটা status transition-এ `SmsAutomationService` ট্রিগার করে, source নির্বিশেষে — WooCommerce অর্ডারের জন্য আলাদা কোনো ওয়্যারিং লাগে না।

---

## ৯. Phase ১৭ — Incomplete/Abandoned Order Tracking (WooCommerce)

§৭.১ item ২-এর বাস্তবায়ন — সম্পূর্ণ, বিস্তারিত ডিজাইন §৫-এর "Abandoned checkout tracking" সাব-সেকশনে। সংক্ষেপে: WooCommerce checkout-এ শুরু হওয়া কিন্তু সম্পূর্ণ না-হওয়া চেকআউট এখন BSOL-এর বিদ্যমান `abandoned_checkouts`/ড্যাশবোর্ড UI-তে sync হয় (নতুন টেবিল/UI না — widen করা হয়েছে), প্রতিটা এন্ট্রি **সাইট-ভিত্তিক ফ্ল্যাগড** (`platform_api_key_id`, Phase ১৬-এর সাথে সামঞ্জস্যপূর্ণ), আসল অর্ডার কমপ্লিট হলে স্বয়ংক্রিয়ভাবে "Converted"-এ ফ্লিপ হয়ে যায়।

**Bugfix (একই phase-এ, লাইভ রিপোর্টের পর)**: ড্যাশবোর্ডে Source কলাম ফাঁকা ("—") দেখাচ্ছিল সাইট-ফ্ল্যাগ সিঙ্ক হওয়া সত্ত্বেও — রুট কজ ও ফিক্স §৮ decision #১৪-এ।

---

## ১০. Phase ১৮ — Repeat Order Block (WooCommerce)

§৭.১ item ৪-এর বাস্তবায়ন, বিস্তারিত ডিজাইন §৫-এর "Repeat order block" সাব-সেকশনে। legacy `zayroo-connect`-এর `Zayroo_Blacklist_Manager::check_for_repeat_order_at_checkout()` থেকে adapt করা, দুটো real ইম্প্রুভমেন্ট সহ:

1. **Classic + Block checkout দুটোই কভার্ড, শুধু classic না** — zayroo শুধু `woocommerce_checkout_process` হুক করত, যেটা WooCommerce-এর Block-based (Store API) checkout-এ কখনো ফায়ার হয় না (WC 8.3+ থেকে নতুন সাইটে এটাই ডিফল্ট checkout — legacy ফিচারটা ওই সাইটগুলোতে চুপচাপ কিছুই করত না)। BSOL Connect `woocommerce_store_api_checkout_update_order_from_request` হুকও রেজিস্টার করে (WooCommerce কোর সোর্স পড়ে কনফার্ম করা হয়েছে — একটা already-persisted draft order-এ, billing data অলরেডি সেট থাকা অবস্থায়, payment attempt-এর আগে ফায়ার করে) — সেখান থেকে `\Automattic\WooCommerce\StoreApi\Exceptions\RouteException` থ্রো করলে WooCommerce কোর নিজেই সেটা ধরে (`Checkout.php::get_response()`-এর try/catch) স্বাভাবিক checkout error হিসেবে দেখায়। ক্লাস না পাওয়া গেলে (পুরনো namespace) fail-open — classic checkout enforcement তখনও কাজ করে।
2. **আসল বাকি সময় দেখায়, পুরো window না** — zayroo সবসময় পুরো configured window দেখাত ("try again after 24 hours"), এমনকি ২৩ ঘণ্টা পার হয়ে গেলেও। BSOL Connect বাকি সময় হিসাব করে দেখায় (`hours - hours_since_last_order`)।

**সম্পূর্ণ WP-লোকাল, BSOL API নেই** — অর্ডার হিস্ট্রি ইতিমধ্যেই এই সাইটের নিজের `wc_get_orders()`-এ আছে, রিমোট কলের দরকার নেই। এটাই ঠিক কেন সেটিংস (enable, block window ঘণ্টা, error message) wp-admin-এ প্লেইন অপশন হিসেবে রাখা হয়েছে, BSOL ড্যাশবোর্ডে না (unlike checkout-OTP toggle, যেটার actual check-ই BSOL কল করে বলে সেখানে রাখা ফ্রি) — BSOL থেকে toggle পড়তে হলে প্রতিটা checkout-এ একটা অতিরিক্ত network round-trip লাগত, যেটা এই ফিচারের পুরো পয়েন্টকেই নষ্ট করে দিত। নতুন মডিউল `Bsol_Repeat_Order_Block` (`includes/modules/repeat-order-block/`), সেটিংস UI `class-bsol-admin.php`-এর Settings ট্যাবে — কোনো ব্যাকএন্ড/মাইগ্রেশন পরিবর্তন নেই।

---

## ৮. মূল ডিজাইন সিদ্ধান্ত (ভবিষ্যতে অনুসরণ করার জন্য)

1. **Delegate, duplicate না** — প্রতিটা Connect controller বিদ্যমান dashboard controller-কে synthetic `Request::create()` দিয়ে কল করে। এতে প্ল্যান-লিমিট, stock check, accounting side-effect ফ্রি-তে আসে, আর দুই জায়গায় লজিক maintain করতে হয় না।
2. **WC→BSOL সিমান্টিক ট্রান্সলেশন প্লাগিনের দায়িত্ব**, ব্যাকএন্ডের না — status vocabulary, price/discount মডেল অনুবাদ সব প্লাগিন সাইডে হয়, যাতে backend API ভবিষ্যতে অন্য প্ল্যাটফর্মের (Shopify ইত্যাদি) জন্যও reuse করা যায়।
3. **যা কাজ করে না তার জন্য পরিষ্কার লোকাল এরর দাও, রিমোট API-কে ক্রিপ্টিক ফেইল করতে দিও না** — Pathao/RedX/Carrybee এর `location_unresolved` এরর এর সবচেয়ে ভালো উদাহরণ: address থেকে confident location না পেলে booking-ই attempt করা হয় না, remote API-কে crash করতে দেওয়া হয় না (§৫ "Courier booking" দেখুন)।
4. **Global-uniqueness collision handle করো, crash না করে** — `product_variants.sku` পুরো ইনস্টলজুড়ে ইউনিক, তাই দুই সেলারের SKU কলিশন হতে পারে; per-variant warning দিয়ে বাকি সিঙ্ক চালিয়ে যাওয়া হয় (`ConnectProductController::sync()`)।
5. **HPOS-native মেটা** — `WC_Order::get_meta()`/`update_meta_data()`, কখনো `update_post_meta()` না, এমনকি legacy hook variant রেজিস্টার করলেও।
6. **ফাইল-ডাউনলোড এন্ডপয়েন্ট ≠ JSON এন্ডপয়েন্ট** — ব্রাউজার থেকে trigger হওয়া যেকোনো কিছু (waybill PDF) এর API key ব্রাউজারে পাঠানো যাবে না; সার্ভার-সাইড proxy (`admin-post.php`) লাগবেই।
7. **Dynamic generation যেখানেই সম্ভব, pre-built artifact না** — প্লাগিন zip প্রতি রিকোয়েস্টে সোর্স থেকে বানানো হয়, কখনো stale হয় না।
8. **উল্টো দিকের (BSOL→WordPress) কলের জন্য একটা আলাদা secret লাগবে, API key reuse করা যাবে না** — API key BSOL-সাইডে এক-মুখী hash আকারে থাকে (সিকিউরিটি সিদ্ধান্ত, Phase ১), তাই ফেরত পাঠানোর মতো raw কিছু নেই। `webhook_secret` (connect handshake-এ ইস্যু, দুই পাশেই reversible) এই প্যাটার্নের জন্য টেমপ্লেট — ভবিষ্যতে BSOL→WordPress অন্য কোনো ফিচার লাগলেও একই secret reuse করা যায়, নতুন করে বানানোর দরকার নেই।
9. **Multi-write-site সিঙ্ক হুকের জন্য model event, প্রতিটা controller আলাদা করে প্যাচ না** — stock ৪+ জায়গা থেকে (ড্যাশবোর্ড এডিট, adjust-stock এন্ডপয়েন্ট, `OrderStatusService`-এর reserve/restore) বদলাতে পারে; প্রতিটা কল-সাইট আলাদা প্যাচ না করে `Product`/`ProductVariant`-এর `booted()`-এ একটা কেন্দ্রীয় `saved` hook বসানো হয়েছে (`ProductVariant`-এ আগে থেকেই থাকা `saving` hook-এর একই idiom অনুসরণ করে) — নতুন কোনো write-site যোগ হলেও স্বয়ংক্রিয়ভাবে কভার হয়ে যাবে।
10. **ফিজিক্যাল/অপরিবর্তনীয় action-এ "ম্যাচ না পাওয়া" সবসময় "ভুল ম্যাচ"-এর চেয়ে নিরাপদ** — `CourierLocationResolverService`-এর `MIN_CONFIDENCE` threshold-এর নিচে কিছু পেলে চুপচাপ একটা আন্দাজি city/zone বেছে নেয় না, বরং resolve-ই করে না (parcel ভুল জায়গায় চলে যাওয়ার চেয়ে booking fail হওয়া ভালো) — এটা decision #3-এরই একটা কঠোরতর সংস্করণ, যেখানে ভুল হওয়ার real-world cost শুধু একটা confusing এরর মেসেজের চেয়ে বেশি।
11. **অন্য চ্যানেলের জন্য জেনারেলাইজ করার সময় rebuild না, narrow decoupling** — checkout OTP আগে থেকেই `order_id`-স্কোপড ছিল, শুধু enable-toggle টা `LandingPage $page` অবজেক্টে বাঁধা ছিল; সেই একটা প্যারামিটার `array $settings`-এ বদলে দেওয়াই যথেষ্ট হয়েছে, পুরো verify/resend state machine অক্ষত রেখে (Phase ৯)। নতুন কোনো channel জেনারেলাইজ করার আগে — Facebook CAPI-ও একই রকম ল্যান্ডিং-পেজ-বাঁধা (§৭ দেখুন) — আগে জিজ্ঞেস করা উচিত "এটা কি সত্যিই landing-page-নির্দিষ্ট, নাকি শুধু একটা প্যারামিটার landing-page দিয়ে resolve হচ্ছে?"।
12. **Storefront-facing রিলে wp-admin রিলে-রই এক্সটেনশন, নতুন প্যাটার্ন না** — শপারের ব্রাউজারে API key নেই বলে checkout OTP verify/resend WP AJAX দিয়ে সার্ভার-সাইড relay হয় (`wp_ajax_nopriv_*`) — ঠিক সেই একই browser→WP-AJAX→BSOL শেপ যেটা courier book/track/cancel-এর জন্য wp-admin-এ আগে থেকেই ব্যবহৃত হচ্ছিল, শুধু ট্রিগার পয়েন্ট storefront-এ (Phase ৯, `class-bsol-checkout-otp.php` — এই প্লাগিনের প্রথম non-admin মডিউল)।
13. **নতুন channel জেনারেলাইজ করার আগে চেক করো configuration layer আসলেই re-scope লাগবে কিনা** — decision #11-এর (OTP) বিপরীত উদাহরণ: Facebook CAPI-র জন্য `FacebookPixelSetting` already shop-wide ছিল (`unique('user_id')`, কোনো `landing_page_id` না) — তাই Phase ১০-এ কোনো নতুন migration/toggle/UI লাগেইনি, শুধু একটা নতুন dispatch call site আর প্লাগিন থেকে WooCommerce-এর নিজস্ব capture করা IP/UA ফরওয়ার্ড করা লাগল। একই "জেনারেলাইজ করো" কাজ ভিন্ন ফিচারে সম্পূর্ণ ভিন্ন পরিমাণ কাজ হতে পারে — অনুমান না করে প্রতিটার actual scoping যাচাই করা জরুরি।
14. **Eloquent eager-loaded relation key JSON-এ snake_case হয়ে যায়, ফ্রন্টএন্ড টাইপ camelCase লিখলে চুপচাপ `undefined`** — `Model::$snakeAttributes` (ডিফল্ট `true`) DB কলামের মতোই relation method নামও সিরিয়ালাইজেশনে snake_case করে দেয় (`landingPage()` → `"landing_page"`, `platformApiKey()` → `"platform_api_key"`)। Phase ১৭-এ ধরা পড়েছিল: dashboard-এর Abandoned Checkouts পেজ (list + detail) camelCase key পড়ছিল, তাই Source কলাম সবসময় "—" দেখাচ্ছিল — নতুন WooCommerce রো-তে চোখে পড়ল (সাইট-ফ্ল্যাগ না দেখানো স্পষ্ট ভুল লাগে), কিন্তু আসলে **প্রি-এক্সিস্টিং landing-page রো-গুলোও একই বাগে ভুগছিল**, শুধু ফাঁকা লেবেল স্বাভাবিক লাগে বলে চোখে পড়েনি। ফিক্স: `frontend/src/app/dashboard/abandoned-checkouts/{page.tsx,[id]/page.tsx}` — টাইপ + সব ব্যবহার snake_case-এ। শেখা: backend থেকে নতুন eager-loaded relation ফ্রন্টএন্ডে ব্যবহার করার আগে actual JSON response (curl/tinker `toArray()`) চেক করো, method নাম থেকে অনুমান কোরো না।
