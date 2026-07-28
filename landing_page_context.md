# ল্যান্ডিং পেজ বিল্ডার — মাস্টার কনটেক্সট ফাইল

> এই ফাইলটা AI agent-দের জন্য: landing page builder ফিচার নিয়ে কোনো কাজ করার আগে পুরো কোডবেস স্ক্যান না করে এই ফাইল পড়লেই যথেষ্ট। শেষ আপডেট: 2026-07-28। কোনো বড় পরিবর্তন করলে (নতুন ফাইল/মডেল/রুট/কলাম) এই ফাইলটাও আপডেট করে দিও।
>
> স্ট্যাক: Laravel backend (`/var/www/hybrid-stack/backend`) + Next.js/TypeScript frontend (`/var/www/hybrid-stack/frontend`)। `zyro/` ও `catv/` ডিরেক্টরি আলাদা/অসম্পর্কিত প্রজেক্ট — এই ফিচারের সাথে সম্পর্কিত না।

## ⚠️ স্টেল প্ল্যান ডক সতর্কতা

`/var/www/hybrid-stack/.plan/landing_page_studio.md` একটা পুরনো migration-planning doc। সেখানে "Quick Edit" ও "GrapesJS Visual Editor" নামে দুইটা পুরনো এডিটরের কথা আছে — **কিন্তু এই দুইটাই এখন কোডবেস থেকে সম্পূর্ণ ডিলিট হয়ে গেছে** (commits `3adfb12` ও `d5f5858`, 2026-07-27)। এখন **একটাই এডিটর আছে: block-based `LandingPageBuilder`** (`frontend/src/components/landing-page-builder.tsx`)। প্ল্যান ডকের ফাইল-রেফারেন্স (`landing-page-studio.tsx`, `landing-page-editor.tsx`, `grapesjs-elements/*`, `landing-page-draft-preview.tsx`) আর বাস্তব নয় — সেগুলো ধরে কাজ শুরু কোরো না। প্ল্যান ডকে "theme_settings-এর কোনো UI নেই" লেখা আছে — এটাও স্টেল, Design প্যানেল এখন সম্পূর্ণ implement করা আছে (নিচে §6 দেখো)।

`frontend/src/components/landing-page-form.tsx` — orphaned/dead code, কোথাও import হয় না। এটা নিয়ে ভুলবশত কাজ শুরু কোরো না।

---

## ১. Database Schema (backend migrations)

- **`landing_templates`**: `id, created_by(FK users), code(unique), name_bn, name_en, description, preview_image, default_content(json), schema(json), is_active, sort_order`, softDeletes.
- **`landing_pages`**: `id, user_id(FK), template_id(FK, nullable), title, slug(unique), status(draft|published), theme_settings(json), content(json), seo_meta(json), custom_css(text), published_at, editor_state(json), last_editor_save`, softDeletes.
- **`landing_page_products`**: `id, landing_page_id(FK), product_id(FK), title_override, subtitle, badge_text, price_override, default_qty, selected_by_default, sort_order`. Unique `[landing_page_id, product_id]`.
- **`landing_page_visits`**: `id, landing_page_id, ip_address, country, city, latitude, longitude, referrer, user_agent, session_id, user_id(nullable)`.
- **`landing_page_statistics`**: `id, landing_page_id, date, total_visits, unique_visitors, orders_placed`. Unique `[landing_page_id, date]`.
- **`landing_page_visit_orders`**: pivot `landing_page_visit_id ↔ order_id`, unique pair.
- **`landing_media_assets`**: `id, user_id, url, file_path, file_name, mime_type, file_size_bytes, width, height`.
- **`landing_page_editor_drafts`**, **`landing_page_versions`**, **`landing_page_elements`**: GrapesJS-era tables — **GrapesJS UI ডিলিট হয়ে গেছে কিন্তু এই টেবিলগুলো এখনো schema-তে আছে**, বর্তমান builder এগুলো ব্যবহার করে না (dead tables, cleanup candidate but not urgent).
- `landing_pages` তে dedicated `thank_you` কলাম নেই — এটা পুরোপুরি `content` JSON-এর ভেতরে থাকে।

### OTP-সম্পর্কিত টেবিল
- **`phone_otp_verifications`**: `id, token(unique), order_id(nullable FK, added later), mobile, otp_code, purpose(registration|checkout_verification), pending_data(json), attempts, resend_count, last_sent_at, next_resend_at, blocked_until, expires_at, verified_at`.
- **`phone_otp_activity_logs`**: `mobile, event_type, status(sent|failed), provider, message, error_message, metadata(json)`.
- **`email_otp_verifications`**: registration/email-এর জন্য, landing page-স্পেসিফিক না।
- `orders` টেবিলে যোগ হয়েছে: `otp_required(bool)`, `otp_verified_at(timestamp)`।

---

## ২. Backend Models (`app/Models/`)

- **`LandingPage.php`** — fillable: `user_id, template_id, title, slug, status, theme_settings, content, seo_meta, custom_css, published_at, editor_state, last_editor_save`। casts: `theme_settings/content/seo_meta/editor_state`→array। relations: `user()`, `template()`, `products()` (HasMany, sorted by `sort_order`)। SoftDeletes.
- **`LandingPageProduct.php`** — casts `price_override`→decimal:2, `selected_by_default`→bool।
- **`LandingTemplate.php`** — casts `default_content/schema`→array। relation `pages()`।
- **`LandingPageVisit.php`**, **`LandingPageStatistic.php`**, **`LandingMediaAsset.php`**, **`LandingPageEditorDraft.php`** (GrapesJS-era, dead) — স্ট্যান্ডার্ড।
- **`PhoneOtpVerification.php`** — fillable-এ `order_id` আছে, `pending_data`→array cast, `isExpired(): bool` মেথড।
- **`PhoneOtpActivityLog.php`**, **`EmailOtpVerification.php`**।
- **`Order.php`** (landing page order প্রসঙ্গে দরকারি ফিল্ড): `public_token, customer_name, customer_phone, customer_district, customer_thana, customer_area, source('landing_page'), source_ref(landing_page_id), status, payment_method/status, subtotal, shipping_charge, discount, total, notes, custom_fields(json), otp_required(bool), otp_verified_at`।

---

## ৩. Backend Controllers

### `app/Http/Controllers/Api/LandingPageController.php` (458 lines) — মূল কন্ট্রোলার
- Public: `publicShow($slug)` L30, `publicSubmitOrder(Request,$slug)` L46 (checkout submit, OTP trigger করে), `publicShowOrder(Request,$slug,$orderId)` L107 (thank-you page ডেটা, token-guarded `hash_equals`)।
- Merchant (auth): `index` L162, `store` L200, `show` L229, `update` L244, `destroy`(soft) L280, `publish` L291।
- Private helpers: `validatePayload(...)` L305, `assertVideoEmbedUrlsAllowed(array)` L350, `resolveSlug` L369, `syncProducts` L391, `defaultTheme()` L431, `defaultContent($title)` L443।

### `app/Http/Controllers/Api/LandingMediaLibraryController.php` (144 lines)
- `index()` L14, `store(Request)` L27 (bulk upload → `storage/app/public/landing-media/{user_id}`), `policy()` L97, `effectivePolicy()`/`passesDimensionPolicy()` private।

### `app/Http/Controllers/LandingPageAnalyticsController.php` (151 lines, non-Api namespace)
- `getStatistics` L22, `getVisitors` L48, `getByCountry` L78, `getByReferrer` L104, `linkVisitToOrder` L130। প্রতিটা মেথডে manual `$landingPage->user_id !== auth()->id()` ownership check (policy class নেই)।

### `app/Http/Controllers/LandingPageViewController.php` (68 lines)
- Legacy server-rendered Blade fallback (`resources/views/landing-pages/show.blade.php`)। `show($slug)` L13, `submitOrder(Request,$slug)` L26 — form-post redirect-based, OTP/custom-fields সাপোর্ট নেই।

### `app/Http/Controllers/Api/LandingTemplateController.php` — `index()` L11, `show($id)` L28 (merchant template catalog)।

### `app/Http/Controllers/Api/Admin/LandingTemplateImportController.php` (124 lines)
- Admin-only CartFlows JSON import: `index` L14, `preview` L25, `store` L56, `toggleActive` L114।

### `app/Http/Controllers/Api/CheckoutOtpController.php` (139 lines) — checkout-time OTP
- `verify(Request,$slug,$orderId)` L21 (max 5 attempts, success হলে order → `confirmed`), `resend(Request,$slug,$orderId)` L77।

### `app/Http/Controllers/OtpController.php` (435 lines) — **রেজিস্ট্রেশন OTP, landing page-স্পেসিফিক না** কিন্তু একই `phone_otp_verifications` টেবিল শেয়ার করে।

---

## ৪. Backend Services (`app/Services/`)

- **`LandingPageOrderService.php`** — `create(LandingPage,$validated,$lineItems,$resolvedFields=[]): Order` L19 (DB transaction; Order + OrderItem + OrderStatusLog তৈরি করে, shipping default `content.shipping.inside_dhaka`/80, `linkVisitsToOrder`, `Customer::syncFromOrder`, `AccountingService::onOrderCreated` কল করে); `linkVisitsToOrder` private L125 (৩০ মিনিটের window-এ user_id/ip দিয়ে ম্যাচ)।
- **`LandingPageAnalyticsService.php`** — `recordVisit` L22, `getStatistics` L55, `getVisitorDetails` L87, `getStatisticsByCountry` L131, `getStatisticsByReferrer` L158, `linkVisitToOrder` L185, `updateDailyStatistics` private L197।
- **`IpLocationService.php`** — `getLocation($ip)` L22 (30-day cache), providers: ip-api.com (default), IPStack, MaxMind(stub)।
- **`CheckoutOtpService.php`** (248 lines, constructor injects `SmsCreditService`) — `maybeSendForOrder(LandingPage,Order)` L27 (গেট: `content.settings.otp_verification_enabled` + merchant-এর `khudebarta` SMS gateway + credit থাকতে হবে; ৪-ডিজিট OTP, `expires_at +5min`, `next_resend_at +1min`, `Order.otp_required=true`); `resend(...)` L91 (max ২ resend তারপর ১ ঘণ্টা ব্লক); `renderOtpMessage` private L162 (placeholders: `{customer_name} {order_number} {order_total} {order_items} {otp}`); `formatBdPhoneNumber` private L228 (normalize → `880` + regex `/^8801[0-9]{9}$/`)।

---

## ৫. Backend Routes

`routes/api.php`:
- Public (মিডলওয়্যার `track_landing_page_visit` যেখানে বলা আছে):
  - `GET /public/landing-pages/{slug}` → `LandingPageController@publicShow`
  - `POST /public/landing-pages/{slug}/order` → `@publicSubmitOrder`
  - `GET /public/landing-pages/{slug}/orders/{orderId}` (`throttle:30,1`) → `@publicShowOrder` (thank-you; **visit-track মিডলওয়্যার ইচ্ছাকৃতভাবে নেই**)
  - `POST .../orders/{orderId}/verify-otp` (`throttle:10,1`) → `CheckoutOtpController@verify`
  - `POST .../orders/{orderId}/resend-otp` (`throttle:10,1`) → `@resend`
  - `POST /otp/register`, `/otp/verify-registration`, `/otp/resend` → `OtpController` (রেজিস্ট্রেশন OTP, unrelated)
- `auth:sanctum` + `active_subscription` গ্রুপে:
  - `GET/POST/PUT/DELETE /landing/pages[/{id}][/publish]` → `LandingPageController`
  - `GET /landing/templates[/{id}]` → `LandingTemplateController`
  - `GET /landing/analytics/{id}/statistics|visitors|by-country|by-referrer`, `POST .../link-visit-to-order` → `LandingPageAnalyticsController`
  - `GET /landing/media-library/`, `GET .../policy`, `POST .../upload` → `LandingMediaLibraryController`
  - Admin: `/landing/templates` (list/import/preview/toggle) → `LandingTemplateImportController`

`routes/web.php`:
- `GET /lp/{slug}` (name `landing-pages.show`, mw `track_landing_page_visit`) → `LandingPageViewController@show` (legacy Blade fallback)
- `POST /lp/{slug}/order` → `@submitOrder`

মিডলওয়্যার alias (`bootstrap/app.php`): `track_landing_page_visit`→`TrackLandingPageVisit`, `active_subscription`→`EnsureActiveSubscription`।

---

## ৬. Validation

**`LandingPageController::validatePayload()`** (L305-342): `template_id`(nullable, active template check), `title`(`required_without:id`, max:180), `slug`(nullable unique ignoring self), `status`(`in:draft,published`), `theme_settings`/`content`/`seo_meta`(nullable array — **ভেতরের কী-গুলো validate হয় না**), `custom_css`(nullable string, **sanitize হয় না**), `products.*`(product_id ownership check + override fields)।

শুধু ব্যতিক্রম: **`assertVideoEmbedUrlsAllowed()`** — `content.video_embeds[].url` host regex `/^(www\.)?(youtube\.com|youtu\.be|vimeo\.com|facebook\.com|fb\.watch)$/i` দিয়ে validate হয়, বাকি সব `content` key (hero, features, faq, reviews, carousel_images, html_sections, custom_css, trust_badges, countdown_blocks, thank_you, settings, checkout_fields, layout_order) **opaque JSON, কোনো server-side shape validation নেই**।

**`app/Support/CheckoutFieldResolver.php`** — checkout ফর্ম ভ্যালিডেশনের single source of truth:
- `defaultFields()` — ৭টা বিল্টইন ফিল্ড: `customer_name, customer_phone, customer_address, customer_district, customer_thana, customer_area, notes`।
- `resolve($rawFields)` — `content.checkout_fields` normalize করে, `customer_phone` সবসময় forced required+enabled।
- `buildRules($resolvedFields, $phoneValidationEnabled)` — বেস রুলস + phone validation on থাকলে `regex:BD_PHONE_REGEX`।
- **`BD_PHONE_REGEX = '/^01[3-9]\d{8}$/'`** (backend ও frontend দুই জায়গাতেই এই একই রেজেক্স — সিঙ্ক রাখতে হবে)।
- `snapshotCustomFields()` — `Order.custom_fields` এ `{key,label,value}[]` হিসেবে persist হয়।

---

## ৭. `content` JSON shape (landing_pages.content) — সবচেয়ে গুরুত্বপূর্ণ অংশ

ব্যাকএন্ড এটাকে opaque `array` cast হিসেবে ট্রিট করে; আসল schema-র সংজ্ঞা **ফ্রন্টএন্ডে** (`frontend/src/lib/landing-pages.ts`, টাইপ `LandingPageContent`)। টপ-লেভেল কী-গুলো:

| কী | শেপ | নোট |
|---|---|---|
| `hero` | `{headline, subheadline, cta_text, background_image_url, layout: "center"\|"image-right"}` | সবসময় একটাই |
| `html_sections` | `[{id, title, html}]` | raw HTML ব্লক, legacy |
| `carousel_images` | `[{id, title, template, images:[{id,url,alt}]}]` | |
| `features` | `[{id, title, description, icon}]` | + `features_title` |
| `products_section_title`, `products_section_subtitle` | string | |
| `checkout_fields` | `CheckoutFieldConfig[]` | §৬ দেখো |
| `reviews` | `[{id, name, quote, rating, avatar_url}]` | |
| `faq` | `[{id, q, a}]` | |
| `rich_text_blocks` | `[{id, title, body}]` | body = Tiptap JSON |
| `image_text_blocks` | `[{id, image_url, image_position, heading, body, cta_text, cta_url}]` | |
| `trust_badges` | `[{id, icon, label, sublabel}]` | |
| `countdown_blocks` | `[{id, message, end_datetime}]` | |
| `video_embeds` | `[{id, title, url}]` | host restricted server-side |
| `spacers` | `[{id, style:"space"\|"line"\|"dots", size:"sm"\|"md"\|"lg"}]` | |
| `contact` | `{phone}` | |
| `shipping` | `{inside_dhaka, outside_dhaka}` | ডিফল্ট 80/120, `LandingPageOrderService`-এর shipping fallback |
| `thank_you` | `{title, message, show_order_summary, show_shipping_address}` | ডিফল্ট শিরোনাম "ধন্যবাদ!"; কোনো backend কলাম নেই, শুধু JSON pass-through |
| `settings` | `{language, phone_validation_enabled, phone_validation_message, otp_verification_enabled, otp_verified_message, otp_sms_template, otp_form_title/description/button_text/resend_text}` | §৯/§১০; `language` §১৬ |
| `layout_order` | `Array<string \| {type, id}>` | §৮ দেখো |
| `[key: string]: unknown` | | schema ইচ্ছাকৃতভাবে extensible/unvalidated |

`content` বদলানো হলে `frontend/src/lib/landing-pages.ts`-এর টাইপ ও `mergeLandingContent()` মিরর করে আপডেট করতে হবে।

---

## ৮. `theme_settings` / Design Panel

`LandingPageController::defaultTheme()` (L431-441):
```
primary_color: '#0f766e', accent_color: '#f97316', background_color: '#f8fafc',
text_color: '#0f172a', button_text_color: '#ffffff', font_family: 'Hind Siliguri'
```
**Design panel সম্পূর্ণ implement করা আছে** (পুরনো প্ল্যান ডক অনুযায়ী "মিসিং" ভাবা ভুল):
- লেখা: `landing-page-builder.tsx` এর "design" ট্যাবে `<LandingDesignPanel theme onChange>` → save payload-এ `theme_settings`।
- পড়া: `public-landing-page-view.tsx` (`theme` memo, `.lp-shell` font-family rule) ও `thank-you-view.tsx` — inline style হিসেবে apply।
- ফন্ট পাইপলাইন: `frontend/src/lib/theme-presets.ts` (`FONT_OPTIONS`, `FONT_CSS_VARS`) ↔ `frontend/src/app/lp/[slug]/fonts.ts` (৬টা ফন্ট `next/font/google` দিয়ে সবসময় preload) ↔ `resolveFontCssVar()`।

---

## ৯. layout_order shape — নতুন `{type,id}` শেপে migrate সম্পন্ন

- টাইপ: `Array<string | {type: BlockType, id: string}>` (দুটোই সাপোর্ট করা হয় read-এ)।
- বিল্ডার (`landing-page-builder.tsx`) শুধু নতুন `{type,id}` flat শেপ **লেখে** (`layoutEntries: LayoutEntry[]`)।
- পাবলিক রেন্ডারার (`public-landing-page-view.tsx`) দুই শেপই পড়ে normalize করে `renderRuns`-এ (consecutive same-type entry গুলো এক গ্রুপে) — পুরনো পেজ ঠিকমতো রেন্ডার হয়, নতুন সেভ সবসময় নতুন শেপে।
- `frontend/src/lib/landing-layout.ts`: `BlockType` union (১২ টাইপ), `SINGLETON_BLOCK_TYPES=["products"]`, `ensureItemIds()`, `expandLegacyLayoutOrder()`, `collapseLayoutOrder()` (identity, save-time marker)।

---

## ১০. OTP / ফোন ভেরিফিকেশন

দুইটা আলাদা সাবসিস্টেম, একই `phone_otp_verifications` টেবিল, `purpose` কলাম দিয়ে আলাদা:

**রেজিস্ট্রেশন OTP** (`purpose=registration`, ল্যান্ডিং পেজ-অসম্পর্কিত) — `OtpController.php`।

**চেকআউট OTP** (`purpose=checkout_verification`, per-page toggle `content.settings.otp_verification_enabled`):
1. `LandingPageController::publicSubmitOrder` → Order তৈরি → `CheckoutOtpService::maybeSendForOrder` (গেট: setting on + merchant-এর usable `khudebarta` SMS gateway + credit) → ৪-ডিজিট OTP SMS, `PhoneOtpVerification{token=order.public_token, purpose=checkout_verification, expires_at:+5min}`, `Order.otp_required=true`।
2. Verify: `POST .../verify-otp` → `CheckoutOtpController::verify` (max ৫ attempt, success → `Order.otp_verified_at` set, order status → `confirmed`)।
3. Resend: `POST .../resend-otp` → `CheckoutOtpService::resend` (max ২ resend তারপর ১ ঘণ্টা ব্লক, ১-২ মিনিট cooldown)।
4. ফোন ফরম্যাট: `CheckoutOtpService::formatBdPhoneNumber` → `880XXXXXXXXX`, regex `/^8801[0-9]{9}$/`।

**ফ্রন্টএন্ড:**
- Settings ফিল্ড (`LandingPageSettings` in `landing-pages.ts`): `otp_verification_enabled, otp_verified_message, otp_sms_template, otp_form_title/description/button_text/resend_text` — বিল্ডারের "settings" ট্যাবে এডিটেবল।
- পাবলিক UI: `thank-you-view.tsx`-এর `OtpVerificationCard` (L35-148) — `order.otp_required && !otp_verified` হলে দেখায়; `verify()`/`resend()` উপরের এন্ডপয়েন্টে POST করে।
- Admin badge: `dashboard/orders/page.tsx` (L290) ও `dashboard/orders/[id]/page.tsx` (L425) — `order.otp_verified_at` non-null হলে টিল রঙের "OTP" পিল দেখায়।

**পার-পেজ BD ফোন ভ্যালিডেশন** (আলাদা, সহজ toggle — `content.settings.phone_validation_enabled` + `phone_validation_message`):
- Regex (দুই জায়গাতেই একই, সিঙ্কড): `/^01[3-9]\d{8}$/`
- Backend enforce: `CheckoutFieldResolver::buildRules()`।
- Frontend enforce: `public-landing-page-view.tsx::submitOrder()` L639 — regex fail হলে submit ব্লক করে message দেখায়, `#checkout`-এ scroll করে। ফোন `<input>` সবসময় `type="tel" inputMode="numeric" maxLength={11}`।

---

## ১১. থ্যাংক-ইউ পেজ কাস্টমাইজেশন

- ডেডিকেটেড কলাম নেই — সম্পূর্ণ `content.thank_you` JSON (`title, message, show_order_summary, show_shipping_address`)।
- ব্যাকএন্ড: শুধু store/update/show/publicShow এর মধ্য দিয়ে pass-through। ডেটা সাপ্লাই করে `LandingPageController::publicShowOrder` (`GET /public/landing-pages/{slug}/orders/{orderId}?token=...`, token-guarded `hash_equals`, **`track_landing_page_visit` মিডলওয়্যার ইচ্ছাকৃতভাবে নেই**)।
- বিল্ডার UI: `landing-page-builder.tsx`-এর "content" ট্যাবে "Thank You Page" কার্ড (L1143-1160)।
- রুট: `frontend/src/app/lp/[slug]/thank-you/page.tsx` (SSR, `?order=` ও `?token=` query params পড়ে)।
- রেন্ডার: `frontend/src/components/thank-you-view.tsx` (329 lines) — **`public-landing-page-view.tsx` থেকে আলাদা কম্পোনেন্ট, reuse করে না।**

---

## ১২. Media Library (ছবি আপলোড)

- Backend: `LandingMediaLibraryController` — `index/store/policy` (`GET landing/media-library[/policy]`, `POST .../upload`)। আপলোড path: `storage/app/public/landing-media/{user_id}`। Policy: `ProductMediaSetting` থেকে max count/size/mime/dimensions।
- Frontend: `landing-page-builder.tsx`-এর `uploadMediaFiles()` (L655) + inline picker modal UI (L1437-1477, `mediaTarget` state)। `ImagePickerField` (`block-fields.tsx`) শুধু trigger বাটন।

---

## ১৩. Frontend ফাইল ম্যাপ

### Dashboard pages — `src/app/dashboard/landing-pages/`
- `page.tsx` — list, `/dashboard/landing-pages`।
- `[id]/page.tsx` — read-only detail।
- `[id]/builder/page.tsx` — edit route, `<LandingPageBuilder mode="edit" pageId>`।
- `builder/create/page.tsx` — create route, `<LandingPageBuilder mode="create">`।
- ফিচার ফ্ল্যাগ: `BLOCK_BUILDER_ENABLED=true` (হার্ডকোড, এখন একমাত্র ফ্ল্যাগ)।

### Public pages — `src/app/lp/[slug]/`
- `page.tsx` (79 lines) — SSR, `fetch(cache:"no-store")`, `generateMetadata` from `seo_meta`, রেন্ডার করে `<PublicLandingPageView page>`।
- `fonts.ts` — ৬টা curated ফন্ট (`next/font/google`), `FONT_VARIABLE_CLASSES` এক্সপোর্ট।
- `thank-you/page.tsx` (95 lines) — SSR, `<ThankYouView>`।

### মূল কম্পোনেন্ট
- **`src/components/landing-page-builder.tsx`** (1481 lines) — **একমাত্র এডিটর**। ট্যাব: `content|design|blocks|products|settings`। `buildContent()` L737, `draftPage` memo L780 (in-memory preview object), `handleSubmit` L793 (`POST/PUT landing/pages[/{id}]`), `addBlock/removeBlock/duplicateBlock` L552-586, `renderBlockFields` L851-1069, `uploadMediaFiles` L655।
- **`src/components/public-landing-page-view.tsx`** (1106 lines) — পাবলিক রেন্ডারার, **এডিটর প্রিভিউতেও reuse হয়** (`previewMode?: boolean` prop)। `theme` memo L551, `content = mergeLandingContent(...)` L560, render-order engine L593-624, `submitOrder` L626 (প্রথম লাইনেই `previewMode` গার্ড L629), `renderCheckoutField` L705।
- **`src/components/thank-you-view.tsx`** (329 lines) — আলাদা কম্পোনেন্ট, `OtpVerificationCard` (L35-148)।
- **`src/components/landing-design-panel.tsx`** (119 lines) — Design/color panel।
- **`src/components/landing-builder/block-fields.tsx`** (152 lines) — `TextField, TextAreaField, IconPickerField, RichTextEditorField (Tiptap), ImagePickerField, isAllowedVideoUrl()`।
- **`src/components/landing-builder/block-list.tsx`** (83 lines) — dnd-kit ড্র্যাগ-ড্রপ reorder wrapper।
- **`src/components/landing-page-form.tsx`** — ⚠️ orphaned/dead, ব্যবহার কোরো না।
- `frontend/src/components/landing-builder/blocks/*` (per-block-type ফাইল স্প্লিট) **তৈরি হয়নি** — সব ব্লক ফিল্ড রেন্ডারিং `landing-page-builder.tsx`-এর ভেতরেই inline।

### Shared lib
- **`src/lib/landing-pages.ts`** — `LANDING_API_BASE` (`NEXT_PUBLIC_API_BASE_URL ?? "/api"`), সব টাইপ (`LandingPageRecord, LandingPageContent, CheckoutFieldConfig, LandingPageSettings, ThankYouConfig`), `DEFAULT_CHECKOUT_FIELDS, DEFAULT_SETTINGS, DEFAULT_THANK_YOU, BD_PHONE_REGEX`, ফাংশন `mergeLandingContent(content, template)` L248।
- **`src/lib/theme-presets.ts`** — `ThemeSettings, DEFAULT_THEME, COLOR_PRESETS, FONT_OPTIONS, FONT_CSS_VARS, resolveFontCssVar()`।
- **`src/lib/landing-layout.ts`** — `BlockType, BLOCK_TYPES, LayoutEntry, ensureItemIds(), expandLegacyLayoutOrder(), collapseLayoutOrder()`।
- **`src/lib/block-icons.ts`** — `BLOCK_ICON_MAP` (১৭ lucide icon), `resolveBlockIcon()`।
- **`src/lib/rich-text-extensions.ts`** — `RICH_TEXT_EXTENSIONS = [StarterKit, Link]` (এডিটর+রেন্ডারার দুইজায়গায় শেয়ার্ড)।
- **`src/lib/rich-text-render.ts`** — `renderTiptapJSON()` (হ্যান্ড-রোল্ড JSON→HTML, SSR-এ prosemirror DOM dependency এড়ানোর জন্য)।

### API কল প্যাটার্ন
কোনো central API client নেই। প্রতিটা কম্পোনেন্ট নিজে `fetch()` করে `LANDING_API_BASE`-এর বিপরীতে, `Authorization: Bearer {token}` header manual attach (token আসে `src/lib/dashboard-client.ts::getStoredToken()` থেকে)। পাবলিক এন্ডপয়েন্ট রিলেটিভ `/api/...` (LANDING_API_BASE ছাড়া)।

---

## ১৪. দ্রুত রেফারেন্স — কাজভেদে কোন ফাইল

| কাজ | ফাইল |
|---|---|
| নতুন ব্লক টাইপ যোগ | `landing-layout.ts` (BlockType), `landing-pages.ts` (content টাইপ), `landing-page-builder.tsx` (addBlock/renderBlockFields), `public-landing-page-view.tsx` (নতুন *View কম্পোনেন্ট + render-order engine) |
| থিম/রঙ/ফন্ট পরিবর্তন | `landing-design-panel.tsx`, `theme-presets.ts`, `defaultTheme()` (LandingPageController.php L431) |
| চেকআউট ফিল্ড/ভ্যালিডেশন | `CheckoutFieldResolver.php` (backend), `landing-pages.ts::CheckoutFieldConfig` + builder "content" ট্যাব (frontend) |
| OTP ফ্লো | `CheckoutOtpService.php`, `CheckoutOtpController.php`, `thank-you-view.tsx::OtpVerificationCard` |
| থ্যাংক-ইউ পেজ | `content.thank_you`, `thank-you-view.tsx`, `lp/[slug]/thank-you/page.tsx` |
| অ্যানালিটিক্স/ভিজিটর স্ট্যাটস | `LandingPageAnalyticsService.php`, `LandingPageAnalyticsController.php`, `IpLocationService.php` |
| মিডিয়া/ছবি আপলোড | `LandingMediaLibraryController.php`, `landing-page-builder.tsx::uploadMediaFiles` |
| টেমপ্লেট ইমপোর্ট (admin) | `LandingTemplateImportController.php`, `CartFlowsImportService` |
| লে-আউট রি-অর্ডার (drag-drop) | `landing-layout.ts`, `block-list.tsx` |
| পাবলিক পেজের ভাষা (bn/en) | `content.settings.language` (§১৬) |

## ১৫. Dead/legacy code (ভুলবশত এডিট না করার জন্য)

- `landing-page-form.tsx` — orphaned frontend কম্পোনেন্ট।
- `LandingPageViewController.php` + `resources/views/landing-pages/show.blade.php` — legacy Blade-rendered fallback (non-JS পাথ, OTP/custom fields সাপোর্ট করে না)।
- `landing_page_editor_drafts`, `landing_page_versions`, `landing_page_elements` টেবিল — GrapesJS visual editor-এর অবশিষ্টাংশ, GrapesJS UI ডিলিট হয়ে গেছে কিন্তু টেবিল আছে।
- `.plan/landing_page_studio.md` — historical planning doc, স্টেল ফাইল-রেফারেন্স আছে (উপরে ⚠️ দেখো)।

## ১৬. পাবলিক পেজের ভাষা (`content.settings.language`) — 2026-07-28 যোগ হয়েছে

পাবলিক checkout/thank-you পেজের ফিক্সড UI চ্রোম (labels, বাটন, error message ইত্যাদি — কন্টেন্ট নয়) এখন per-page bn/en টগল সাপোর্ট করে। এটা **builder-এর নিজের `locale` prop (dashboard UI ভাষা) থেকে সম্পূর্ণ আলাদা** — গুলিয়ে ফেলা যাবে না।

- **স্কিমা**: `content.settings.language: "bn" | "en"` (ডিফল্ট `"bn"`, পুরনো পেজে অনুপস্থিত থাকলে `"bn"` ধরা হয় — backward compatible)।
- **ফ্রন্টএন্ড ডিফল্ট ফ্যাক্টরি ফাংশন** (`landing-pages.ts`) — এখন থেকে ভাষা-নির্ভর ডিফল্ট এভাবে পাওয়া যায়, পুরনো bn-only কনস্ট্যান্ট (`DEFAULT_CHECKOUT_FIELDS`, `DEFAULT_THANK_YOU`, `DEFAULT_SETTINGS`) আর ব্যবহার/এক্সপোর্ট হয় না:
  - `getDefaultCheckoutFields(language)`, `getDefaultThankYou(language)`, `getDefaultSettings(language)`।
  - `mergeLandingContent()` নিজে `pageContent.settings?.language ?? templateContent.settings?.language ?? "bn"` রিজলভ করে এই ফ্যাক্টরিগুলো দিয়ে সব ডিফল্ট ফলব্যাক বানায়, এবং merged output-এ `settings.language` সবসময় থাকে।
- **`public-landing-page-view.tsx`**: `PUBLIC_UI_TEXT` (bn/en dictionary, ফাইলের উপরের দিকে) — checkout ফর্মের সব হার্ডকোডেড স্ট্রিং (FAQ/feature টাইটেল ফলব্যাক, shipping label, order summary hint, submit বাটন টেক্সট, ডেলিভারি/contact heading ইত্যাদি) এখান থেকে আসে; `const language = content.settings?.language ?? "bn"; const t = PUBLIC_UI_TEXT[language];`।
- **`thank-you-view.tsx`**: `THANK_YOU_UI_TEXT` dictionary — OTP card-এর error message, order summary labels, shipping address heading ইত্যাদি। `OtpVerificationCard`-এ নতুন `language` prop পাস করতে হয়।
- **`landing-page-builder.tsx`**: Settings ট্যাবের একদম উপরে ভাষা toggle (bn/en বাটন)। `setPageLanguage(next)` হেল্পার ফাংশন (state setter না, প্লেইন ফাংশন) — merchant এখনো কাস্টমাইজ করেনি এমন ডিফল্ট placeholder টেক্সট (checkout field label, thank-you title/message, OTP message ইত্যাদি) অটো-ট্রান্সলেট করে ভাষা বদলানোর সময়, কিন্তু ইউজার-এডিটেড টেক্সট ছোঁয় না (আগের ভাষার ডিফল্টের সাথে exact string match চেক করে)।
- **Backend**: `CheckoutFieldResolver::defaultFields(string $language = 'bn')` ও `resolve(?array $rawFields, string $language = 'bn')` — bn/en উভয় label map আছে। `LandingPageController::publicSubmitOrder()` পেজের `content.settings.language` রিড করে এই দুটোতে পাস করে। `CheckoutOtpService` (SMS template ডিফল্ট + resend-flow error message) ও `CheckoutOtpController` (verify/resend JSON error message) — দুটোই এখন page-এর ভাষা অনুযায়ী bn/en message পিক করে (আগে সব hardcoded bn ছিল)।
- **মনে রাখা জরুরি**: merchant `content.checkout_fields`/`content.thank_you`/`content.settings.*` কাস্টমাইজ করে সেভ করলে সেই exact স্ট্রিং-ই থাকে — ভাষা টগল করলে already-saved কাস্টম টেক্সট বদলায় না, শুধু না-ছোঁয়া ডিফল্ট বদলায়।


## ১৭. Dashboard বিল্ডার UI-এর নিজস্ব bn/en toggle bug fix (2026-07-28)

**এটা §১৬-এর `content.settings.language` (public page ভাষা) থেকে সম্পূর্ণ আলাদা জিনিস** — এটা dashboard-এর নিজের UI ভাষা (`getStoredLocale()`, topbar-এর "Language: EN/BN" toggle) নিয়ে, merchant/admin builder ইন্টারফেস (ট্যাব, ফিল্ড লেবেল ইত্যাদি) কোন ভাষায় দেখাবে সেটা নিয়ে।

### বাগ

`landing-pages` route-এর ৪টা page component (`page.tsx`, `[id]/page.tsx`, `builder/create/page.tsx`, `[id]/builder/page.tsx`) নিজেদের `locale` state আলাদাভাবে init করত এভাবে:
```ts
const [locale, setLocale] = useState<Locale>("bn");
useEffect(() => {
  setLocale(getStoredLocale());
  window.addEventListener("storage", () => setLocale(getStoredLocale()));
  ...
}, []);
```
এটা `UserShell`-এর নিজস্ব locale-sync effect-এর সাথে race করত: `UserShell`-এর mount-effect (`setLocale(getStoredLocale())`, deps `[]`) এবং locale-sync effect (`localStorage.setItem(...)`, deps `[locale]`) — দুটোই প্রথম mount-এ একসাথে ফায়ার হয়, আর `[locale]`-effect টা প্রথমবার পুরনো ডিফল্ট `"bn"` state দিয়েই রান করে, তাই localStorage-এ transient ভাবে `"bn"` লিখে ফেলে (এমনকি user আগে `"en"` সিলেক্ট করে থাকলেও), তারপর ঠিক হয়ে যায়। কিন্তু landing-pages-এর page component-গুলো ঠিক সেই brief transient window-এ `getStoredLocale()` কল করলে ভুল `"bn"` পড়ে ফেলত এবং **সেটাই স্থায়ীভাবে আটকে যেত** — কারণ `window.addEventListener("storage", ...)` same-tab localStorage write-এ কখনোই fire হয় না (browser spec অনুযায়ী শুধু অন্য ট্যাব/উইন্ডোতে fire হয়)। ফলাফল: topbar-এ "Language: English" দেখালেও পুরো builder body (ট্যাব, ফিল্ড লেবেল) সবসময় বাংলায় আটকে থাকত।

### আসল, সঠিক pattern (বাকি dashboard যেভাবে করে)

`frontend/src/app/dashboard/orders/page.tsx`-এ ব্যবহৃত pattern:
```ts
const [locale] = useState<Locale>(getStoredLocale);
```
`useState`-এর **lazy initializer** হিসেবে `getStoredLocale` ফাংশন রেফারেন্স পাস করা — React এটা component mount-এর সময় render-phase-এ synchronously একবার কল করে, কোনো effect চলার আগে। এতে `UserShell`-এর transient-overwrite window-এর সাথে race হওয়ার সুযোগই থাকে না (আগের render/commit cycle-এ storage যা settle হয়ে ছিল সেটাই পড়ে)। একটা downside: locale toggle করলে *ইতিমধ্যে মাউন্ট করা* page সাথে সাথে re-render হবে না (navigation/reload দরকার) — কিন্তু এটাই পুরো SaaS-জুড়ে established/consistent আচরণ, bug না।

### Fix প্রয়োগ করা হয়েছে

উপরের ৪টা ফাইলেই `useState<Locale>("bn")` + mount-effect + storage-listener প্যাটার্ন সরিয়ে `useState<Locale>(getStoredLocale)`-এ পরিবর্তন করা হয়েছে (data-fetching effect গুলো অক্ষত রাখা হয়েছে, শুধু locale-reading অংশ বাদ)। পাশাপাশি `theme-presets.ts::FONT_OPTIONS` (flat array, locale-independent) → `getFontOptions(locale)` ফাংশনে রূপান্তর করা হয়েছে যাতে একমাত্র hardcoded বাংলা label ("Hind Siliguri (ডিফল্ট)") ইংরেজি মোডে ঠিকমতো দেখায়।

**ভবিষ্যতে নতুন dashboard page লেখার সময়**: কখনো `useState("bn") + useEffect(() => setLocale(getStoredLocale()), [])` প্যাটার্ন ব্যবহার কোরো না — সবসময় `const [locale] = useState<Locale>(getStoredLocale);` ব্যবহার করো (orders/page.tsx-এর pattern অনুসরণ করে)।
