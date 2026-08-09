# F-Commerce SaaS — Module Context

Last updated: 2026-08-09 — bKash subscription-billing gateway is now **live in production** with a real merchant account (§18.2): the credentials turned out to be for the classic PGW/Checkout API, not Tokenized Checkout, so that product was implemented too (config-toggleable, both kept in code) and verified with a real ৳5 transaction. See below. Older entries kept as-is:

Last updated: 2026-08-08 — Added §17.10: five more open findings from §17 fixed (queue worker, admin self-lockout, fraud-score↔courier merge, customers FK, Steadfast bulk-correlation, courier cancel() route) — see below. Older entries kept as-is:

Last updated: 2026-08-07 — Added §15.9a: SaaS Support chat (seller ↔ admin-team shared inbox), fully coded, migrated, deployed, and live-verified — see below. Older entries kept as-is:

Last updated: 2026-08-02 — Added §15 (full codebase feature audit, ground-truth scanned), §16 (prioritized recommendations), and §17 (deep line-by-line code review with specific file:line bugs/risks, 6-pass independent review covering every controller/service). Sections 12–14 below are the **original Phase 1/2 plan and are now stale** (last accurate as of 2026-05-04) — কোডবেস অনেক এগিয়ে গেছে তার পরে। **§15-কে "কী আছে" এবং §17-কে "কতটা ভালো/নিরাপদ" প্রশ্নের single source of truth হিসেবে ব্যবহার করো**, sections 12–14 শুধু historical record হিসেবে রাখা হয়েছে। **Courier provider abstraction (§16.2) commit `0fdc3ab`-এ সম্পন্ন। Facebook/Meta lead-capture MVP (§16.3) কোড+deploy সম্পন্ন কিন্তু Meta App credentials না থাকায় এখনো live নয় — বিস্তারিত §15.11-এ। এই কাজের সময় একটা নতুন 🔴 CRITICAL finding ধরা পড়েছে: production-এ কোনো queue worker নেই, delayed SMS automation silently ভাঙা — §17.0 item #12 / §17.5-এ বিস্তারিত, এখনো ফিক্স করা হয়নি।**
Status: Phase 1 complete; Phase 2 mostly complete (SMS automation, accounting, courier — 4 providers — all live); Analytics (sales/customer/courier — §15.7) এখন **DONE**; **নিজের subscription billing-এর জন্য bKash payment gateway (§18/§18.2) এখন real merchant credential দিয়ে production-এ live** (customer-facing landing-page checkout online payment এখনো শুরু হয়নি — সেটা ভিন্ন, বড় স্কোপ); Shop Settings + Facebook/Meta integration (incl. Ads ROI, যেটা Facebook-নির্ভর) still not started (§15/§16)। **§17-এর ১১টা 🔴/🟠 critical finding সবগুলো ফিক্স করা হয়েছে এবং deploy করা হয়েছে (২০২৬-০৮-০২, একই সেশনে) — বিস্তারিত §17.9-এ, implementation log-সহ।** Backend সব migrate/live; frontend XSS fix `npm run deploy:prod:safe` দিয়ে সফলভাবে deploy হয়েছে (৮/৮ ধাপ pass, `hybrid-frontend.service` active)। **নন-variant stock deduction + bulkStatus inventory gap (§17.9-এর শেষে) এখনো একই দিনে ফিক্স হয়েছে।** Analytics module (§16.1) একই দিনে শেষ — বিস্তারিত §15.7-এ, deploy-এর সময় একটা self-caused frontend build/restart incident হয়েছিল যেটা সাথে সাথে ধরা পড়ে ও ফিক্স হয়েছে (details §15.7-এ)।

---

## 1. Product Vision

একটি **All-in-One বিজনেস টুল** যা বাংলাদেশের ফেসবুক/সোশাল মিডিয়া বিক্রেতাদের জন্য তৈরি।

**Target audience:** ফেসবুক, TikTok, Instagram-এ পণ্য বিক্রি করা বাংলাদেশি ব্যবসায়ী।

**Core problem solved:**
- ম্যানুয়াল অর্ডার ম্যানেজমেন্ট থেকে ডিজিটাল automation
- 30–50% ফেক/অনুপস্থিত অর্ডার সমস্যা
- কুরিয়ার বুকিং-এর অগোছালো workflow
- কাস্টমার হিস্টোরি না থাকা
- হিসাব না থাকা

---

## 2. Architecture Decision

| Layer | Technology |
|---|---|
| Backend | Laravel 13 (existing) |
| Frontend | Next.js 16 (existing) |
| Database | PostgreSQL (existing) |
| Auth | Sanctum token-based (existing) |
| Queue/Events | Laravel Events + Queue for SMS automation |
| Courier APIs | Pathao, Steadfast, RedX (Phase 2) |
| Payment | SSLCommerz / bKash (Phase 3) |
| Facebook | Meta Graph API, CAPI (Phase 3) |

**Reference projects:**
- `zyro/` → Fraud logic, Courier stats, Order validation, CAPI — concept adapted (NOT copy-paste)
- `catv/` → Shell/layout pattern (already adopted via `catv-shell.tsx`)

---

## 3. Frontend Shell Architecture

### Shared components created

| File | Purpose |
|---|---|
| `src/components/user-shell.tsx` | **Master shell** for all user dashboard pages. Handles: auth check, theme, locale, full menu, email verification banner. |
| `src/components/module-placeholder.tsx` | "Coming Soon" placeholder for unimplemented pages. Shows phase badge. |
| `src/components/catv-shell.tsx` | Low-level layout shell (sidebar, topbar, responsive collapse). Do NOT modify menu logic here — use `user-shell.tsx` instead. |

### How to create a new dashboard page

```tsx
"use client";
import { useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="all-orders"        // matches key in user-shell.tsx menu
      defaultExpandedKey="orders"   // parent menu key to expand
      pageTitle={{ bn: "সকল অর্ডার", en: "All Orders" }}
    >
      {/* page content */}
    </UserShell>
  );
}
```

### Menu key reference

| activeKey | defaultExpandedKey | Route |
|---|---|---|
| `dashboard` | — | `/dashboard` |
| `all-orders` | `orders` | `/dashboard/orders` |
| `create-order` | `orders` | `/dashboard/orders/create` |
| `fraud-check` | `orders` | `/dashboard/orders/fraud-check` |
| `blacklist` | `orders` | `/dashboard/orders/blacklist` |
| `product-list` | `products` | `/dashboard/products` |
| `categories` | `products` | `/dashboard/products/categories` |
| `stock` | `products` | `/dashboard/products/stock` |
| `customer-list` | `customers` | `/dashboard/customers` |
| `vip-customers` | `customers` | `/dashboard/customers/vip` |
| `risky-customers` | `customers` | `/dashboard/customers/risky` |
| `facebook-leads` | — (top-level) | `/dashboard/leads` |
| `book-parcel` | `courier` | `/dashboard/courier` |
| `track-orders` | `courier` | `/dashboard/courier/track` |
| `courier-perf` | `courier` | `/dashboard/courier/performance` |
| `sms-send` | `sms` | `/dashboard/sms/send` |
| `sms-history` | `sms` | `/dashboard/sms/history` |
| `sms-automation` | `sms` | `/dashboard/sms/automation` |
| `sales-report` | `analytics` | `/dashboard/analytics/sales` |
| `intelligence` | `analytics` | `/dashboard/analytics/intelligence` |
| `ads-roi` | `analytics` | `/dashboard/analytics/ads-roi` |
| `courier-report` | `analytics` | `/dashboard/analytics/courier` |
| `daily-report` | `accounting` | `/dashboard/accounting` |
| `expenses` | `accounting` | `/dashboard/accounting/expenses` |
| `profit` | `accounting` | `/dashboard/accounting/profit` |
| `shop-profile` | `settings` | `/dashboard/settings/shop` |
| `courier-accounts` | `settings` | `/dashboard/settings/courier` |
| `facebook-connect` | `settings` | `/dashboard/settings/facebook` |
| `subscription` | `settings` | `/dashboard/settings/subscription` |

---

## 4. Module Implementation Plan

### Phase 1 — Core Business Engine (implement first)

#### 4.1 Order Management
**Status:** Shell ready at `/dashboard/orders`

**DB Tables needed:**
- `orders` — main order table
- `order_items` — line items
- `order_status_logs` — audit trail

**Key fields (orders):**
```
id, user_id, order_number, customer_name, customer_phone, customer_address,
customer_district, customer_thana, source (manual/facebook_inbox/landing_page),
status (pending/confirmed/processing/shipped/delivered/cancelled/returned),
payment_method (cod/online/bkash), payment_status (due/partial/paid),
subtotal, shipping_charge, discount, total, notes,
fraud_score (0-100), risk_level (low/medium/high),
courier_id, courier_tracking_id, courier_status,
assigned_to, created_at, updated_at
```

**Laravel API routes to create:**
```
GET    /api/orders
POST   /api/orders
GET    /api/orders/{id}
PUT    /api/orders/{id}
PUT    /api/orders/{id}/status
DELETE /api/orders/{id}
GET    /api/orders/export
POST   /api/orders/bulk-status
GET    /api/orders/stats
```

**Controller:** `app/Http/Controllers/Api/OrderController.php`

---

#### 4.2 Fake Order / Fraud Detection
**Status:** ✅ COMPLETE — FraudController, fraud scoring, blacklist all live

**Fraud score algorithm (adapted from zyro FraudScoreService):**
```
+30  Phone has 3+ orders with >40% return rate
+20  Courier return history > 40% (from courier API)
+15  Repeated cancelled orders
+10  Customer name inconsistency across orders
+5   Phone format irregular
-20  Previous successful delivery (trust signal)

Risk levels:
  0–30  → low (green)
  31–60 → medium (yellow)
  61+   → high (red)
```

**DB Tables:**
- `customer_fraud_profiles` — computed fraud data per phone
- `customer_blacklist` — manually blocked phones

**API routes:**
```
POST /api/fraud/check-phone
POST /api/fraud/bulk-check
GET  /api/fraud/blacklist
POST /api/fraud/blacklist
DELETE /api/fraud/blacklist/{id}
```

**Controller:** `app/Http/Controllers/Api/FraudController.php`

---

#### 4.3 Product Management
**Status:** Shell ready at `/dashboard/products`

**DB Table (products):**
```
id, user_id, name, sku, category_id, selling_price, cost_price,
stock, track_stock (bool), images (jsonb), variants (jsonb), status
```

**API routes:**
```
GET    /api/products
POST   /api/products
GET    /api/products/{id}
PUT    /api/products/{id}
DELETE /api/products/{id}
GET    /api/categories
POST   /api/categories
```

---

#### 4.4 Customer CRM
**Status:** Shell ready at `/dashboard/customers`

**DB Tables:**
- `customers` — auto-populated from orders (upsert on phone)
- `customer_contact_logs` — call notes, follow-up

**Auto-tagging logic:**
```
3+ successful deliveries → "loyal"
Total spend top 20% → "vip"
fraud_score > 50 → "risky"
manually blocked → "blocked"
```

---

### Phase 2 — Automation & Courier (implement second)

#### 4.5 Courier Integration
**Couriers to support:** Pathao, Steadfast, RedX

**DB Tables:**
- `courier_accounts` — per-user API credentials
- `courier_bookings` — booking records + tracking sync

**Courier API wrappers (Laravel Services):**
```
app/Services/Courier/PathaoCourierService.php
app/Services/Courier/SteadfastCourierService.php
app/Services/Courier/RedxCourierService.php
app/Services/Courier/CourierFactory.php   ← dispatch to right service
```

---

#### 4.6 SMS Automation
**Extends existing:** `/api/sms/send` gateway already works.

**New DB Tables:**
- `sms_automation_rules` — trigger_event, template_id, delay_minutes
- `sms_automation_logs` — audit trail

**Trigger events:**
```
order_confirmed, order_shipped, order_delivered,
order_cancelled, payment_due, failed_delivery_retry
```

**Laravel Event flow:**
```
Order status change → OrderStatusChanged event →
  SmsAutomationListener → match rules →
  dispatch(SendAutomationSmsJob::class)->delay($minutes)
```

**Template variables:**
```
{customer_name}, {order_number}, {total}, {courier},
{tracking_id}, {shop_name}, {delivery_date}
```

---

#### 4.7 Accounting
**Auto-populated from orders:**
- Order created (COD) → income entry (pending)
- Order delivered → income confirmed
- Courier charge → expense entry

**Manual entries:** ad spend, product cost, other expenses

**DB Table (transactions):**
```
id, user_id, type (income/expense), category,
reference_type, reference_id, amount, note, transaction_date
```

---

### Phase 3 — Intelligence & Growth (implement third)

#### 4.8 Customer Intelligence Dashboard
- Computed from existing orders + fraud data
- District-wise heatmap (order count by district)
- VIP/loyal/risky customer auto-classification

#### 4.9 Facebook Ads ROI Tracker
- UTM parameter capture on order create
- Facebook CAPI Purchase event (zyro CAPI pattern adapted)
- Campaign → Order → Revenue mapping

**Reference:** `zyro/controllers/FacebookCapiController.php`

#### 4.10 Facebook Comment / Inbox Bot
- Meta Graph API webhooks
- Keyword detection → auto-reply or inbox message
- Lead capture → customers table

#### 4.11 Subscription & Payment
- SSLCommerz / bKash integration
- Plan-based feature gating

---

## 5. Data Scoping Rules (mandatory per CONTEXT.md §25)

All new controllers must answer: **"Shared across admins or per-user isolated?"**

| Resource | Scoping Rule |
|---|---|
| Orders | Per-user (`where('user_id', auth()->id())`) — each seller owns their orders |
| Products | Per-user |
| Customers | Per-user |
| Courier accounts | Per-user |
| Fraud profiles | Per-user (each seller builds their own history) |
| Blacklist | Per-user |
| SMS automation rules | Per-user |
| Transactions | Per-user |

**Note:** Admin-shared resources (notification templates, email configs, SMS gateways) already use `adminScopeUserIds()` per CONTEXT.md §25. New seller-facing resources are per-user by design.

---

## 6. Backend Controller Checklist (for each new module)

When creating a new controller:

1. Place in `app/Http/Controllers/Api/`
2. Register route under `auth:sanctum` middleware (NOT `is_admin` — these are user routes)
3. All queries scoped with `->where('user_id', auth()->id())`
4. Standard response format: `{ success: true, data: [...], meta: { total, page } }`
5. Validation in `app/Http/Requests/` (Form Requests)
6. Run `php artisan route:list` to verify middleware

---

## 7. Frontend Implementation Checklist (for each module)

When implementing a module page:

1. Replace `ModulePlaceholder` with real UI
2. Use `UserShell` wrapper (keep `activeKey` + `defaultExpandedKey`)
3. Follow design system: `var(--background)`, `var(--surface)`, `var(--accent)`, `var(--border)`, `var(--muted)`
4. Mobile-first — test at 375px, 768px, 1280px
5. Bilingual — all text must have `bn` and `en` versions
6. Dark/light theme compatible
7. Run `npm run build` after changes
8. Restart: `supervisorctl restart hybrid-stack-frontend`

---

## 8. Order Status Flow

```
[manual/facebook/landing_page]
         ↓
      pending
         ↓
    confirmed   ← SMS automation trigger: order_confirmed
         ↓
    processing
         ↓
      shipped   ← Courier booked, tracking ID saved → SMS: order_shipped
         ↓
    delivered   ← Courier confirms → SMS: order_delivered → income confirmed
         ↓ (alternate)
    cancelled   ← SMS: order_cancelled
    returned    ← Return rate counter updated on fraud_profile
```

---

## 9. Fraud Score Integration with Order Create

When a new order is created:
1. Auto-call fraud check on `customer_phone`
2. Look up `customer_fraud_profiles` for existing history
3. If courier accounts configured → call courier API for delivery history
4. Compute score → save `fraud_score` + `risk_level` on order
5. If `risk_level = high` → show warning on order detail, do NOT auto-confirm

---

## 10. SMS Existing vs. New Routes

| Route | Status | Notes |
|---|---|---|
| `GET /api/sms/gateways` | ✅ Existing | Lists assigned gateways |
| `POST /api/sms/send` | ✅ Existing | Manual SMS send |
| `GET /api/sms/history` | ✅ Existing | SMS send history |
| `GET /api/sms/automation/rules` | 🔲 New (Phase 2) | List rules |
| `POST /api/sms/automation/rules` | 🔲 New (Phase 2) | Create rule |
| `PUT /api/sms/automation/rules/{id}` | 🔲 New (Phase 2) | Update/toggle rule |
| `DELETE /api/sms/automation/rules/{id}` | 🔲 New (Phase 2) | Delete rule |

---

## 11. File Structure Reference

```
frontend/src/
  app/dashboard/
    page.tsx                    ← Home (stat cards + shortcuts)
    orders/
      page.tsx                  ← All Orders list
      create/page.tsx           ← Create Order form
      fraud-check/page.tsx      ← Phone fraud checker
      blacklist/page.tsx        ← Blacklisted phones
      [id]/page.tsx             ← Order detail + timeline
    products/
      page.tsx                  ← Product list
      categories/page.tsx       ← Category management
      stock/page.tsx            ← Stock levels
    customers/
      page.tsx                  ← Customer list
      vip/page.tsx              ← VIP customers
      risky/page.tsx            ← Risky/blocked
      [id]/page.tsx             ← Customer profile
    courier/
      page.tsx                  ← Book parcel
      track/page.tsx            ← Track orders
      performance/page.tsx      ← Courier performance
    sms/
      send/page.tsx             ← ✅ Existing (manual SMS)
      history/page.tsx          ← ✅ Existing (SMS history)
      automation/page.tsx       ← SMS automation rules
    analytics/
      sales/page.tsx            ← Sales report
      intelligence/page.tsx     ← Customer intelligence
      ads-roi/page.tsx          ← Ads ROI tracker
      courier/page.tsx          ← Courier analytics
    accounting/
      page.tsx                  ← Daily report
      expenses/page.tsx         ← Expense tracker
      profit/page.tsx           ← Profit dashboard
    settings/
      shop/page.tsx             ← Shop profile
      courier/page.tsx          ← Courier API accounts
      subscription/page.tsx     ← Subscription plan

  components/
    user-shell.tsx              ← Master shell for all user pages
    module-placeholder.tsx      ← "Coming Soon" placeholder
    catv-shell.tsx              ← Low-level layout (do not add menu logic here)
    email-verification-banner.tsx

backend/app/
  Http/Controllers/Api/
    OrderController.php         ← (to create — Phase 1)
    OrderItemController.php     ← (to create — Phase 1)
    ProductController.php       ← (to create — Phase 1)
    CategoryController.php      ← (to create — Phase 1)
    CustomerController.php      ← (to create — Phase 1)
    FraudController.php         ← (to create — Phase 1)
    CourierController.php       ← (to create — Phase 2)
    SmsAutomationController.php ← (to create — Phase 2)
    TransactionController.php   ← (to create — Phase 2)
    [existing controllers...]
```

---

## 12. Phase 1 — Current Progress

### ✅ সম্পন্ন (Completed)

| Module | Backend | Frontend | Commit |
|---|---|---|---|
| Product Management | ✅ ProductController, CategoryController | ✅ /products, /products/categories, /products/stock | `7a16e3c` |
| Order Management | ✅ OrderController (CRUD, status, bulk, stats) | ✅ /orders, /orders/create, /orders/[id] | `7a16e3c` → `0020557` |
| Customer CRM | ✅ CustomerController (6 routes, syncFromOrder) | ✅ /customers, /customers/[id], /customers/vip, /customers/risky | `669d310` |
| Courier Integration | ✅ CourierController, SteadfastService, courier_settings migration | ✅ /courier, /courier/track, /settings/courier | `b69eebc` |
| Fraud Check + Blacklist | ✅ FraudController (5 routes), customer_fraud_profiles + customer_blacklist tables | ✅ /orders/fraud-check, /orders/blacklist | current |
| Dashboard Home | — | ✅ /dashboard — live stat cards + recent orders + shortcuts | current |

---

### ✅ Phase 1 সম্পূর্ণ MVP:
- ✅ পণ্য যোগ করা যাবে
- ✅ অর্ডার নেওয়া যাবে (manual + create wizard)
- ✅ কাস্টমার অটো-ট্র্যাক হবে
- ✅ Steadfast কুরিয়ার বুক করা যাবে
- ✅ ফেক অর্ডার ধরা যাবে (Fraud Check + Blacklist)
- ✅ ড্যাশবোর্ড হোম (live stats overview)

---

### পরবর্তী কাজ — Phase 2
1. **SMS Automation** — template engine, scheduled sends, event triggers
2. **Accounting** — expense tracking, daily P&L, invoice generation
3. **Analytics** — sales funnel, product performance, customer cohorts

---

## 13. বর্তমান কাজের চেকলিস্ট (Live)

### Courier Stability / Steadfast Booking
- [x] Steadfast API docs re-verify (headers, payload, endpoints)
- [x] `create_order` payload-এ optional fields support add (`alternative_phone`, `recipient_email`, `item_description`, `total_lot`, `delivery_type`)
- [x] Steadfast response parser harden (non-JSON fallback + clearer error message)
- [x] Address ও phone normalization শক্ত করা
- [x] Tracking status lookup fallback (`consignment_id` vs `tracking_code`)
- [x] Backend syntax/diagnostic check run (no new PHP errors)
- [ ] Production booking smoke test from `/dashboard/courier` (single + bulk)
- [ ] Hotfix commit/tag + deploy note update

### Frontend Production Stability (2026-05-04)
- [x] Incident reproduced: `/dashboard` UI unstyled + `/dashboard/accounting/expenses` load failure
- [x] Root cause fixed: `frontend/.next` ownership/permissions mismatch (`www-data`) causing `_next/static/*.css` 500
- [x] Recovery actions: `chown -R www-data:www-data frontend/.next` + supervisor frontend restart
- [x] Validation: dashboard/accounting routes and current CSS/JS chunks serving `200`

### Phase 2 Readiness
- [x] SMS Automation DB schema + API শুরু
- [x] Accounting transactions module scaffold
- [ ] Analytics data aggregation plan finalize

---

## 14. Phase 2 Execution Board (Checkbox-Ready)

> **Goal:** Automation + Courier + Accounting + Analytics module production-ready করা।

### 14.1 Courier Integration Hardening (Pathao + Steadfast + RedX)
- [ ] `courier_accounts` schema finalize (সব provider credential + validation)
- [ ] `courier_bookings` table create (payload, response, status, cost, error লগ)
- [ ] Common provider contract define: `create()`, `track()`, `cancel()`, `price()`
- [ ] `PathaoCourierService` retry + token refresh flow harden
- [ ] `Steadfast` booking/status sync job + error normalization
- [ ] `RedxCourierService` minimum viable integration (booking + tracking)
- [ ] `CourierFactory` dispatch + fallback logic complete
- [ ] Bulk booking unified API (partial success response structure)
- [ ] Status sync scheduler/webhook pipeline implement
- [ ] Courier performance metrics API finalize (success/return/avg delivery time)

### 14.2 SMS Automation
- [x] Migration: `sms_automation_rules`
- [x] Migration: `sms_automation_logs`
- [x] API: `GET /api/sms/automation/rules`
- [x] API: `POST /api/sms/automation/rules`
- [x] API: `PUT /api/sms/automation/rules/{id}`
- [x] API: `DELETE /api/sms/automation/rules/{id}`
- [x] Template variable parser implement (`{customer_name}`, `{order_number}`, `{tracking_id}`)
- [ ] Event: `OrderStatusChanged`
- [ ] Listener: `SmsAutomationListener`
- [x] Job: `SendAutomationSmsJob` with delay support
- [x] Duplicate send guard (idempotency key)
- [ ] Retry + failure reason log pipeline
- [x] Frontend UI: `/dashboard/sms/automation` rule builder

### 14.3 Accounting
- [x] Migration: `transactions`
- [x] Auto-ledger rules: order created (pending income)
- [x] Auto-ledger rules: order delivered (confirmed income)
- [x] Auto-ledger rules: courier charge (expense)
- [x] Manual expense CRUD API
- [x] API: `GET /api/accounting/summary`
- [x] API: `GET /api/accounting/transactions`
- [x] API: `POST /api/accounting/transactions`
- [x] API: `PUT /api/accounting/transactions/{id}`
- [x] API: `DELETE /api/accounting/transactions/{id}`
- [x] Frontend: `/dashboard/accounting`
- [x] Frontend: `/dashboard/accounting/expenses`
- [x] Frontend: `/dashboard/accounting/profit`

### 14.4 Analytics
- [ ] Sales funnel API (pending → confirmed → shipped → delivered)
- [ ] Product performance API (top SKU, margin, return ratio)
- [ ] Customer cohort API (repeat buyer, AOV, LTV-lite)
- [ ] Courier analytics API (provider-wise delivery/return)
- [ ] Frontend: `/dashboard/analytics/sales`
- [ ] Frontend: `/dashboard/analytics/intelligence`
- [ ] Frontend: `/dashboard/analytics/courier`
- [ ] Date range + export (CSV)

### 14.5 Phase 2 Quality Gate
- [ ] সব controller-এ per-user scoping validate (`where('user_id', auth()->id())`)
- [ ] Form Request validation coverage complete
- [ ] Queue worker + scheduler production config verify
- [ ] Error monitoring + audit log checklist finalize
- [ ] Build + smoke test report prepared
- [ ] Release note + rollback plan documented

### 14.6 Suggested Implementation Order
1. [ ] SMS Automation
2. [x] Accounting
3. [ ] Analytics
4. [ ] Courier hardening + RedX completion (parallel track)

---

## 15. প্রকৃত কোডবেস অবস্থা — Feature Audit (স্ক্যান করা: 2026-08-02)

এই section সরাসরি কোডবেস স্ক্যান (controllers, routes/api.php, migrations, frontend page tree) করে বানানো — অনুমান নয়। ভবিষ্যতের যেকোনো AI agent/engineer নতুন কাজ শুরুর আগে এই section থেকে module-এর real status verify করবে, উপরের §12–§14 (2026-05-04-এর প্ল্যান, stale) থেকে না।

**Status legend:**
- ✅ **DONE** — backend + frontend দুটোই আছে, production route wired
- 🟡 **PARTIAL** — কাজ করে কিন্তু গুরুত্বপূর্ণ অংশ বাকি/manual workaround
- 🔧 **NEEDS HARDENING** — functionally আছে কিন্তু quality/reliability/UX gap আছে বলে চিহ্নিত
- ⛔ **NOT STARTED** — কোনো backend controller/route নেই, বা শুধু placeholder UI

### 15.1 Core Commerce

| Module | Status | কোথায় (ground truth) | নোট |
|---|---|---|---|
| Auth & Onboarding | ✅ DONE | `AuthController`, `OtpController`, `EmailOtpController`, `PasswordResetController` | Register/login, mobile+email OTP verification, password reset flow — সবই live |
| Order Management | ✅ DONE | `OrderController.php` (CRUD, stats, bulk-status, create-bootstrap), `OrderStatusService.php` | Status change একটা centralized service দিয়ে হয় যেটা SMS automation + accounting + fraud check তিনটাই trigger করে — এটা §14.2-এর "Event/Listener" আইটেমের কার্যকর বিকল্প (আলাদা Laravel Event/Listener লেখা হয়নি, কিন্তু একই কাজ হচ্ছে) |
| Product Management | ✅ DONE (originally-planned scope ছাড়িয়ে গেছে) | `ProductController`, `ProductCategoryController`, `ProductMediaController`, `ProductVariantController` (21.6KB) | পূর্ণ **variant/SKU system** আছে (options, values, variant combinations, bulk update, auto-generate) — এটা original module plan-এ ছিলই না, বড় undocumented addition। Frontend: `variant-picker-modal.tsx`, `variant-table.tsx`, `variants-tab.tsx` |
| Customer CRM | ✅ DONE | `CustomerController.php` | lookup-by-phone, stats, sync-all, toggle-block, VIP/risky auto-tag pages সব লাইভ |
| Order source = "facebook_inbox" | 🟡 লেবেল-only | `StoreOrderRequest.php:26`, `order-intake-form.tsx` | এটা শুধু একটা dropdown ট্যাগ ("এই অর্ডার কোথা থেকে এসেছে" রেকর্ড করার জন্য) — কোনো Facebook API/webhook connectivity নেই। §15.4-এ "Facebook/Meta integration ⛔" এন্ট্রির সাথে গুলিয়ে ফেলা যাবে না |

### 15.2 Fraud & Risk

| Module | Status | কোথায় | নোট |
|---|---|---|---|
| Internal Fraud Check + Blacklist | ✅ DONE | `FraudController.php` (5 routes), `customer_fraud_profiles` + `customer_blacklist` tables | Phone-history ভিত্তিক scoring, manual blacklist |
| Courier-based Fraud/Delivery-history Check | ✅ DONE — **undocumented বড় addition** | `CourierFraudCheckController.php` + `CourierFraudCheckService` + provider-specific services: `SteadfastFraudCheckService`, `PathaoFraudCheckService`, `RedxFraudCheckService`, `CarrybeeFraudCheckService`, `PaperflyFraudCheckService`, `courier_fraud_stats` table | কোনো ফোন নাম্বার একাধিক courier-এর delivery/return history-তে চেক করে (cross-courier), ফলাফল shared cache-এ (§ CONTEXT.md commit `25a0095` "share courier fraud-check cache across all sellers")। এই পুরো module মূল `SAAS_MODULE_CONTEXT.md`-এ কখনো ডকুমেন্ট হয়নি |

### 15.3 Courier Integration

| Provider | Status | নোট |
|---|---|---|
| Steadfast | ✅ DONE | Booking, status (consignment/invoice/tracking), balance, return-requests CRUD, payments, police-stations — সবচেয়ে সম্পূর্ণ |
| Pathao | ✅ DONE (§14.1-এ "not started" লেখা ছিল, এখন stale) | stores CRUD, price calc, location hierarchy (cities/zones/areas), OAuth token flow (`courier_settings`-এ token fields) |
| RedX | ✅ DONE (§14.1-এ "MVP only" লেখা ছিল, এখন stale) | areas, pickup-stores CRUD, charge calc |
| Carrybee | ✅ DONE — **§14.1-এ উল্লেখই ছিল না, সম্পূর্ণ নতুন 4th provider** | cities/zones/areas hierarchy, area-suggestion, stores CRUD — commit `26dc6f6` "full CarryBee booking integration" |
| Bulk booking | ✅ DONE | `POST /courier/book/bulk` route আছে |
| Common provider contract / `CourierFactory` abstraction | ✅ DONE (2026-08-02, commit `0fdc3ab`) | `app/Services/Courier/CourierProviderInterface.php` + `CourierFactory` + `AbstractCourierProvider` + 4 provider classes (Steadfast/Pathao/RedX/Carrybee); `CourierController::book/bookBulk/trackOrder` dispatch through `CourierFactory::make()` — controller cut 1138→692 lines. RedX now in frontend bulk-booking selector. Carrybee still excluded from bulk (needs per-order area-search UI, documented in code) and its `cancel()` method still has no route wired to it (dead capability persists) |
| 🔧 Status sync scheduler/webhook | NEEDS VERIFICATION | Manual tracking lookup route আছে (`GET /courier/track/{order}`), কিন্তু automatic webhook/cron-based status sync হচ্ছে কিনা কোডে স্পষ্ট না — verify করা দরকার |

### 15.4 Landing Page, Checkout, Recovery — (বিস্তারিত: `landing_page_context.md`)

| Module | Status | নোট |
|---|---|---|
| Landing Page Builder (bn/en bilingual) | ✅ DONE | পূর্ণ page builder, editor drafts/versions, elements — আলাদা deep-reference ফাইল আছে |
| Landing Page Templates (seller→template conversion) | ✅ DONE | commit `8ff57c1` — পুরনো CartFlows/Elementor importer বাদ দিয়ে নতুন pattern |
| Landing Page Analytics | ✅ DONE | visits, by-country, by-referrer, link-visit-to-order — `LandingPageAnalyticsService` |
| Media Library | ✅ DONE | `LandingMediaLibraryController` |
| Checkout OTP verification | ✅ DONE | `CheckoutOtpController/Service` — public checkout phone verify |
| **Abandoned Checkout Recovery** | ✅ DONE — **সম্পূর্ণ নতুন module, original plan-এ ছিলই না** | `AbandonedCheckoutController/Service`, resume flow, stats + CSV export, frontend `/dashboard/abandoned-checkouts` |
| Admin moderation (lock/unlock/publish) | ✅ DONE | commit `8d78ab2` |

### 15.5 Communication (SMS / Email / Notification)

| Module | Status | নোট |
|---|---|---|
| Manual SMS send + gateway assignment | ✅ DONE | multi-gateway, admin-scoped |
| SMS Credit system | ✅ DONE | admin recharge, per-user balance, history |
| SMS Automation rules + trigger | ✅ DONE | Order status change → `OrderStatusService` → `SmsAutomationService` → `SendAutomationSmsJob` (delay + idempotency guard) |
| Generic Notification Template + Dispatch system (admin-shared) | ✅ DONE — **§SAAS_MODULE_CONTEXT.md-এ কখনো documented হয়নি** | `NotificationTemplateController`, `NotificationUseCaseBindingController`, `NotificationDispatchController/Service`, `DispatchNotificationJob`, `EmailConfigurationController` — SMS+Email দুটো channel-ই cover করে, `adminScopeUserIds()` pattern (CONTEXT.md §25) মেনে চলে |
| 🔧 Retry + failure-reason log pipeline | NEEDS HARDENING | §14.2-তে unchecked ছিল, এখনো নিশ্চিত না যে failed SMS auto-retry হয় |

### 15.6 Accounting

| Module | Status | নোট |
|---|---|---|
| Auto-ledger (order created/delivered, courier charge) | ✅ DONE | |
| Manual transaction CRUD | ✅ DONE | |
| Summary / Expenses / Profit pages | ✅ DONE | |

### 15.7 Analytics (seller-facing)

| Module | Status | নোট |
|---|---|---|
| Sales funnel + top products (`analytics/sales`) | ✅ DONE (2026-08-02) | `Api/AnalyticsController::sales()` + `::products()` — funnel by status, daily trend, top products with revenue/margin/return-rate. Frontend replaces placeholder with stat cards, funnel grid, CSS bar-chart trend, product table |
| Customer intelligence (`analytics/intelligence`) | ✅ DONE (2026-08-02) | `AnalyticsController::customers()` — loyal/VIP/risky/blocked counts, repeat-buyer rate, avg LTV, district-wise order breakdown |
| Courier analytics (`analytics/courier`) | ✅ DONE (2026-08-02) | `AnalyticsController::courier()` — per-courier success/return rate, avg delivery time (from `order_status_logs`), charges, delivered revenue |
| Ads ROI (`analytics/ads-roi`) | ⛔ still placeholder — **intentional** | No UTM/ad-spend/Facebook data source exists yet (§16.3 Facebook MVP is the prerequisite); building this now would show fake numbers |

**Backend:** `app/Http/Controllers/Api/AnalyticsController.php`, routes under `auth:sanctum` at `/api/analytics/{sales,products,customers,courier}`, all scoped `where('user_id', auth()->id())`, date-range filterable (`range=today\|week\|month`, or `from`/`to`). No new migrations — built entirely on existing `orders`, `order_items`, `customers`, `order_status_logs` tables.

**Verification:** rollback-wrapped tinker test against real production data (all 4 endpoints, correct joins/margins/rates) + live HTTP smoke test through nginx/php-fpm/Sanctum + `npm run build` clean + browser-verified rendering (styled, real data, both light theme).

**Incident during this rollout (self-caused, fixed same session):** running `npm run build` while `hybrid-frontend.service` (`next start`) was still live overwrote `.next` under the running process, breaking all CSS/JS chunk hashes — same failure mode as the 2026-05-04 incident logged below. Fixed by restarting the service after build (the step 8 checklist in §7 exists precisely for this — don't skip it after `npm run build` on a live server).

### 15.8 Subscription & Billing

| Module | Status | নোট |
|---|---|---|
| Subscription packages, plan display | ✅ DONE | `SubscriptionController::plans/mySubscription` |
| Manual bKash payment submission + admin approve/reject | ✅ DONE | `submitPayment` (sender number + trx ID) → `AdminSubscriptionController::approvePayment/rejectPayment` |
| `active_subscription` middleware gating | ✅ DONE | Landing-page ও অন্যান্য premium route এই middleware-এ gated |
| **Automated payment gateway — subscription billing (bKash auto-verify)** | ✅ DONE — **live in production** (2026-08-09) | `BkashPaymentController` (Tokenized) + `BkashPgwPaymentController` (classic PGW, actually in use — real merchant credential is a PGW account, §18.2) — seller pays instantly via bKash, no manual TrxID review. পুরনো manual flow (trx ID submit + admin approve) fallback হিসেবে অক্ষত আছে |
| **Customer-order-এর জন্য অনলাইন পেমেন্ট কালেকশন** | ⛔ NOT STARTED | `payment_method: bkash/online` অর্ডারে শুধু একটা label — বাস্তবে কোনো gateway charge/callback হয় না, effectively সব COD |

### 15.9a SaaS Support Chat (seller ↔ admin) — ✅ DONE (2026-08-07)

Floating "Support" chat button on every seller dashboard page (bottom-right, rendered from `UserShell` so it's automatic on all `/dashboard/*` routes) → one persistent thread per seller, shared admin-team inbox at `/admin/support` (any admin can view/reply — no per-admin scoping, matches the flat `user`/`admin` role model, CONTEXT.md §25 "admin-shared resource" pattern).

**No queue worker in this deployment (§17.0 #12) → delivery is plain sync DB writes + frontend polling, no jobs/broadcast.** Seller widget polls `/support/unread-count` every 20s when closed, `/support/messages?after_id=` every 4s when the panel is open. Admin inbox polls the conversation list every 15s and the open thread every 4s the same way.

- **Backend:** `support_conversations` (`unique(user_id)` — one thread per seller, `status open/closed`, unread counters both directions, `last_message_*` preview cache) + `support_messages` (`sender_type user/admin`). `Api\SupportController` (seller: `GET conversation`, `GET/POST messages`, `POST read`, `GET unread-count`) and `Api\Admin\AdminSupportController` (admin: `GET conversations`, `GET/POST conversations/{id}/messages`, `POST conversations/{id}/read`, `PUT conversations/{id}/status`, `GET unread-count`). Seller routes sit in the `auth:sanctum` group *outside* `active_subscription` — an expired-subscription seller can still reach support.
- **Frontend:** `components/support-chat-widget.tsx` (mounted once inside `UserShell`, gated to `role === "user"` only — admins get their own inbox, not the seller widget), `app/admin/support/page.tsx` (list + chat two-pane, `CatvShell`/`buildAdminMenu` pattern like `courier-cache`). Bilingual bn/en, design-token colors, mobile-first (list/chat panes stack on small screens).
- **Verification:** rollback-wrapped tinker test (unread-count increment/reset both directions, unique-constraint dedupe) + live HTTP round-trip through nginx/Sanctum on `bsol.zyrotechbd.com` (seller send → admin sees unread+preview → admin reply → seller unread-count flips → mark-read clears it → close/reopen) + `npm run deploy:prod:safe` 8/8 pass.

### 15.9 Admin Panel

| Module | Status | নোট |
|---|---|---|
| User management, Package management, Registration defaults | ✅ DONE | |
| Billing settings + payment approval queue | ✅ DONE | |
| SMS gateway + credit admin | ✅ DONE | |
| Email configuration admin | ✅ DONE | |
| Notification template + use-case binding | ✅ DONE | |
| Landing template authoring + Landing page moderation | ✅ DONE | |
| Platform branding + product-media settings | ✅ DONE | |

### 15.10 সম্পূর্ণ অনুপস্থিত মডিউল (কোডবেসে কোনো trace নেই — grep-verified)

| মডিউল | ভেরিফিকেশন মেথড | ফলাফল |
|---|---|---|
| ~~Facebook Graph API / Comment-Inbox bot / Messenger CRM~~ WhatsApp | — | WhatsApp এখনো সম্পূর্ণ অনুপস্থিত। Facebook/Messenger lead capture এখন §15.4-বহির্ভূত নতুন §15.11-এ move করা হলো — নিচে দেখুন |
| Automated payment gateway — Nagad/SSLCommerz | `grep -rli sslcommerz\|nagad` | কোনো trace নেই। bKash-এর জন্য এখন real API integration আছে (subscription billing-এ live, §18/§18.2) — এই row-টা এখন শুধু Nagad/SSLCommerz-এর জন্য প্রযোজ্য, bKash আর এখানে গণনা হবে না |
| Staff/Team/sub-account roles | `grep -rli staff\|team_member` + users migration পড়া | `users.role` শুধু `user`/`admin` — কোনো per-shop multi-staff concept নেই |
| Shop Profile Settings | `/dashboard/settings/shop/page.tsx` | Pure `ModulePlaceholder`, কোনো backend controller নেই |
| Invoice / Waybill PDF generation | `composer.json`-এ dompdf/barryvdh নেই, controller grep-এ কিছু নেই | কোনো PDF export নেই — courier booking-এর পর প্রিন্টেবল label/invoice ফিচার অনুপস্থিত |
| Bulk/CSV order import | `OrderController.php`-এ import/csv grep শূন্য | শুধু abandoned-checkout-এর export আছে, order-এর দিকে bulk import নেই |
| PWA / mobile app manifest | `frontend/public/manifest*`, `sw.js` কিছুই নেই | Dashboard শুধু responsive web, installable PWA না |
| WhatsApp integration | `grep -rli whatsapp` | কোনো trace নেই — এখনো সম্পূর্ণ অনুপস্থিত |

### 15.11 Facebook/Meta Lead Capture — 🟡 PARTIAL (built 2026-08-02 — কোড লাইভ, Meta App configure করা হয়েছে, seller OAuth connect flow-এ একটা open issue এখনো আছে)

**বিস্তারিত reference: [`facebook_integration_context.md`](facebook_integration_context.md)** — architecture diagram, প্রতিটা backend/frontend ফাইলের সম্পূর্ণ ম্যাপ, Meta App setup log (App ID, permissions, webhook config, App Domains/Redirect URI gotcha), known issue, এবং resume/debug করার জন্য quick-orientation — সব ওখানে। এই section শুধু summary।

§16.3-এর MVP scope (per-seller Page comment + Messenger inbox lead capture → `customers` auto-save যখন ফোন নাম্বার message-এ পাওয়া যায়, নাহলে seller review-এর জন্য lead হিসেবে থাকে) পুরোপুরি কোড করা হয়েছে এবং backend+frontend দুটোই deploy হয়েছে। Meta for Developers App-ও তৈরি + configure করা হয়েছে (App ID `1900768904642203`, webhook ✅ verified) — কিন্তু seller-side "Connect Facebook Page" flow-এ একটা "Can't load URL" error এখনো debug চলছে (App Domains + Valid OAuth Redirect URI দুটোই সঠিকভাবে সেভ করা সত্ত্বেও, সম্ভবত Meta-র propagation delay) — বিস্তারিত `facebook_integration_context.md` §3-এ।

**Backend (সব লাইভ, migrated):**
- `facebook_page_connections` + `facebook_leads` টেবিল (per-user, `page_access_token`/`fb_user_access_token` `encrypted` cast)
- `app/Services/Facebook/FacebookGraphClient.php` — OAuth code↔token exchange, long-lived token exchange, page listing, webhook subscribe/unsubscribe, `X-Hub-Signature-256` HMAC verification
- `app/Services/Facebook/FacebookLeadCaptureService.php` — webhook payload → `FacebookLead` (dedupe key `(channel, fb_event_id)`), BD-phone regex-detect থেকে `Customer` auto-link
- `FacebookConnectController` (per-seller OAuth connect/callback/page-picker/disconnect — signed `state` param, কারণ Meta-র redirect callback browser-এর full-page navigation, Sanctum bearer token বহন করে না), `FacebookWebhookController` (public, GET verify handshake + POST receive), `FacebookLeadController` (list/read/ignore/convert-to-customer)
- Webhook processing **synchronous**, queue job না — কারণ deploy করার সময় ধরা পড়েছে এই deployment-এ **কোনো queue worker consumer নেই** (নিচে §17-এ নতুন critical finding হিসেবে যোগ করা হলো, এটা `SendAutomationSmsJob`-কেও প্রভাবিত করে)
- `platform_facebook_settings` টেবিল (singleton row) + `PlatformFacebookSetting` মডেল — App ID/Secret/Webhook-verify-token DB-তে (encrypted cast) admin UI দিয়ে সেট করা যায়, `.env`-এর `FACEBOOK_*` শুধু fallback (DB খালি থাকলে ব্যবহৃত হয়)। `Api\Admin\PlatformFacebookSettingsController` (`GET/PUT /api/admin/settings/facebook`, `is_admin` gated) — secret কখনো plaintext ফেরত পাঠায় না, শুধু `{app_id, app_secret_set, webhook_verify_token_set}`
- Verification: rollback-wrapped tinker test (dedupe on redelivery, phone auto-link, signature accept/reject, DB-config resolver + masked() hides secret) + live route/webhook smoke test (`curl` — 403 on bad signature/token, 401 on anonymous connect/admin endpoints) সব pass

**Frontend (লাইভ, deploy করা হয়েছে):** `/dashboard/settings/facebook` (seller: connect/disconnect + multi-page picker), `/dashboard/leads` (seller: inbox, channel/status filter, convert-to-customer form), `/admin/settings/facebook` (super-admin: App ID/Secret/Webhook-token ফর্ম + webhook URL copy + setup checklist) — `user-shell.tsx` ও `admin-menu.ts` দুটোতেই মেনু যোগ করা হয়েছে

**Go-live-এর আগে যা বাকি (external, কোড নয়) — বিস্তারিত `facebook_integration_context.md` §3:**
1. ~~Meta App তৈরি + configure করা~~ — ✅ DONE (App ID `1900768904642203`, webhook verified)
2. Seller OAuth connect flow-এর "Can't load URL" issue resolve/confirm করা (propagation delay সন্দেহ করা হচ্ছে, নিশ্চিত না)
3. App Review-এর জন্য বাকি ৩টা field পূরণ করা: App icon (1024×1024), Privacy Policy URL, Category
4. `pages_messaging` + `pages_manage_engagement` scope-এর জন্য App Review পাস করা (admin/tester অ্যাকাউন্ট দিয়ে আগে টেস্ট করা যাবে, review ছাড়া বাকি সব seller-এর জন্য কাজ করবে না)

---

## 16. সুপারিশকৃত নতুন ফিচার ও উন্নয়ন (Prioritized Recommendations, 2026-08-02)

§15-এর audit অনুযায়ী priority order — প্রতিটার সাথে "কেন" এবং "কোথায় শুরু করতে হবে" যোগ করা হলো যাতে ভবিষ্যতের agent সরাসরি কাজ শুরু করতে পারে।

### 16.1 Analytics module শেষ করা (সর্বোচ্চ priority)
- **কেন:** §14.4-এ ৩ মাস আগেই planned, এখনো ০% অগ্রগতি; ডেটা ইতিমধ্যে আছে (`orders`, `transactions`, `courier_fraud_stats`) — নতুন backend controller লিখলেই কাজ শুরু করা যায়, কম effort/high value
- **কোথায় শুরু:** নতুন `Api/AnalyticsController.php` — sales funnel query (`orders` টেবিল থেকে `status` group-by), product performance (`order_items` join `products`), courier-wise delivery/return rate (`courier_fraud_stats` + `orders.courier_status`)
- **Frontend:** ৪টা existing placeholder page (`analytics/sales`, `/courier`, `/intelligence`, `/ads-roi`) replace করা

### 16.2 Courier provider abstraction hardening — ✅ DONE (2026-08-02, commit `0fdc3ab`)
- `app/Services/Courier/` — `CourierProviderInterface` (`book/bookBulk/track/cancel`), `CourierFactory::make()`, `AbstractCourierProvider` (shared `bookBulk` default + `cancel` no-op fallback), 4 concrete providers
- `CourierController.php` 1138 → 692 lines; `book()`/`bookBulk()`/`trackOrder()` dispatch through the factory
- Remaining follow-ups (not part of this refactor, still open): Carrybee bulk-booking + `cancel()` route wiring (§17.3), RedX/Carrybee test-connection endpoints

### 16.3 Facebook/Meta-native ফিচার (সবচেয়ে বড় strategic gap) — 🟡 কোড DONE, Meta App setup বাকি (২০২৬-০৮-০২)
- **কেন:** Product vision-এ explicitly "ফেসবুকে বিক্রি করা ব্যবসায়ী" target audience, কিন্তু কোনো real FB integration ছিল না — এটাই আসল differentiator
- **যা হয়েছে:** MVP scope (per-seller Page comment + Messenger inbox lead capture → phone পাওয়া গেলে `customers` auto-save, নাহলে `/dashboard/leads`-এ manual-convert lead) সম্পূর্ণ implement + deploy — বিস্তারিত §15.11-এ
- **যা বাকি (external, কোড নয়):** Meta for Developers App তৈরি + App Review — §15.11-এর checklist অনুসরণ করুন

### 16.4 Payment Gateway অটোমেশন
- **কেন:** দুই জায়গায় দরকার — (ক) কাস্টমার অর্ডারে অনলাইন পেমেন্ট কালেকশন (বর্তমানে সব manual/COD), (খ) নিজের subscription billing অটোমেট করা (বর্তমানে manual trx-ID + admin approval)
- **কোথায় শুরু:** bKash PGW বা SSLCommerz sandbox integration — `SubscriptionController::submitPayment` flow-টাকে auto-verify করার মাধ্যমে শুরু করা সহজ (scope ছোট, existing manual flow পাশে রেখে গ্র্যাজুয়ালি migrate করা যায়)

### 16.5 Multi-courier rate/ETA compare + bulk booking UX উন্নতি
- **কেন:** Bulk booking backend route আগে থেকেই আছে (`/courier/book/bulk`) — কিন্তু booking-এর আগে ৪টা provider-এর rate/ETA পাশাপাশি compare করার UI আছে কিনা যাচাই করা দরকার; না থাকলে যোগ করা তুলনামূলক কম effort (backend price API সব provider-এই আছে)

### 16.6 Staff/Team role (multi-user per shop)
- **কেন:** ছোট F-commerce বিজনেসেও সাধারণত ২-৩ জন অর্ডার প্রসেস করে; বর্তমানে `users.role` শুধু `user`/`admin`, per-shop sub-account নেই
- **কোথায় শুরু:** `shop_staff` pivot/table (owner_user_id, staff_user_id, permissions jsonb) + সব controller-এ owner-scoping যোগ করা (CONTEXT.md §25-এর `adminScopeUserIds()` pattern-এর অনুরূপ কিন্তু shop-level)

### 16.7 Invoice/Waybill PDF generation
- **কেন:** Courier booking-এর পর printable label/invoice নেই — physical delivery workflow-এ এটা প্রায় mandatory বাংলাদেশি courier practice-এ
- **কোথায় শুরু:** `barryvdh/laravel-dompdf` (composer) + booking response থেকে waybill template render

### 16.8 Bulk/CSV order import
- **কেন:** Facebook কমেন্ট থেকে কপি-পেস্ট করে bulk অর্ডার এন্ট্রির সুবিধা এখনো নেই, abandoned-checkout-এর মতো export আছে কিন্তু import নেই
- **কোথায় শুরু:** `OrderController` এ নতুন `import` endpoint + CSV parser, existing `StoreOrderRequest` validation reuse করে

### 16.9 Mobile experience (PWA)
- **কেন:** টার্গেট ইউজারদের বড় অংশ মোবাইল-অনলি; বর্তমানে শুধু responsive web, installable/offline-capable না
- **কোথায় শুরু:** `next-pwa` বা native manifest.json + service worker যোগ করা — তুলনামূলক কম effort, existing responsive layout-এর উপর বসানো যায়

### Suggested execution order
1. ~~Analytics (16.1)~~ — ✅ DONE (2026-08-02)
2. ~~Courier abstraction hardening (16.2)~~ — ✅ DONE (2026-08-02, commit `0fdc3ab`)
3. ~~Facebook/Meta MVP (16.3)~~ — 🟡 কোড DONE (2026-08-02), Meta App setup (external) বাকি — §15.11 দেখুন
4. ~~Payment gateway automation (16.4)~~ — ✅ subscription billing অংশ **live in production** (2026-08-09, real bKash merchant account + real transaction verified, §18/§18.2)। Customer-facing landing-page checkout online payment এখনো শুরু হয়নি — সেটা ভিন্ন, বড় স্কোপ
5. Staff/Team roles (16.6), Invoice PDF (16.7), CSV import (16.8), PWA (16.9) — parallel-track, lower urgency

**Smaller open follow-ups (not full modules, can slot in anytime):** Carrybee bulk-booking + `cancel()` route wiring, RedX/Carrybee test-connection endpoints, Paperfly provider completion or removal, `FraudController::computeScore()` ↔ courier-fraud-data merge (§17.8 items 9/10).

---

## 17. গভীর কোড-লেভেল রিভিউ — নির্দিষ্ট বাগ/ঝুঁকি ফাইন্ডিংস (deep review: 2026-08-02)

§15 শুধু "এই ফিচার আছে কিনা" (presence) যাচাই করেছিল। এই section-এ প্রতিটা core module-এর actual controller/service কোড লাইন-বাই-লাইন পড়ে (৬টা independent deep-review pass দিয়ে) correctness, per-user data isolation, race condition, error handling, এবং security যাচাই করা হয়েছে — অনুমান নয়, প্রতিটা finding নির্দিষ্ট file:line-এ verify করা।

**Severity legend:**
- 🔴 **CRITICAL** — security বা টাকা-সংক্রান্ত সঠিকতার বাগ, দ্রুত ফিক্স দরকার
- 🟠 **REAL BUG** — নিশ্চিত functional correctness সমস্যা, প্রোডাকশনে প্রভাব ফেলে
- 🟡 **RISK / RACE** — concurrency বা architectural ঝুঁকি — এখনো ক্ষতি না করলেও করবে scale-এ
- 🔧 **HARDENING** — maintainability/robustness gap, break করছে না কিন্তু ভবিষ্যতে ব্যয়বহুল হবে
- ✅ **VERIFIED SOLID** — deep-review করে নিশ্চিত হওয়া গেছে যে সঠিকভাবে implemented

### 17.0 সবচেয়ে জরুরি (fix first)

**সবগুলো ✅ FIXED এবং LIVE (2026-08-02, একই সেশনে) — বিস্তারিত §17.9-এ।** Backend fix সব migrate করা ও production DB-তে live। Frontend fix (#4)-ও `npm run deploy:prod:safe` দিয়ে deploy করা হয়েছে (৮/৮ ধাপ pass) — live site এখন sanitized কোড সার্ভ করছে।

| # | Finding | কোথায় | Severity | Fix status |
|---|---|---|---|---|
| 1 | Subscription payment approval-এ `trx_id`-এর কোনো uniqueness check নেই — একই bKash trx_id একাধিকবার submit/approve করে subscription বিনামূল্যে extend করা সম্ভব | `SubscriptionController::submitPayment`, `subscription_payments` migration (কোনো unique index নেই), `AdminSubscriptionController::approvePayment` | 🔴 CRITICAL | ✅ FIXED |
| 2 | Public landing-page checkout submit (`POST /public/landing-pages/{slug}/order`) এবং page view (`GET .../{slug}`) route-এ কোনো rate-limit/throttle নেই — বাকি সব public route-এ আছে | `routes/api.php:69-70` | 🔴 CRITICAL | ✅ FIXED |
| 3 | `bootstrap/app.php`-এ `trustProxies(at: '*')` — client-supplied `X-Forwarded-For` blindly trust করা হয়, ফলে বাকি সব IP-based throttle (OTP verify/resend সহ) spoofed header দিয়ে bypass করা সম্ভব | `bootstrap/app.php:21` | 🔴 CRITICAL | ✅ FIXED |
| 4 | Landing page builder-এর `content.html_sections[].html` raw HTML হিসেবে `dangerouslySetInnerHTML`-এ কোনো sanitization ছাড়াই render হয় — compromised/malicious seller account visitor browser-এ script inject করতে পারে (stored XSS) | `public-landing-page-view.tsx:1208`, backend কোনো sanitize করে না | 🔴 CRITICAL | ✅ FIXED + DEPLOYED |
| 5 | SMS automation-এর duplicate-send guard একটা check-then-act race — কোনো DB unique constraint নেই `sms_automation_logs`-এ, concurrent status update হলে duplicate SMS + duplicate credit charge সম্ভব | `SmsAutomationService.php:36-56`, migration-এ unique index অনুপস্থিত | 🟠 REAL BUG | ✅ FIXED |
| 6 | SMS credit deduction-এর return value ignore করা হয় automation path-এ — race-condition-এ SMS আসলে পাঠানো হয় (টাকা খরচ) কিন্তু credit deduct না হয়ে "sent" মার্ক হয়ে যায়, কোনো accounting mismatch log থাকে না | `SmsAutomationService.php:124-165`, একই প্যাটার্ন `AdminSmsGatewayController::send():508-514` | 🟠 REAL BUG | ✅ FIXED |
| 7 | Steadfast courier booking-এ `courier_charge` কলামে ভুলবশত delivery fee-এর বদলে status string বসানো হয় — decimal cast silently `0.00`-তে coerce করে, প্রতিটা Steadfast booking-এর ফি ডেটা করাপ্ট | `CourierController.php:713` | 🟠 REAL BUG | ✅ FIXED |
| 8 | `OrderStatusService`-এ variant stock decrement (`stock_qty`) কোনো row lock/floor check ছাড়া হয় — concurrent order confirm হলে stock negative-এ যেতে পারে (overselling); সাধারণ (non-variant) `track_stock` product-এ stock deduction path-ই নেই | `OrderStatusService.php:63`, `product_variants` migration-এ CHECK constraint নেই | 🟠 REAL BUG | ✅ FIXED (variant path; non-variant track_stock gap এখনো open, §16 নতুন item হিসেবে যোগ করা উচিত) |
| 9 | Order edit (shipping/discount বদলালে) courier charge ছাড়া accounting ledger refresh হয় না — pending/delivered order-এর ledger amount order-এর real total-এর সাথে stale হয়ে যেতে পারে | `OrderController.php:379-393` | 🟠 REAL BUG | ✅ FIXED |
| 10 | `AdminController::deleteUser` — permanent hard delete (`User` model-এ `SoftDeletes` নেই), কোনো confirmation/undo/export ছাড়া একজন seller-এর সব order/product/transaction/landing-page/SMS history cascade delete হয়ে যায় | `AdminController.php:111-118` | 🔴 CRITICAL | ✅ FIXED |
| 11 | Courier credential (Steadfast/Pathao/RedX/Carrybee/Paperfly-এর password fields) এবং email SMTP password — কোনো encryption cast ছাড়া plaintext-এ DB-তে store হয়, অথচ SMS gateway credential-এ ঠিকমতো `encrypted` cast আছে — inconsistent standard | `CourierSetting.php`, `EmailConfiguration.php` (`$hidden` আছে কিন্তু cast নেই) | 🔴 CRITICAL (data-at-rest exposure যদি DB কখনো compromise হয়) | ✅ FIXED |
| 12 | **কোনো queue worker consumer নেই** এই deployment-এ (`QUEUE_CONNECTION=redis`, কিন্তু কোনো systemd/supervisor/cron `queue:work` নেই) — যেকোনো `delay_minutes > 0` SMS automation rule silently কখনো fire হয় না, Redis-এ চিরস্থায়ী জমা থাকে। Immediate-trigger (delay=0) rule প্রভাবিত না (sync path)। আবিষ্কৃত Facebook lead-capture webhook feature build করার সময় — বিস্তারিত §17.5-এ | কোনো `hybrid-queue-worker.service` নেই, `routes/console.php`-এ শুধু `app:expire-subscriptions` scheduled, `queue:work` কোথাও নেই | 🔴 CRITICAL (silent data/feature loss, delayed SMS automation broken) | ✅ FIXED (2026-08-08) — বিস্তারিত §17.10 |

### 17.1 Order + Product + Customer (Core Commerce)

**Order (`OrderController.php`, `OrderStatusService.php`, `StoreOrderRequest.php`) — verdict: functional-with-gaps**
- 🟠 `store()`-এ শুধু `product_variant_id` পাঠালে (কোনো `product_id` ছাড়া) ownership check bypass হয় — অন্য seller-এর variant নিজের অর্ডারে যোগ করা সম্ভব তাত্ত্বিকভাবে (low exploitability, কিন্তু per-user isolation policy-র সাথে সাংঘর্ষিক) (line 245-270)
- 🟠 Stock check `store()`-এ (line 290) TOCTOU — creation-time-এ validate হয়, decrement হয় status-transition-এ, মাঝখানে দুটো concurrent order একই limited stock pass করতে পারে
- 🟡 `Order::generateOrderNumber()` কোনো lock ছাড়া `orderByDesc('id')` — রেসে unique constraint violation-এ uncaught `QueryException` (500) হয়, data করাপ্ট হয় না কিন্তু ইউজার একটা raw error পায়
- ✅ সব query (`index/stats/show/update/updateStatus/bulkStatus/destroy/createBootstrap`) সঠিকভাবে `user_id` scoped
- ✅ `store()` `DB::transaction`-এ wrapped, ভালো error handling (`ValidationException::withMessages`)
- 🔧 `bulkStatus` ইচ্ছাকৃতভাবে inventory adjustment skip করে (`adjustInventory: false`) — single vs bulk status-change আচরণে inconsistency

**Product + Variants (`ProductController.php`, `ProductVariantController.php`, `ProductMediaController.php`, `ProductCategoryController.php`) — verdict: production-solid, কোডবেসের সবচেয়ে ভালো-লেখা অংশ**
- ✅ প্রতিটা action-এ `authorizeProduct()` + nested resource ownership check (option/value/variant সব ID-substitution-প্রুফ)
- ✅ Variant `generate()` race-safe: প্রতি-row `UniqueConstraintViolationException` catch করে ব্যাচ চালিয়ে যায় (contrast: `OrderStatusService`-এর মতো lock-less নয়)
- ✅ Media upload MIME/size/dimension সার্ভার-সাইড enforce করা, primary-thumbnail invariant বজায় থাকে
- ✅ Variant/SKU system পুরোপুরি end-to-end wired — backend generate/resolve/bulk-update, frontend `variant-picker-modal.tsx`/`variant-table.tsx`/`variants-tab.tsx` সবই আসলে ব্যবহার করছে (orphan না)
- 🔧 SKU uniqueness global (per-user না) — এক seller-এর SKU অন্য seller-কে block করতে পারে

**Customer (`CustomerController.php`) — verdict: functional-with-gaps**
- ✅ Seller-facing query সব scoped; `lookupByPhone()` ইচ্ছাকৃতভাবে cross-tenant (comment-এ confirmed "shared lookup, cross-user safe") — design অনুযায়ী সঠিক কিন্তু মনে রাখা দরকার এক seller-এর customer-এর নাম/ঠিকানা আরেক seller দেখতে পায় যদি একই ফোন নাম্বার থেকে অর্ডার আসে
- 🟡 `syncAll()` একজন seller-এর **সব** order মেমোরিতে লোড করে dedupe করে, কোনো chunking নেই — বড় seller-এ (হাজার হাজার order) memory/perf ঝুঁকি
- 🔧 `Customer::orders()` relation define করা কিন্তু ব্যবহার হয় না (`show()` একই query manually লেখে) — dead code

**Frontend bilingual/mobile-first compliance gap (CONTEXT.md §20/§22 লঙ্ঘন)** — ✅ FIXED (2026-08-08, commit `c009fe8`)
- ~~🟠 `order-intake-form.tsx` সম্পূর্ণ English-only~~ — bn/en text dict যোগ করা হয়েছে (locale state আগে থেকেই ছিল, UI text-এ ব্যবহার হতো না)
- ~~🟠 `variant-picker-modal.tsx`, `variant-table.tsx`, `option-editor.tsx` — English-only + hardcoded Tailwind color~~ — সব ৪টা variant component (+ `variants-tab.tsx`) bn/en dict পেয়েছে, `bg-blue-600`/`gray-*`/`bg-white` → `var(--accent)`/`var(--surface)`/`var(--border)`/`var(--muted)` টোকেনে বদলানো হয়েছে — বিস্তারিত §17.11

### 17.2 Fraud Detection (Internal + Courier-based)

**Internal fraud score (`FraudController::computeScore`) — verdict: functional-with-gaps, ডকুমেন্টেশন stale**
- 🟠 Documented algorithm (SAAS_MODULE_CONTEXT.md §4.2)-এর সাথে actual code বাস্তবে মেলে না:
  - "+20 courier return >40%" — courier fraud data (`CourierFraudCheckService`) `computeScore()`-এর ভেতরে **কখনোই read হয় না**; internal score আর cross-courier check সম্পূর্ণ disconnected দুটো সিস্টেম
  - "+10 name inconsistency" — কোনোভাবেই implement করা হয়নি, `Order.customer_name` থাকলেও কখনো read হয় না score-এ
  - "+15 repeated cancels" আসলে code-এ "returned ≥ 2" চেক করে, cancel না
  - Undocumented extra branches আছে: `sellerCount >= 3` → +10, `globalBlacklistCount > 0` → +40 — এগুলো doc-এ নেই
- ✅ Risk-level threshold (0-30/31-60/61+) ঠিক doc-এর সাথে মেলে
- 🟡 Global blacklist propagation (+40, `FraudController.php:248-250`) — যেকোনো এক seller ব্লকলিস্ট করলে সব seller-এর জন্য সেই ফোন সাথে সাথে "medium risk"-এ চলে যায়, কোনো validation/audit ছাড়া — abuse-able
- ~~"+20 courier return >40%" কখনো read হয় না~~ — ✅ FIXED (2026-08-08): `computeScore()` এখন `courier_fraud_stats`-এর cached cross-courier data read করে (নতুন call করে না, শুধু existing cache পড়ে) — §17.10
- ✅ Blacklist CRUD সঠিকভাবে per-user scoped, unique constraint আছে

**Courier-based cross-provider fraud check — verdict: production-solid (architecture)**
- ✅ `courier_fraud_stats` cache সত্যিকারের shared/global (`unique(['phone_number','courier_name'])`, কোনো `user_id` key-তে নেই) — commit `25a0095`-এর উদ্দেশ্য অনুযায়ী সঠিক
- ✅ সব ৫টা provider service (Steadfast/Pathao/RedX/Carrybee/Paperfly) failure-কে "0 risk" না, "unknown/error" হিসেবে treat করে — ভালো design choice
- 🟡 Steadfast/Pathao/RedX/Carrybee: production-solid; Paperfly: functional-with-gaps (status string-এর উপর `str_contains` heuristic parsing, fragile)
- 🟡 `/fraud/courier-check` রুটে কোনো per-user throttle নেই, শুধু DB-cache-এর উপর নির্ভর করে abuse ঠেকাতে
- 🔴 (§17.0-এ উল্লেখিত) courier credential plaintext storage

### 17.3 Courier Integration (Steadfast / Pathao / RedX / Carrybee)

সবগুলো provider individually **functional-with-gaps** — কোনোটাই stub না, কিন্তু প্রতিটাতে নির্দিষ্ট bug/gap আছে:

| Provider | মূল সমস্যা |
|---|---|
| Steadfast | 🟠 `courier_charge`-এ status string বসে (§17.0, ফিক্স হয়ে গেছে); ~~🟡 bulk booking response index-based correlation~~ — ✅ FIXED (2026-08-08): এখন invoice/order_number দিয়ে correlate করে, positional fallback হলে log warning — §17.10 |
| Pathao | ✅ OAuth token refresh সঠিকভাবে implement করা (একমাত্র provider যেখানে expiry ঠিকমতো হ্যান্ডেল হয়), কিন্তু 🔧 `PathaoService` আর `PathaoLocationService`-এ দুটো আলাদা, ডাইভার্জড token-fetch implementation আছে (একটা DB-persisted, একটা শুধু cache) — maintenance trap, এখনো open |
| RedX | ✅ backend সলিড, ✅ bulk booking + frontend selector এখন exposed (২০২৬-০৮-০২ courier-abstraction কাজে) — 🔧 test-connection endpoint এখনো নেই |
| Carrybee | কাজ করে বুকিং-এ, 🟠 bulk-booking থেকে এখনো ইচ্ছাকৃতভাবে বাদ (per-order area-search UI দরকার, কোডে documented), tracking-refresh UI-তে নেই, no test-connection endpoint; ~~`cancel()` route-লেস~~ — ✅ FIXED (2026-08-08): generic `POST /api/courier/cancel/{order}` যোগ হয়েছে, `CourierFactory` দিয়ে dispatch করে (Carrybee/Paperfly real cancel, বাকি provider-এ `AbstractCourierProvider`-এর no-op 422 fallback) — §17.10 |

**Shared architecture — ✅ DONE (2026-08-02, commit `0fdc3ab`) — আগে 🔧 fragile ছিল, এখন resolved**
- `app/Services/Courier/CourierProviderInterface.php` (`book()/bookBulk()/track()/cancel()`) + `CourierFactory::make()` + `AbstractCourierProvider` — ৪টা provider এখন একটা common contract মেনে চলে, `CourierController.php` (1138→692 লাইন) hand-written if/elseif chain বাদ দিয়ে factory-dispatch করে
- **এখনো open:** `courier_settings` টেবিলে `paperfly_username`/`paperfly_password` কলাম আগে থেকেই আছে, কিন্তু কোনো `PaperflyService`/provider class/route নেই — ৫ম provider schema-লেভেলে শুরু হয়ে মাঝপথে ছেড়ে দেওয়া অবস্থাতেই আছে (নতুন abstraction-এ যোগ করা এখনো বাকি)
- কোথাও কোনো retry/backoff নেই; status sync সব provider-এ purely on-demand (কোনো webhook/scheduled job নেই) — এই গ্যাপ অপরিবর্তিত

### 17.4 Landing Page + Checkout + Abandoned Checkout (Public-facing)

এটা unauthenticated public surface, তাই security সবচেয়ে গুরুত্বপূর্ণ অংশ ছিল এই রিভিউতে:

- 🔴 rate-limit অনুপস্থিত public order-submit/page-view-এ (§17.0)
- 🔴 `trustProxies(at:'*')` বাকি সব IP-throttle-কে দুর্বল করে দেয় (§17.0)
- 🔴 stored XSS সম্ভাবনা `html_sections`-এ (§17.0)
- ✅ Order lookup token (`public_token`, `hash_equals` দিয়ে compare) — sequential-ID IDOR সম্ভব না
- ✅ Pricing/variant resolution সবসময় server-side, client কখনো দাম spoof করতে পারে না
- ✅ OTP verification: max attempt (5) + resend limit (২বার + ১ঘণ্টা block) server-side enforced, IP-throttle bypass হলেও এই layer অক্ষত থাকে
- ✅ Admin lock/unlock — সত্যিকারের backend enforcement (`update()`/`publish()` উভয়েই `admin_locked` চেক করে), UI hide করাই যথেষ্ট না ধরে নিয়ে সঠিকভাবে server-side ব্লক করা হয়েছে; mass-assignment দিয়ে bypass করার path নেই
- ✅ Media upload: Laravel-এর `image` rule SVG reject করে (classic SVG-XSS ভেক্টর বন্ধ), path traversal সম্ভব না (hashed filename)
- ✅ bn/en `settings.language` সত্যিই backend-generated message পর্যন্ত পৌঁছায় (OTP message, validation error) — শুধু frontend static text না
- 🔧 `LandingPageAnalyticsController::linkVisitToOrder` — `order_id` caller-এর নিজের order-এ scoped না (শুধু global `exists` চেক), analytics data pollution সম্ভব (কোনো data disclosure না, কম impact)

### 17.5 SMS + Notification System

- ✅ Data scoping architecture নিখুঁত: SMS automation rules per-user, SMS gateway/credit/notification template/email config সব সঠিকভাবে `adminScopeUserIds()` pattern মেনে admin-shared — CONTEXT.md §25-এর সাথে ১০০% সামঞ্জস্যপূর্ণ, কোনো scoping-উল্টো finding নেই
- 🟠 Duplicate-send race + credit-deduction ignored-return (§17.0, ✅ ফিক্স হয়ে গেছে)
- ~~`SendAutomationSmsJob`-এ `backoff()`/`failed()` handler নেই~~ — ✅ §17.9 fix #5-এ যোগ করা হয়েছে
- 🔴 **নতুন CRITICAL finding (আবিষ্কৃত 2026-08-02, Facebook feature deploy করার সময়):** এই deployment-এ কোনো queue worker consumer নেই — `QUEUE_CONNECTION=redis` কিন্তু কোনো systemd/supervisor service বা cron `queue:work` নেই (শুধু `schedule:run` প্রতি মিনিটে চলে, যা নিজে queue consume করে না)। **Immediate-trigger (`delay_minutes=0`) SMS automation নিরাপদ** — `SmsAutomationService::handleOrderStatusChanged()` সেই path-এ সরাসরি sync `dispatchNow()` কল করে, queue ছোঁয় না (verified: `SmsAutomationService.php`)। কিন্তু **`delay_minutes > 0` সেট করা যেকোনো automation rule সম্পূর্ণভাবে silently ভাঙা** — `SendAutomationSmsJob::dispatch(...)->delay(...)` Redis-এ জমা হয়ে থাকে, কখনো process হয় না, কোনো error/log ছাড়াই SMS আর পাঠানো হয় না। `DispatchNotificationJob` ক্লাসটাও `ShouldQueue` কিন্তু grep-এ কোনো `::dispatch()` call site পাওয়া যায়নি (OTP/password-reset flow `NotificationDispatchService` সরাসরি sync কল করে) — সম্ভবত dead/unused code, প্রভাব নেই। Fix: `hybrid-queue-worker.service`-এর মতো একটা systemd service যোগ করে `php artisan queue:work --tries=3` persistent রাখা (courier/frontend systemd pattern অনুসরণ করে) — production-impacting, উচ্চ priority
- 🔧 Delayed SMS-এ orphaned "queued" log row থেকে যায় (কখনো sent/failed-এ transition হয় না) — উপরের queue-worker gap-এর কারণে সম্ভবত আরও বেশি ঘটছে
- 🔧 UI-তে `payment_due`/`failed_delivery_retry` trigger-type সিলেক্ট করা যায় কিন্তু কোনো কোড path সেগুলো কখনো fire করে না — dead UI option
- ✅ Generic Notification Dispatch system **আসলে ব্যবহার হচ্ছে** (orphaned না) — OTP, password-reset, subscription-expiry flow-এ সরাসরি wired; এখানকার failure handling (backoff + `failed()`) SMS automation-এর চেয়ে বেশি robust
- 🔴 SMTP password encryption-cast অনুপস্থিত (§17.0)
- শুধু `khudebarta` provider বাস্তবে supported — অন্য provider validation-লেভেলেই block হয়ে যায় (schema provider-agnostic কিন্তু বাস্তবে single-provider)

### 17.6 Accounting + Subscription/Billing + Admin Panel

- ✅ Auto-ledger dedup key (`user_id, reference_type, reference_id, type, category`) সঠিক, delivered→returned→delivered আবার হলে duplicate row হয় না
- 🟡 কিন্তু dedup `updateOrCreate` (select-then-write), DB-তে কোনো unique constraint নেই — concurrent status change/retry হলে race সম্ভব
- 🟠 Order edit (shipping/discount) ledger refresh না করা (§17.0)
- 🟡 `OrderController::destroy` soft-delete করে কিন্তু accounting entry cleanup করে না — orphaned ledger row
- ✅ Profit ফর্মুলা সঠিক: pending/undelivered COD "confirmed income" হিসেবে গণনা হয় না, শুধু delivered-এ
- ✅ Subscription middleware (`active_subscription`) hard-cutoff সঠিক, GET/HEAD সবসময় allow, admin সঠিকভাবে exempt
- 🟡 কিন্তু expired subscription-এ seller নিজের delivered COD order status update করতে পারে না → real cash delivered হয়েও accounting-এ confirm হয় না যতক্ষণ renew না করে (side-effect, প্রোডাক্ট সিদ্ধান্ত দরকার)
- 🟡 কোনো default subscription package সেট না থাকলে নতুন user permanently unmetered/free থেকে যায় — config footgun, কোনো warning নেই admin panel-এ
- 🔴 `trx_id` uniqueness অনুপস্থিত (§17.0) — এই পুরো রিভিউয়ের সবচেয়ে বড় ঝুঁকি
- ✅ Subscription extension logic সঠিকভাবে additive (stack on remaining time, restart if lapsed না ভুলভাবে reset)
- 🔴 `AdminController::deleteUser` hard-delete, কোনো soft-delete/undo নেই (§17.0)
- ~~🟡 `customers` টেবিলের `user_id`-এ কোনো FK constraint নেই~~ — ✅ FIXED (2026-08-08): `foreignId('user_id')->constrained()->cascadeOnDelete()` যোগ হয়েছে, `products`/`orders`-এর প্যাটার্ন অনুসরণ করে — §17.10
- ~~🟡 Flat admin role ... self-lockout protection নেই~~ — ✅ FIXED (2026-08-08): এখনো কোনো super-admin tier নেই (unchanged, বড় স্কোপ), কিন্তু last-remaining-admin demote/delete এখন `AdminController::updateUser/deleteUser`-এ ব্লক করা হয় — §17.10

### 17.7 এই রিভিউতে ভালোভাবে verify হওয়া শক্তিশালী অংশ (ব্যালেন্সের জন্য)

শুধু বাগ-লিস্ট না — নিচের অংশগুলো deep-review করার পরেও genuinely production-solid প্রমাণিত হয়েছে:
- Product + Variant system (authorization, race-safety, end-to-end wiring)
- Courier-based cross-provider fraud cache architecture
- Generic Notification Dispatch system (সক্রিয়ভাবে ব্যবহৃত, ভালো failure handling)
- Checkout OTP verification flow (bypass-প্রুফ, server-side attempt/resend limit)
- Abandoned checkout ownership/token scoping
- Landing page admin lock/unlock enforcement (backend-level, না শুধু UI)
- Media library upload validation (SVG-XSS বন্ধ, path traversal সম্ভব না)
- Bilingual settings.language backend-message propagation
- Accounting profit ফর্মুলা (pending COD সঠিকভাবে বাদ)
- Data-scoping pattern (adminScopeUserIds) — SMS/Notification-এ ১০০% সামঞ্জস্যপূর্ণভাবে প্রয়োগ করা

### 17.8 এই রিভিউ থেকে §16-এ যোগ করার নতুন recommendation

§16-এর original তালিকার পাশাপাশি, deep review থেকে পাওয়া নিচের ফিক্সগুলো নতুন feature-এর আগে prioritize করা উচিত (এগুলো existing ব্যবহারকারীদের সরাসরি প্রভাবিত করতে পারে):

1. **`trx_id` unique constraint + validation** যোগ করা — subscription payment duplicate-approval ঝুঁকি বন্ধ করতে (১ ঘণ্টার কাজ, বড় impact)
2. **Public checkout route-এ throttle middleware** যোগ করা (§17.0 #2) — বাকি সব public route-এর প্যাটার্ন অনুসরণ করে
3. **`trustProxies` config review** — নিশ্চিত করা edge-এ trusted reverse proxy XFF header strip/overwrite করছে, নাহলে `at: '*'` বাদ দিয়ে নির্দিষ্ট trusted proxy IP বসানো
4. **`html_sections` sanitization** যোগ করা (backend `strip_tags`/allow-list অথবা frontend DOMPurify) — stored XSS বন্ধ করতে
5. **Courier credential + email SMTP password encryption cast** যোগ করা (`CourierSetting`, `EmailConfiguration` মডেলে `SmsGateway`-এর প্যাটার্ন অনুসরণ করে)
6. **SMS credit deduction race ফিক্স** — `deduct()`-এর return value চেক করে log/alert করা, ideally SMS পাঠানোর আগে atomic reserve-then-confirm প্যাটার্নে যাওয়া
7. **`AdminController::deleteUser`-এ soft-delete/confirmation** যোগ করা — accidental/malicious data loss ঠেকাতে
8. ~~**`CourierProviderInterface` abstraction**~~ — ✅ DONE (2026-08-02, commit `0fdc3ab`) — বিস্তারিত §16.2/§17.3
9. **RedX/Carrybee bulk-booking ও tracking-refresh UI-তে expose করা** — 🟡 আংশিক: RedX bulk-booking + selector এখন frontend-এ exposed (commit `0fdc3ab`-এর অংশ); Carrybee bulk-booking এখনো বাদ (area-search UI দরকার), tracking-refresh UI এখনো কোনো provider-এই নেই, Carrybee `cancel()` এখনো route-লেস
10. **`FraudController::computeScore()` আর courier fraud data merge করা** — documented "+20 courier return" সিগন্যাল বাস্তবে score-এ যোগ করা, অথবা doc আপডেট করে honest রাখা যে এই দুটো আলাদা সিস্টেম — এখনো open

### 17.9 §17.0-এর ১১টা CRITICAL fix implementation log (2026-08-02, একই সেশনে সব প্রয়োগ করা হয়েছে)

প্রতিটা fix live production DB-তে migrate করা হয়েছে ও tinker দিয়ে verify করা হয়েছে (আসল data নিয়ে, rollback করা transaction-এর ভেতর)। Backend fix সব **live**; frontend fix (#4) `npm run deploy:prod:safe` দিয়ে deploy করা হয়েছে — ৮/৮ ধাপ pass, `hybrid-frontend.service` active/running confirm করা হয়েছে, active CSS chunk `200 OK`।

| # | কী পরিবর্তন হয়েছে | ফাইল | Migration |
|---|---|---|---|
| 1 | `trx_id`-এ DB-level unique constraint + `submitPayment()`-এ validation rule | `SubscriptionController.php` | `2026_08_02_072543_add_unique_constraint_to_subscription_payments_trx_id` |
| 2 | `publicShow` (60/min), `publicSubmitOrder` (15/min) route-এ `throttle` middleware | `routes/api.php:69-70` | — |
| 3 | `trustProxies(at: '*')` → শুধু private/loopback range trust করে (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) — native host-এ REMOTE_ADDR সবসময় সঠিক থাকে বলে কোনো range match করবে না (client XFF ignore হবে), Dokploy/Traefik-এর মতো internal-hop deployment-এ এখনো কাজ করবে | `bootstrap/app.php` | — |
| 4 | `sanitizeHtml()` (isomorphic-dompurify) — rich-text block + `html_sections` উভয় `dangerouslySetInnerHTML`-এ প্রয়োগ; `sanitizeCustomCss()` — `</style` breakout strip | `public-landing-page-view.tsx`, নতুন dependency `isomorphic-dompurify` (`package.json`) | — (frontend, deploy আলাদা ধাপ) |
| 5 | Check-then-act duplicate guard → atomic claim-then-update: partial unique index `(rule_id, order_id, trigger_event) WHERE status IN ('queued','sent')`, claim-insert catch করে `UniqueConstraintViolationException`-এ skip; `dispatchNow()`/job একই log row আপডেট করে (নতুন row বানায় না); job-এ `backoff()`/`failed()` যোগ করা হয়েছে যাতে network exception-এও log row 'failed'-এ resolve হয় | `SmsAutomationService.php`, `SendAutomationSmsJob.php` | `2026_08_02_073219_add_unique_active_claim_index_to_sms_automation_logs` |
| 6 | `deduct()`-এর boolean return check করা হয় এখন — `false` হলে (SMS পাঠানো হয়ে গেছে কিন্তু charge fail) `error_message`-এ WARNING লেখা হয় + `Log::warning()`; একই fix `AdminSmsGatewayController::send()`-এও (নতুন `credit_deduction_failures` counter response-এ) | `SmsAutomationService.php`, `AdminSmsGatewayController.php` | — |
| 7 | Steadfast booking-এ `'courier_charge' => data_get($result, 'consignment.current_status')` লাইন সরানো হয়েছে (delivery fee Steadfast API থেকে বুকিং সময়ে আসেই না — ভুল করে status string বসছিল) | `CourierController.php:713` (bookSteadfast) | — |
| 8 | Variant stock decrement এখন `WHERE stock_qty >= quantity` guard সহ atomic conditional UPDATE — affected rows 0 হলে `ValidationException` (order status transition reject); পুরো `transition()` এখন `DB::transaction()`-এ wrapped যাতে multi-item order-এ partial-decrement-then-fail rollback হয় | `OrderStatusService.php` | — (schema change লাগেনি, শুধু query-level guard) |
| 9 | নতুন `AccountingService::onOrderTotalUpdated()` — pending/confirmed COD income transaction-এর amount sync করে; `OrderController::update()`-এ `total` বদলালে call হয় | `AccountingService.php`, `OrderController.php` | — |
| 10 | `User` model-এ `SoftDeletes` trait + `deleted_at` column — `deleteUser()`-এর কোড অপরিবর্তিত রেখেই এখন soft-delete হয় (data/order/product/transaction cascade আর হয় না); registration/admin-create uniqueness rule (`email`/`mobile`) `whereNull('deleted_at')` দিয়ে scoped — deleted account-এর email/mobile নতুন registration-এর জন্য মুক্ত হয়ে যায় | `User.php`, `OtpController.php`, `AdminController.php` | `2026_08_02_073851_add_soft_deletes_to_users_table` |
| 11 | `CourierSetting`/`EmailConfiguration` মডেলে sensitive field-গুলোতে `'encrypted'` cast (SmsGateway-এর প্যাটার্ন) — column widen করা হয়েছে আগে (varchar→text, encrypted envelope ২৫৫ char-এর বেশি হয়) + **existing plaintext production data** raw `Crypt::encryptString()` দিয়ে migrate করা হয়েছে (model cast active হওয়ার আগে, নাহলে existing row read করতে গিয়ে `DecryptException` হতো) | `CourierSetting.php`, `EmailConfiguration.php` | `2026_08_02_074114_widen_courier_settings_secret_columns_for_encryption`, `2026_08_02_074208_encrypt_existing_courier_and_email_credentials` |

**Verification method:** প্রতিটা fix-এ syntax check (`php -l`) + একটা tinker-based functional test চালানো হয়েছে (আসল/বাস্তব ডেটার উপর, কিন্তু সবসময় `DB::beginTransaction()`/`rollBack()`-এর ভেতরে যাতে কোনো test data persist না হয়) — race condition (#5, #8), validation rejection (#8), ledger sync (#9), soft-delete visibility (#10), encryption round-trip (#11) সবগুলো সরাসরি পরীক্ষা করে pass confirm করা হয়েছে। `php artisan route:list` (227 routes) ও `php artisan migrate:status` দিয়ে পুরো backend health verify করা হয়েছে।

### নতুন gap যা এই fix pass-এ ধরা পড়েছে (§16/§17.0-এ ছিল না) — ✅ উভয়টাই ফিক্স করা হয়েছে (2026-08-02, পরের সেশনে)

- ~~অ-variant (`track_stock`) product-এর জন্য stock deduction path এখনো নেই~~ — ✅ FIXED: `OrderStatusService::reserveProductStock()`/release path যোগ করা হয়েছে, variant-এর মতোই atomic guarded UPDATE (`WHERE track_stock=true AND stock>=qty`), untracked product হলে no-op
- ~~`bulkStatus` (`adjustInventory: false`) inventory reserve/release completely skip করত~~ — ✅ FIXED: `adjustInventory` param পুরোপুরি সরানো হয়েছে (single আর bulk এখন identical inventory behavior); বাড়তি হিসেবে per-order `try/catch` যোগ করা হয়েছে যাতে একটা order-এ insufficient-stock বাকি batch আটকে না দেয় — response এখন `{updated, failed:[{id, order_number, message}]}` রিপোর্ট করে

**পরিবর্তিত ফাইল:** `backend/app/Services/OrderStatusService.php` (`adjustInventoryForStatusTransition` — variant + product দুটোই হ্যান্ডল করে), `backend/app/Http/Controllers/Api/OrderController.php::bulkStatus`

**Verification:** rollback-wrapped tinker test — reserve/reject/release/untracked-no-op সবগুলো scenario আর bulk partial-failure (2 succeed + 1 skip, stock/response সঠিক) pass করেছে। কোনো migration লাগেনি (schema অপরিবর্তিত, শুধু query-level guard)। `php -l` clean, কোনো ব্রেকিং caller নেই (`transition()`-এর একমাত্র positional/named caller ছিল `bulkStatus`, বাকি সব caller ইতিমধ্যে default ব্যবহার করত)।

---

### 17.10 §17-এর আরও ৫টা open finding fix (2026-08-08, commit `d48c22a`)

`git log`-এ commit reference: `d48c22a`। সব fix rollback-wrapped tinker দিয়ে verify করা হয়েছে, backend-only (কোনো frontend deploy লাগেনি), `php-fpm reload` করে opcache picked up নিশ্চিত করা হয়েছে, `/api/health` 200 confirm করা হয়েছে।

| # | কী পরিবর্তন হয়েছে | ফাইল | Migration |
|---|---|---|---|
| 1 | নতুন `hybrid-queue-worker.service` (systemd, `User=www-data`, `Restart=always`) — `php artisan queue:work redis --tries=3 --backoff=10 --max-time=3600 --sleep=3` চালায়, enabled+active। এতদিন কোনো queue consumer ছিলই না, তাই `delay_minutes > 0` SMS automation rule silently কখনো fire হতো না (§17.0 #12) | `/etc/systemd/system/hybrid-queue-worker.service` (server config, repo-তে নেই) | — |
| 2 | `AdminController::updateUser`/`deleteUser`-এ নতুন `hasAnotherActiveAdmin()` guard — শেষ admin-কে demote (role→user) বা delete করার চেষ্টা করলে `422` রিটার্ন করে | `AdminController.php` | — |
| 3 | `FraudController::computeScore()`-এ নতুন `courier_fraud_stats`-read ব্লক — phone-এর সব provider-এর cached `total_parcels`/`total_cancelled` sum করে, aggregate return-rate ≥3 parcel এবং >40% হলে ডকুমেন্টেড "+20" যোগ করে (`PhoneIntelCache::remember`-এর মাধ্যমে cached, কোনো নতুন courier API call ট্রিগার করে না) | `Api/FraudController.php` | — |
| 4 | `customers.user_id`-এ FK constraint (`constrained()->cascadeOnDelete()`), `products`/`orders`-এর প্যাটার্ন মিলিয়ে — migrate করার আগে orphan-row check (0 পাওয়া গেছে) করা হয়েছে | `database/migrations/...add_foreign_key_to_customers_user_id.php` | `2026_08_08_072119_add_foreign_key_to_customers_user_id` |
| 5 | `SteadfastCourierProvider::bookBulk()` — response item-কে array position-এর বদলে `invoice` (= `order_number`) দিয়ে match করে; invoice না মিললে positional fallback + `Log::warning()` | `Services/Courier/SteadfastCourierProvider.php` | — |
| 6 | নতুন `POST /api/courier/cancel/{order}` route + `CourierController::cancelBooking()` — `CourierFactory::make()` দিয়ে dispatch করে `cancel()` কল করে; Carrybee/Paperfly-এর already-written `cancel()` method finally একটা route পেল, বাকি provider `AbstractCourierProvider`-এর no-op-এ সঠিকভাবে `422` দেয় | `Api/CourierController.php`, `routes/api.php` | — |

**Verification method:** প্রতিটাতে rollback-wrapped tinker test (real DB row বানিয়ে, transaction rollback করে) — queue worker: `journalctl` দিয়ে dispatched job `RUNNING` হতে দেখা গেছে (worker সক্রিয়ভাবে redis থেকে consume করছে); admin lockout: last-admin demote/delete `422`, second-admin থাকলে সফল `200` — তিনটাই test করা হয়েছে; fraud merge: high-cancel-rate phone → +20 (score ≥20), low-cancel-rate phone → কোনো false positive না (score 0) — দুটোই pass; FK: pre-migration orphan-count 0 verify করে migrate; Steadfast correlation: `Http::fake()` দিয়ে **reversed-order** response simulate করে দেখানো হয়েছে প্রতিটা order সঠিক consignment_id পেয়েছে (আগের positional match হলে এটা fail করত); courier cancel: Carrybee-এর জন্য end-to-end (`Http::fake` cancel endpoint success → `order.courier_status` → `cancelled`), Steadfast-এর জন্য no-op fallback `422`, no-tracking-id order-এ `422` — সব pass।

**এখনো open থাকা items (§16/§17.8 থেকে):** Pathao dual token-fetch implementation (🔧, বড় refactor), Carrybee bulk-booking UI + tracking-refresh UI (কোনো provider-এ নেই), Paperfly incomplete (schema আছে, service/route নেই — সম্পূর্ণ করা বা schema বাদ দেওয়া সিদ্ধান্ত দরকার) — এগুলো বড় স্কোপ/product decision লাগে।

### 17.11 Frontend bilingual + design-token fix (2026-08-08, commit `c009fe8`)

`order-intake-form.tsx` এবং variant UI (`variant-picker-modal.tsx`, `variant-table.tsx`, `option-editor.tsx`, `variants-tab.tsx`) — সব ৫টা ফাইলে bn/en text dict (codebase convention: `const text = { bn: {...}, en: {...} }`, `const t = text[locale]`, দেখো `support-chat-widget.tsx`) যোগ করা হয়েছে এবং hardcoded Tailwind color (`bg-blue-600`, `text-gray-*`, `border-gray-*`, `bg-white`) design token-এ বদলানো হয়েছে (`var(--accent)`/`var(--surface)`/`var(--surface-soft)`/`var(--border)`/`var(--muted)`/`var(--foreground)`)। Red/green/orange status color ইচ্ছাকৃতভাবে Tailwind-ই রাখা হয়েছে — globals.css-এ কোনো danger/success token নেই, `order-item-grid.tsx`-এর existing convention-এর সাথে সামঞ্জস্যপূর্ণ রাখা হয়েছে।

**Locale prop threading:** `VariantsTab`/`OptionEditor`/`VariantTable` এখন `locale: Locale` (required) prop নেয়, `ProductDetailPage` (`dashboard/products/[id]/page.tsx`) থেকে থ্রেড হয়ে আসে (page-টা আগে থেকেই bilingual, `useState(getStoredLocale)` pattern ব্যবহার করে)। `VariantPickerModal` দুই জায়গা থেকে ব্যবহৃত হয় (`order-intake-form.tsx`, `landing-page-builder.tsx`) বলে `locale?: Locale` optional (default `"en"`) রাখা হয়েছে, দুই caller-ই নিজেদের `locale` pass করে। এই component গুলো `UserShell`-এর children হিসেবেই রেন্ডার হয় (§30-এর architectural rule অনুযায়ী প্রপ থ্রেডিং নিরাপদ, `useLocale()` context timing সমস্যা এখানে প্রযোজ্য না কারণ prop pass করা হয়েছে, নতুন context call না)।

**Verification:** `tsc --noEmit` clean, `eslint` clean (অবশিষ্ট lint error/warning গুলো `git stash` দিয়ে যাচাই করে pre-existing/unrelated প্রমাণ করা হয়েছে — landing-page-builder.tsx-এর impure-function এবং setState-in-effect rule violation গুলো এই session-এর আগে থেকেই ছিল), `npm run build` clean, `systemctl restart hybrid-frontend.service` + live smoke check (`/`, `/dashboard`, `/api/health` সব `200`, active CSS chunk `200`)।

## 18. bKash Payment Gateway — subscription billing অটোমেশন (2026-08-08, commit `5aaa7c7`)

§16.4-এর suggested scope অনুযায়ী শুরু: **শুধু platform-এর নিজের subscription billing** অটোমেট করা হয়েছে (customer-facing landing-page checkout online payment না — সেটা আলাদা, বড় স্কোপ, এখনো শুরু হয়নি)। বিদ্যমান manual flow (seller নিজে bKash-এ Send Money করে TrxID সাবমিট করে, admin ম্যানুয়ালি approve করে) পাশে অক্ষত রাখা হয়েছে fallback হিসেবে — নতুন গেটওয়ে flow শুধু আরেকটা অপশন।

**Architecture (Facebook integration-এর মতোই platform-level credential resolution pattern):**
- `platform_billing_settings`-এ bKash Tokenized Checkout credential যোগ (`bkash_app_key`/`bkash_app_secret`(encrypted)/`bkash_username`/`bkash_password`(encrypted)/`bkash_sandbox`) — single merchant account (platform-এর নিজের, per-seller না), DB→`.env` fallback (`PlatformFacebookSetting`-এর resolved*() pattern-এর অনুরূপ)।
- `BkashPaymentGatewayClient` (`app/Services/Payment/`) — grant/refresh token (platform-wide cache), createPayment/executePayment/queryPayment, sandbox/live base URL resolve করে।
- `SubscriptionActivationService` — `AdminSubscriptionController::approvePayment()`-এর inline activation logic বের করে আনা হয়েছে, যাতে manual admin-approve আর bKash auto-approve দুটোই একই ভাবে subscription extend করে (running subscription-এর বাকি দিন যোগ হয়, ওভাররাইট হয় না)।
- `BkashPaymentController`: `POST /subscription/pay/bkash/initiate` (auth, pending `SubscriptionPayment` বানিয়ে bKash-এ createPayment কল করে `bkashURL` রিটার্ন করে) + `GET /subscription/pay/bkash/callback` (**public route** — bKash সরাসরি ব্রাউজার রিডাইরেক্ট করে, `FacebookConnectController::callback()`-এর মতোই কোনো Sanctum token থাকে না; `bkash_payment_id`-দিয়ে সঠিক payment row খুঁজে বের করে)। Double-redirect/replay-এর বিরুদ্ধে idempotent (payment আগে থেকে `pending` না থাকলে re-execute করে না)।
- Admin (`/admin/billing`): bKash credential ফর্ম (blank secret/password = অপরিবর্তিত, Facebook admin settings-এর মতোই masking)। Seller (`/dashboard/settings/subscription`): "bKash দিয়ে সাথে সাথে পে করুন" বাটন (শুধু gateway configured থাকলে দেখা যায়), `?bkash_status=` রিডাইরেক্ট প্যারামিটার হ্যান্ডল করে success/failed/cancelled দেখায়।

**Verification:** সব নতুন controller/service tinker দিয়ে সরাসরি কল করে verify করা হয়েছে — `initiate()` unconfigured অবস্থায় সঠিক `422` দেয়, fake sandbox credential দিয়ে gracefully `502` + payment row `rejected` মার্ক হয় (কোনো crash/dangling state না), admin settings-এর blank-secret round-trip পুরনো মান ধরে রাখে। `tsc --noEmit` + `npm run build` clean, `php -l` clean সব ফাইলে। টেস্ট ডেটা (fake credentials, test payment row) সেশন শেষে DB থেকে মুছে ফেলা হয়েছে।

**⚠️ এখনো বাকি — real bKash merchant account ছাড়া live-test করা যায়নি:**
1. ~~bKash Merchant/Developer পোর্টাল থেকে sandbox credential সংগ্রহ~~ — ✅ resolved same session: bKash-এর নিজস্ব sandbox credential (username/password/app_key/app_secret) কোনো registration ছাড়াই publicly published (একাধিক independent source/blog/GitHub package-এ একই মান বহুদিন ধরে ব্যবহৃত হচ্ছে দেখা গেছে — developer.bka.sh নিজে বলে "sandbox is open for everyone", credential merchant-onboarding-এর সময় শেয়ার হওয়ার কথা কিন্তু এই publicly known set দিয়েই কাজ করেছে)।
2. ~~Sandbox credential বসিয়ে end-to-end test~~ — ✅ DONE, user নিজে `/admin/billing`-এ credential বসিয়ে test করেছে।
3. `tokenized.sandbox.bka.sh`/`v1.2.0-beta`/`tokenized/checkout/*` API contract — ✅ live call দিয়ে confirm হয়েছে, কোনো mismatch পাওয়া যায়নি (`createPayment()` সঠিক `bkashURL` রিটার্ন করেছে)।
4. Production-এ যাওয়ার আগে `bkash_sandbox` টগল off করে live credential বসাতে হবে — এখনো বাকি (business-এর real bKash merchant account লাগবে)।

### 18.1 Bug fix — bKash payment সফল হলেও "Pending" দেখাচ্ছিল (2026-08-08, commit `bac21cd`)

User real sandbox credential দিয়ে test করে bKash-এর নিজের checkout page-এ payment সফলভাবে সম্পন্ন করেছিল, কিন্তু `/dashboard/settings/subscription`-এর Payment History-তে সেটা `Pending` অবস্থায় আটকে ছিল, TrxID `-` (খালি)।

**Root cause:** `SubscriptionPayment` মডেলের `#[Fillable([...])]` attribute-এ `bkash_payment_id` কখনো যোগ করা হয়নি (migration কলামটা যোগ করেছিল, কিন্তু model-এর Fillable list আপডেট করা হয়নি)। ফলে `BkashPaymentController::initiate()`-এ `$payment->update(['bkash_payment_id' => $result['paymentID']])` কল silently no-op হয়ে যেত — কোনো exception/log ছাড়াই, কারণ এই অ্যাপে `Model::preventSilentlyDiscardingAttributes()` চালু নেই। bKash সরাসরি real paymentID+bkashURL দিয়ে সাড়া দিয়েছিল (checkout page ঠিকই কাজ করেছে), কিন্তু DB-তে `bkash_payment_id` কখনো সেভ হয়নি। bKash পরে `?paymentID=...&status=success` দিয়ে আমাদের callback route-এ ব্রাউজার রিডাইরেক্ট করলে, `SubscriptionPayment::where('bkash_payment_id', $paymentId)->first()` কিছুই খুঁজে পায়নি (কারণ DB-তে ওই কলাম null-ই ছিল) — `callback()` "payment not found" ব্রাঞ্চে পড়ে গিয়ে `?bkash_status=error`-এ রিডাইরেক্ট করত, row চিরকালের জন্য `pending`-এ আটকে থাকত।

**Debug trail:** nginx access log-এ callback hit স্পষ্ট দেখা গেছে (`GET /api/subscription/pay/bkash/callback?paymentID=...&status=success` → `302` → `?bkash_status=error`), তখনই নিশ্চিত হয় সমস্যা callback logic-এ না, row lookup-এ। `SubscriptionPayment::latest()->first()` দিয়ে DB-তে সরাসরি চেক করে `bkash_payment_id: null` পাওয়া যায় যদিও `initiate()` সফলভাবে real `bkashURL` রিটার্ন করেছিল — এখান থেকেই Fillable-এর সন্দেহ, এবং তাতেই নিশ্চিত হয়।

**ফিক্স:** `bkash_payment_id` যোগ করা হয়েছে `SubscriptionPayment`-এর Fillable list-এ। Live curl দিয়ে verify করা হয়েছে — `initiate()` কল করার পর row-এ এখন সঠিকভাবে `bkash_payment_id` সেভ হয়। টেস্ট payment row/token cleanup করা হয়েছে।

**শেখা:** নতুন column যোগ করার migration লিখলে model-এর Fillable list-ও একই কমিটে আপডেট করা — নাহলে silent data-loss (কোনো error লগ ছাড়াই) হতে পারে, বিশেষ করে এই কোডবেসে যেখানে `preventSilentlyDiscardingAttributes()` চালু নেই।

### 18.2 bKash classic "PGW" (Checkout API) support — real merchant credential turned out to be a different product (2026-08-09)

Business পেয়ে গেছে real bKash merchant credential — কিন্তু production live-test করতে গিয়ে ধরা পড়ল: bKash-এর ইস্যু করা credential আসলে §18-এ implement করা **Tokenized Checkout (v1.2.0-beta, tokenized.pay.bka.sh)**-এর জন্য না, বরং সম্পূর্ণ ভিন্ন, পুরনো product — bKash নিজেই একে **"PGW" / classic Checkout API** বলে (`checkout.pay.bka.sh/v1.2.0-beta`, একই version string কিন্তু আলাদা domain/endpoint/client-side flow)। দুই product-এর credential একে অপরের সাথে অচল — একটার key/secret দিয়ে আরেকটায় grant token করলে bKash `9999 Invalid app key and secret combination` (ভুল domain) বা `The username or password is incorrect` (ভুল password) রিটার্ন করে, generic error message হওয়ায় root cause বুঝতে ধাপে ধাপে debug লাগে।

**সিদ্ধান্ত (ব্যবসার owner-এর):** দুটো implementation-ই কোডে রাখা হলো (single config toggle দিয়ে সুইচযোগ্য), যাতে ভবিষ্যতে Tokenized credential পেলে কোনো নতুন কোড ছাড়াই switch করা যায়।

**নতুন architecture:**
- `platform_billing_settings.bkash_api_type` (`'tokenized'` default | `'pgw'`) — migration `2026_08_09_000000_...`, একই ৪টা credential field (app_key/app_secret/username/password) দুই product-এর জন্যই reuse হয়, শুধু base URL/endpoint resolve আলাদা হয়
- `app/Services/Payment/BkashPgwPaymentGatewayClient.php` — classic Checkout API client: `checkout.{sandbox,pay}.bka.sh/v1.2.0-beta`, endpoint path `/checkout/token/grant|payment/create|payment/execute/{id}|payment/query/{id}` (Tokenized-এর `/tokenized/checkout/...`-এর থেকে আলাদা prefix), এবং `scriptUrl()` (bKash-hosted `bKash-checkout.js`/`bKash-checkout-sandbox.js` widget script URL)
- `app/Http/Controllers/Api/BkashPgwPaymentController.php` — `create`/`execute`, **কোনো public redirect callback route নেই** (Tokenized flow-এর মতো bKash browser-কে আমাদের ডোমেইনে ফেরত পাঠায় না) — বদলে bKash-এর নিজস্ব JS widget সরাসরি এই দুটো endpoint-কে AJAX দিয়ে কল করে, seller সবসময় authenticated থাকা অবস্থায় (routes: `POST /subscription/pay/bkash-pgw/{create,execute/{paymentId}}`, `auth:sanctum` group-এ)
- **Frontend widget contract — সবচেয়ে বড় gotcha:** bKash-এর classic Checkout SDK কোনো container-এ markup inject করে না; বরং DOM-এ ইতিমধ্যে থাকা একটা নির্দিষ্ট ID-র element খুঁজে (`<button id="bKash_button">` — আন্ডারস্কোর, `<div>` না) তার সাথে নিজেই click handling bind করে (`bKash.init()` কল করার পরে)। প্রথম implementation-এ ভুলবশত Tokenized-স্টাইল `<div id="bKash-button">` (হাইফেন) ব্যবহার করা হয়েছিল যেটা সম্পূর্ণ silent failure দিয়েছিল — কোনো error, কোনো console warning ছাড়াই খালি/অক্লিকযোগ্য বাটন। Fix: exact `<button id="bKash_button">` (community demo verified)।
- `frontend/src/app/dashboard/settings/subscription/page.tsx` — `bkash_api_type === "pgw"` হলে script dynamically load করে (`<script>` tag inject, next/script ব্যবহার করা হয়নি), `bKash.init({ paymentMode:'checkout', paymentRequest, createRequest, executeRequestOnAuthorization, onClose })` কল করে — `createRequest`/`executeRequestOnAuthorization` ভিতরে bKash-কে সরাসরি কল না করে **আমাদের নিজের backend proxy endpoint**-কে কল করে (app_secret/password কখনো browser-এ পৌঁছায় না)
- Admin UI (`/admin/billing`): নতুন "bKash API type" dropdown (Tokenized Checkout vs PGW/Checkout API), একই credential field-গুলো reuse করে
- `merchantInvoiceNumber` format: `ZyroSub-{payment_id}` (বাংলাদেশি bKash SMS/statement-এ merchant order reference হিসেবে দেখা যায়)

**Live verification (real money, 2026-08-09):** ৳5 Starter package দিয়ে end-to-end টেস্ট — bKash popup ওপেন হয়েছে, real bKash account দিয়ে pay করা হয়েছে, `SubscriptionPayment` row `approved` (real `trx_id`), subscription `subscription_ends_at` সঠিকভাবে extend হয়েছে। `npm run deploy:prod:safe` 8/8 pass।

**ভবিষ্যতের জন্য নোট:** bKash merchant credential হাতে পেলে সবসময় প্রথমে confirm করা — Tokenized Checkout নাকি PGW/Checkout API (email/document-এ "Tokenized" vs "PGW"/"Checkout" শব্দ খুঁজুন) — দুটো product-এর credential/domain/client flow সম্পূর্ণ আলাদা, একটা ধরে নিয়ে implement শুরু করলে generic "invalid credential" error দিয়ে আটকে যাওয়ার ঝুঁকি আছে।
