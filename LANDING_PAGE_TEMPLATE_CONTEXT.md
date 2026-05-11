# Landing Page Template System — Full Execution Context

Last updated: 2026-05-11  
Scope: Admin-controlled seller landing page template system (3 production templates)  
Status: Context locked for implementation ✅

---

## 1) উদ্দেশ্য (Why this file exists)

এই document-এর উদ্দেশ্য:

1. আপনার দেওয়া ৩টি reference landing page থেকে production-ready template specification lock করা
2. Admin dashboard-এ template management flow define করা
3. Admin যে template enable করবে, seller কেবল সেটাই ব্যবহার করতে পারবে — এই rule enforce করা
4. এমন data model + API + frontend route + UX contract define করা যাতে এই file follow করে end-to-end coding করা যায়

---

## 2) Business Requirement (locked)

### 2.1 Core requirement

- System-এ ৩টি landing template থাকবে
- Template গুলো admin dashboard-এ visible থাকবে
- Admin template-level enable/disable control করবে
- Seller template gallery-তে শুধু enabled template দেখবে
- Seller no-code wizard follow করে landing page publish করতে পারবে

### 2.2 3 template sources (research-derived)

1. `goofiworld.com/offer/flashcards` style  
2. `laambd.shop` style  
3. `naturivabd.com/step/asthma-cure/` style

---

## 3) Template Catalog (Final)

> নিচের template code/key গুলো system-wide immutable identifier হিসেবে ব্যবহার করতে হবে।

---

### 3.1 Template A — `goofi_flashcard_offer`

**Inspired by:** Goofi flashcard offer page  
**Use-case:** শিক্ষা/বেবি/skill-based product, multi-product selection + full checkout form

#### Section order (default)
1. Hero Problem-Solution
2. Authority/Research Proof Strip
3. Social Proof Carousel (review images)
4. FAQ Accordion
5. Reinforcement CTA Block
6. Product Selector (multi product + qty)
7. Shipping/Billing Form
8. Order Summary + Payment Methods
9. Footer Trust + Phone + Policy Links

#### Mandatory editable fields
- `hero_title`
- `hero_subtitle`
- `authority_text`
- `review_images[]`
- `faq_items[]`
- `cta_text_primary`
- `products[]` (name, image, regular_price, sale_price, default_qty)
- `shipping_rules[]` (inside/outside zones)
- `payment_methods[]` (COD required by default)
- `support_phone`
- `privacy_policy_url`
- `terms_url`

#### Conversion features
- Multi-product checkbox with qty stepper
- Discount breakdown row (original / discount / you save)
- COD + optional online methods

---

### 3.2 Template B — `laambd_story_checkout`

**Inspired by:** LaamBD story-led landing  
**Use-case:** single-focus health/wellness product with strong storytelling

#### Section order (default)
1. Emotional Hook (problem pain)
2. Benefit Bullets
3. Certification/Authority Carousel
4. Usage Instructions
5. Repeated CTA Anchors
6. Testimonials (video + image proof)
7. Offer Packages (2-tier or 3-tier)
8. Order Form (simple fields)
9. COD Confirmation + Contact
10. Policy Footer

#### Mandatory editable fields
- `hook_headline`
- `hook_paragraph`
- `benefit_points[]`
- `certification_images[]`
- `usage_rules[]`
- `testimonial_media[]`
- `offer_packages[]` (label, price, badge, notes)
- `delivery_text`
- `form_title`
- `billing_fields` (name, phone, address)
- `support_phone`
- `privacy_policy_url`
- `terms_url`

#### Conversion features
- CTA anchor repeated in multiple sections
- Best-selling package badge
- Simple, low-friction checkout

---

### 3.3 Template C — `naturiva_package_upsell`

**Inspired by:** Naturiva package + upsell flow  
**Use-case:** package-based offer with post-package upsell checkbox

#### Section order (default)
1. Hero Health Claim (compliance-safe text)
2. Review Wall Carousel
3. Package Comparison Strip (15d/1m/3m type)
4. Quick Contact (Call + WhatsApp)
5. Order Form with package radio selection
6. Shipping Zone Selection
7. One-time Upsell Block (checkbox + combo)
8. COD confirmation + final CTA
9. Policy/Terms/Footer

#### Mandatory editable fields
- `hero_title`
- `hero_subtitle`
- `reviews[]`
- `packages[]` (name, price, highlight, bonus)
- `contact_numbers[]`
- `shipping_zones[]`
- `upsell` (enabled, title, description, price)
- `cod_confirmation_text`
- `final_cta_text`
- `privacy_policy_url`
- `terms_url`

#### Conversion features
- Package radio selector
- One-time upsell গণনায় total update
- Zone-based shipping toggle

---

## 4) Admin Control Rules (must enforce)

### 4.1 Admin can control

- Template active/inactive status
- Template sort order
- Template eligibility by seller package (optional phase-2)
- Template thumbnail + description

### 4.2 Seller visibility rule

Seller API response-এ শুধুমাত্র:
- `is_active = true`
- package restriction pass করলে
এই template-গুলো যাবে

### 4.3 Non-negotiable rule

> Disabled template seller create/edit page-এ selectable হবে না।

যদি seller old page-এ disabled template already use করে:
- Existing published page continue করতে পারবে
- কিন্তু new page create-এ disabled template unavailable

---

## 5) Access & Scope Policy (aligned with CONTEXT.md §25)

### 5.1 Shared (admin-scoped) resources
- Landing template catalog
- Template enable/disable flags
- Template default block schema

### 5.2 Per-user resources (seller-scoped)
- Seller created landing pages
- Seller landing page settings/content
- Seller landing page products
- Seller landing page analytics

### 5.3 Security middleware
- Admin routes: `auth:sanctum` + `is_admin`
- Seller routes: `auth:sanctum`

---

## 6) Database Model (Laravel/PostgreSQL target)

> Naming aligned with existing hybrid-stack conventions.

### 6.1 `landing_templates` (admin-managed)
- `id`
- `code` (unique: `goofi_flashcard_offer`, etc.)
- `name_bn`
- `name_en`
- `description_bn`
- `description_en`
- `thumbnail_url`
- `category` (`education`, `story`, `package`)
- `default_schema_json` (full section schema + default copy)
- `is_active` (bool)
- `sort_order` (int)
- `created_by` (admin user id)
- timestamps

### 6.2 `landing_template_access_rules` (phase-2 ready)
- `id`
- `template_id`
- `package_id` (nullable; null মানে all packages)
- `is_enabled` (bool)
- `created_by`
- timestamps

### 6.3 `landing_pages` (seller-owned)
- `id`
- `user_id`
- `template_id`
- `title`
- `slug` (unique)
- `status` (`draft`, `published`, `archived`)
- `public_url`
- `meta_title`
- `meta_description`
- `theme_tokens_json`
- `content_json`
- `published_at`
- timestamps

### 6.4 `landing_page_products`
- `id`
- `landing_page_id`
- `product_id`
- `custom_title` nullable
- `custom_price` nullable
- `default_qty`
- `display_order`
- `is_featured`
- timestamps

### 6.5 `landing_page_analytics_daily`
- `id`
- `landing_page_id`
- `view_date`
- `total_views`
- `unique_visitors`
- `cta_clicks`
- `checkout_starts`
- `orders_completed`
- `revenue`
- timestamps

Unique: (`landing_page_id`, `view_date`)

---

## 7) API Contract (Implementation-ready)

### 7.1 Admin APIs

- `GET /api/admin/landing/templates`
- `POST /api/admin/landing/templates` (usually seeded তিনটি; future custom)
- `PUT /api/admin/landing/templates/{id}`
- `PUT /api/admin/landing/templates/{id}/toggle`
- `PUT /api/admin/landing/templates/reorder`
- `GET /api/admin/landing/templates/access-rules`
- `PUT /api/admin/landing/templates/access-rules`

### 7.2 Seller APIs

- `GET /api/landing/templates/available`
- `POST /api/landing/pages`
- `GET /api/landing/pages`
- `GET /api/landing/pages/{id}`
- `PUT /api/landing/pages/{id}`
- `PUT /api/landing/pages/{id}/publish`
- `PUT /api/landing/pages/{id}/archive`
- `GET /api/landing/pages/{id}/preview`

### 7.3 Public APIs (no auth)

- `GET /store/{slug}` (public landing render)
- `POST /api/landing/track/view`
- `POST /api/landing/track/cta`

---

## 8) Frontend Routes & Screens

### 8.1 Admin dashboard pages

1. `/admin/landing/templates`
   - 3 template card list
   - active/inactive toggle
   - sort order drag বা numeric

2. `/admin/landing/templates/access`
   - package-wise enable matrix (phase-2)

### 8.2 Seller dashboard pages

1. `/dashboard/landing-pages`
   - seller pages list (draft/published)
2. `/dashboard/landing-pages/create`
   - Step 1: template select (only enabled)
   - Step 2: content fill (section-based)
   - Step 3: product attach
   - Step 4: preview + publish
3. `/dashboard/landing-pages/[id]/edit`
4. `/dashboard/landing-pages/[id]/analytics`

---

## 9) No-Code Builder UX (strict)

### 9.1 Wizard steps (seller)

1. Template select
2. Brand & contact setup
3. Section content input
4. Product/package setup
5. Order form setup
6. Policy links + publish

### 9.2 Validation rules

- Required fields ছাড়া publish blocked
- At least 1 product/package required
- policy links missing হলে warning (hard-block optional)
- invalid phone format blocked

### 9.3 Mobile-first requirement

- Live mobile preview panel mandatory
- Sticky CTA simulation on preview

---

## 10) Default JSON Schema Contract (renderer)

`content_json` structure must support:

- `sections[]`
  - `id` (string)
  - `type` (hero/reviews/benefits/faq/order_form/upsell/...)
  - `enabled` (bool)
  - `order` (int)
  - `data` (object)
- `theme`
  - `primary_color`
  - `secondary_color`
  - `accent_color`
  - `font_family`
- `contact`
  - `phone`
  - `whatsapp`
- `policy`
  - `privacy_url`
  - `terms_url`
  - `return_url` (optional)

---

## 11) Order Integration Rule

Landing page order submit হলে:
- existing order module-এ order create হবে
- `source = landing_page`
- `notes`-এ landing slug/template code attach হবে
- optional `landing_page_id` mapping table-এ save হবে

---

## 12) Compliance Guardrails (important)

বিশেষ করে health template (`laambd_story_checkout`, `naturiva_package_upsell`) এ:

- absolute cure claims avoid করতে হবে
- disclaimer optional block available রাখতে হবে
- misleading before/after content admin-review flag রাখতে হবে (phase-2)

---

## 13) Seeder Requirement (initial launch)

Initial migration/seed run-এ exactly 3 template seed করতে হবে:

1. `goofi_flashcard_offer`
2. `laambd_story_checkout`
3. `naturiva_package_upsell`

All 3 initially `is_active = true` (admin later toggle করতে পারবে)

---

## 14) Implementation Plan (practical order)

### Phase A — Foundation
1. migrations + models
2. admin template CRUD/toggle APIs
3. seller available template API

### Phase B — Builder
4. seller create wizard
5. section editor + preview
6. publish flow

### Phase C — Public Render
7. `/store/{slug}` renderer
8. analytics tracking endpoints

### Phase D — Hardening
9. package access matrix
10. tests + production verification

---

## 15) Acceptance Criteria (Definition of Done)

1. Admin template disable করলে seller create page-এ template vanish করবে
2. Admin enable করলে seller create page-এ template appear করবে
3. Seller তিনটির যেকোনো enabled template দিয়ে landing page publish করতে পারবে
4. Public URL কাজ করবে
5. Order source `landing_page` হিসেবে save হবে
6. Mobile view-এ all templates usable হবে

---

## 16) Test Checklist

### Backend
- template toggle access control test
- seller available template filtering test
- disabled template with create request returns 422/403
- landing publish + slug uniqueness test

### Frontend
- admin toggle reflect in seller list
- wizard validation flow
- preview render for all 3 templates
- publish + edit + archive flow

---

## 17) Notes for future agents

- এই file-কে landing template implementation-এর source of truth ধরে কাজ করতে হবে
- নতুন template add করলে `Template Catalog` section update mandatory
- routing/menu integration করার সময় existing `admin-menu`/`user-shell` design consistency policy follow করতে হবে
- bilingual + mobile-first + theme-token rules (`CONTEXT.md`) সবসময় enforce করতে হবে
