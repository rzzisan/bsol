# Order + Product Module Deep Execution Context

Last updated: 2026-05-08
Scope: Phase 1 module hardening + UX redesign for Order intake and Product media system
Status: Phase A → D completed and deployed ✅ (2026-05-08)

---

## 1) উদ্দেশ্য (Why this file exists)

এই document-এর লক্ষ্য:
1. **Order** এবং **Product** module-এর জন্য একসাথে একটি implementation blueprint দেওয়া
2. নতুন **single-page order intake** flow design করা (এক পেজে দ্রুত অর্ডার নেওয়া)
3. **Product media management** (thumbnail + multiple gallery images) এর জন্য admin-configurable policy define করা
4. এমনভাবে requirements lock করা যাতে এই file follow করে coding শুরু করলে rework কম হয়

---

## 2) Existing baseline (বর্তমান অবস্থা)

`SAAS_MODULE_CONTEXT.md` অনুযায়ী:
- Order module: CRUD + status + bulk + stats + frontend routes live
- Product module: product/category/stock routes live
- Architecture: Laravel 13 + Next.js 16 + PostgreSQL + Sanctum
- UI guardrail: bilingual + mobile-first + theme token-based design mandatory
- Deployment guardrail: frontend build + supervisor restart + live smoke check mandatory

এই context file baseline-এর ওপর advanced UX + data model hardening যোগ করছে।

---

## 3) Problem statement

বর্তমান flow-এ pain point:
- Order create করতে একাধিক step/context switch লাগে
- Product create/edit-এ advanced media workflow (thumbnail + gallery policy) explicitভাবে নেই
- Product image policy (max image count / max size / allowed types) admin থেকে control করা যায় না
- Sales/operator use-case অনুযায়ী fast order নেওয়ার জন্য single-screen optimized UI নেই

---

## 4) Target outcomes (Success definition)

### 4.1 Order module target
- এক পেজে end-to-end অর্ডার নেওয়া যাবে (customer + items + shipping + payment + notes + risk संकेत)
- Product search/select + quick quantity/edit + total calculation instant হবে
- Mobile operator 60–90 সেকেন্ডে order submit করতে পারবে (target UX)

### 4.2 Product module target
- Product create/edit-এ:
  - title
  - description
  - thumbnail image
  - gallery images (multiple)
- Admin panel থেকে image policy configure করা যাবে:
  - max image count
  - max file size (MB)
  - allowed mime types
  - per-image dimension recommendation
- Upload validation backend + frontend উভয় জায়গায় enforce হবে

---

## 5) One-page New Order intake design (UX + fields)

## 5.1 Page route
- Proposed: `/dashboard/orders/create` (existing route upgraded)
- Layout: `UserShell` + one-page sections + sticky summary panel

### 5.2 Section কাঠামো
1. **Customer & Delivery**
   - customer_name (required)
   - customer_phone (required, normalized)
   - alternative_phone (optional)
   - customer_address (required)
   - district/thana (optional কিন্তু suggested)
   - source (manual/facebook_inbox/landing_page)

2. **Products & Items**
   - product search (name/SKU)
   - add item (multi-line)
   - qty +/- quick control
   - unit price override permission (role-based optional)
   - line discount (optional)
   - stock warning inline

3. **Charges & Payment**
   - subtotal (auto)
   - shipping_charge
   - discount
   - total (auto)
   - payment_method (cod/online/bkash)
   - payment_status (due/partial/paid)

4. **Courier & Delivery preferences**
   - courier নির্বাচন (if connected)
   - courier_charge (optional এখনই)
   - delivery note / time slot (optional)

5. **Risk & Notes**
   - auto fraud score badge (low/medium/high)
   - warning banner for high risk
   - internal notes

6. **Submit actions**
   - Save as pending
   - Save and confirm
   - Save and create new (quick operator flow)

### 5.3 UX আচরণ (operator-friendly)
- Auto focus next input
- Enter key controlled navigation
- Phone input দিলে existing customer/order summary suggestion
- Product line add/remove keyboard shortcut
- Sticky bottom bar on mobile: `Total + Submit`
- Dirty form guard (accidental back/refresh protection)

---

## 6) Product management redesign (title/description/media)

### 6.1 Mandatory product fields
- title (required)
- description (required, plain text + optional rich text later)
- sku (required, per-user unique)
- selling_price (required)
- cost_price (optional but recommended)
- stock (required if track_stock true)
- status (active/inactive)

### 6.2 Media model requirements
- Single **thumbnail** (required for active product)
- Multiple **gallery images** (0..N)
- Reorder gallery
- Select gallery image as thumbnail
- Replace/remove image

### 6.3 Admin-controlled image policy (must-have)
- max_gallery_images (e.g., default 8)
- max_file_size_mb (e.g., default 2MB)
- allowed_mime_types (e.g., image/jpeg,image/png,image/webp)
- min/max dimensions (optional strict বা warning mode)
- thumbnail_required (bool)

---

## 7) Admin control feature (image limits)

### 7.1 Route/UI proposal
- Admin settings route:
  - `/admin/settings/product-media`
- Seller-side display:
  - Product form-এ current policy hint (e.g., “Max 8 images, 2MB each, JPG/PNG/WEBP”)

### 7.2 Backend policy ownership (important)
`CONTEXT.md` section 25 অনুযায়ী system configuration shared হওয়া উচিত।
তাই এই policy admin-shared resource হিসেবে treat হবে:
- controller-এ `adminScopeUserIds()` pattern
- settings create/update audit trail: `user_id = auth()->id()`

---

## 8) Data model proposal

### 8.1 New table: `product_media`
Columns:
- id
- product_id (FK)
- user_id (FK, scoped)
- file_path
- file_name
- mime_type
- file_size_bytes
- width (nullable)
- height (nullable)
- sort_order
- is_thumbnail (bool)
- created_at, updated_at

Constraints:
- One active thumbnail per product (partial unique logic by app বা DB strategy)
- product ownership check mandatory (`product.user_id == auth()->id()`)

### 8.2 New table: `product_media_settings` (admin shared)
Columns:
- id
- user_id (admin creator/updater for audit)
- max_gallery_images (int)
- max_file_size_mb (int)
- allowed_mime_types (jsonb)
- min_width (nullable)
- min_height (nullable)
- max_width (nullable)
- max_height (nullable)
- thumbnail_required (bool)
- is_active (bool)
- created_at, updated_at

Rule:
- latest active config applies globally for sellers (admin shared scope)

---

## 9) API design proposal

### 9.1 Seller product media APIs
- `POST /api/products/{id}/media` (multi upload)
- `DELETE /api/products/{id}/media/{mediaId}`
- `PUT /api/products/{id}/media/reorder`
- `PUT /api/products/{id}/media/{mediaId}/set-thumbnail`
- `GET /api/products/{id}/media`

### 9.2 Seller policy read API
- `GET /api/products/media-policy`
  - returns currently effective limits (read-only for seller)

### 9.3 Admin policy APIs
- `GET /api/admin/settings/product-media`
- `PUT /api/admin/settings/product-media`

### 9.4 One-page order intake API extensions
- Existing `POST /api/orders` kept
- Add helper endpoints:
  - `GET /api/orders/create/bootstrap` (products, categories, courier list, quick defaults)
  - `GET /api/customers/lookup-by-phone?phone=`

---

## 10) Validation rules (must enforce)

### 10.1 Product media upload validation
- file type in allowed list
- file size <= configured max
- gallery image count <= configured max
- thumbnail_required হলে publish/active product without thumbnail blocked

### 10.2 Order create validation
- phone normalized (Bangladesh format)
- items মিনিমাম 1
- qty > 0
- total server-side recalculated (client total trusted না)
- product ownership/scoping check
- stock rule (if track_stock)

---

## 11) Suggested extra features (recommended)

### 11.1 Order module
- Draft order save
- Duplicate order detection (same phone + close time window)
- Quick repeat order button from customer profile
- Auto shipping charge suggestion by district/courier
- SLA timers: pending age alert

### 11.2 Product module
- Image compression pipeline (server-side optimize)
- Alt text field (SEO / accessibility)
- Variant-wise image support (phase-2)
- Soft delete + restore
- Low stock threshold alert per product

---

## 12) Security + scope guardrails

- Seller resources: strict `where('user_id', auth()->id())`
- Admin settings: only `is_admin` routes
- Upload path randomization + filename sanitization
- MIME + extension both validate
- Direct storage path exposure এড়াতে signed/public URL strategy

---

## 13) Frontend component architecture

### 13.1 New/updated components
- `frontend/src/components/orders/order-intake-form.tsx`
- `frontend/src/components/orders/order-item-grid.tsx`
- `frontend/src/components/orders/order-summary-sticky.tsx`
- `frontend/src/components/products/product-media-uploader.tsx`
- `frontend/src/components/products/product-gallery-manager.tsx`
- `frontend/src/components/products/media-policy-hint.tsx`

### 13.2 Page updates
- `frontend/src/app/dashboard/orders/create/page.tsx` (one-page redesign)
- `frontend/src/app/dashboard/products/page.tsx` (title/description/media actions)
- `frontend/src/app/dashboard/products/[id]/edit` (if route created)
- `frontend/src/app/admin/settings/product-media/page.tsx` (new)

---

## 14) Backend implementation map

- `backend/app/Http/Controllers/Api/OrderController.php` (create bootstrap and hardened store)
- `backend/app/Http/Controllers/Api/ProductController.php` (title/description/media integration)
- `backend/app/Http/Controllers/Api/ProductMediaController.php` (new)
- `backend/app/Http/Controllers/Api/Admin/ProductMediaSettingsController.php` (new)
- `backend/app/Http/Requests/*` (FormRequest coverage)
- `backend/app/Services/ProductMediaService.php` (upload/thumbnail/reorder)
- `backend/database/migrations/*_create_product_media_table.php`
- `backend/database/migrations/*_create_product_media_settings_table.php`

---

## 15) Delivery phases (coding order)

### Phase A: Foundations
1. migrations + models
2. policy read API + admin settings API
3. product media upload APIs

### Phase B: Product UI
4. product form fields (title/description)
5. media uploader/gallery/thumbnail selection
6. policy-driven frontend validation

### Phase C: One-page order UI
7. order bootstrap endpoint
8. redesigned single-page order intake
9. customer lookup + product picker + sticky summary

### Phase D: Hardening
10. full FormRequest validation
11. tests (feature + unit)
12. build/restart/smoke/report

---

## 16) Acceptance criteria (Definition of Done)

### Product media
- Admin limit পরিবর্তন করলে seller UI সঙ্গে সঙ্গে নতুন limit reflect করে
- Limit exceed upload backend 422 দেয়
- Thumbnail switch works
- Product list/detail thumbnail render works

### One-page order
- এক screen থেকে order সম্পন্ন করা যায়
- Totals server-side verified
- Mobile viewport-এ usable without horizontal scroll
- High risk warning visibly shown before submit

---

## 17) Test plan (minimum)

### Backend
- Upload valid image success
- Invalid mime/size rejected
- Gallery max count enforced
- Set thumbnail updates old thumbnail off
- Order create with invalid items rejected
- Order create with valid items + totals success

### Frontend
- Mobile create order flow smoke test
- Product media add/remove/reorder test
- Policy change reflection test
- Bangla/English copy renders correctly

---

## 18) Deployment checklist (strict)

1. `cd /var/www/hybrid-stack/frontend && npm run build`
2. `sudo supervisorctl restart hybrid-stack-frontend`
3. `sudo supervisorctl status hybrid-stack-frontend`
4. Smoke checks:
   - `/dashboard/orders/create`
   - `/dashboard/products`
   - `/admin/settings/product-media`
   - asset load 200
5. Backend checks:
   - migrations run
   - `php artisan route:list` verify middleware/scope

---

## 19) Open decisions (updated after implementation)

1. ✅ Default max gallery image count: **8** (implemented, admin-editable)
2. ✅ Default max image size: **2MB** (implemented, admin-editable)
3. ⏳ Description editor type: currently **plain textarea**, rich text later phase
4. ⏳ Seller unit-price override permission: currently **allowed**, role-gate later
5. ⏳ Draft order retention: draft system not included in this release

---

## 20) Implementation Log — Phase A → D (2026-05-08)

### ✅ Phase A: Foundations completed
- New DB tables/migrations:
  - `product_media_settings` created
  - `product_images` enhanced for media metadata (`user_id`, file meta, dimensions)
- New models:
  - `ProductMediaSetting`
  - `ProductImage` enhanced
- New APIs/routes:
  - Seller: media policy + media CRUD/reorder/set-thumbnail
  - Admin: `/api/admin/settings/product-media` (GET/PUT)
  - Order helper: `/api/orders/create/bootstrap`

### ✅ Phase B: Product UI/media completed
- Product list page updated with:
  - Thumbnail preview in table
  - `Media` action button per product
  - Media policy hint rendering
- New reusable components:
  - `product-media-uploader`
  - `product-gallery-manager`
  - `media-policy-hint`
- New admin page:
  - `/admin/settings/product-media`
- Admin menu updated to include Product Media settings entry

### ✅ Phase C: One-page order intake completed
- `/dashboard/orders/create` redesigned to one-page workflow using:
  - `order-intake-form`
  - `order-item-grid`
  - `order-summary-sticky`
- Included sections:
  - Customer + location + source
  - Product search/add/edit lines
  - Payment/charge/notes
  - Sticky summary + submit
- Uses bootstrap API + phone lookup for faster data entry

### ✅ Phase D: Hardening completed
- FormRequest introduced:
  - `StoreOrderRequest`
  - `ProductMediaUploadRequest`
  - `Admin\UpdateProductMediaSettingsRequest`
- Product validation hardened:
  - SKU required + per-user unique
  - Description required
- Feature tests added:
  - `tests/Feature/ProductMediaApiTest.php`

### ✅ Deployment + verification evidence
- Migrations applied successfully:
  - `2026_05_08_100100_create_product_media_settings_table`
  - `2026_05_08_100200_alter_product_images_for_media_workflow`
- Backend route verification passed for:
  - product media endpoints
  - order bootstrap endpoint
  - admin product media settings endpoints
- Backend tests passed:
  - `php artisan test --filter=ProductMediaApiTest` → **3 passed**
- Frontend build passed:
  - `npm run build` success, new route `/admin/settings/product-media` present
- Runtime deploy completed:
  - `supervisorctl restart hybrid-stack-frontend` success
- Live smoke checks passed (`200`):
  - `/dashboard/orders/create`
  - `/dashboard/products`
  - `/admin/settings/product-media`
  - current CSS asset load `200`

---

## 21) Next immediate follow-up (post-release)

1. Add draft-order save/load (Phase C enhancement)
2. Add rich-text description editor for product details
3. Add server-side image optimization/compression pipeline
4. Introduce role-based unit-price override restriction
5. Add end-to-end browser tests for one-page order intake
