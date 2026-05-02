# F-Commerce SaaS — Module Context

Last updated: 2026-05-02
Status: Phase 1 — 4/6 modules complete. Fraud Check + Blacklist remaining.

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
**Status:** Shell ready at `/dashboard/orders/fraud-check`

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

---

### 🔲 বাকি (Remaining in Phase 1)

#### P1-A: Fake Order / Fraud Detection

**Backend কাজ:**
- [ ] Migration: `customer_fraud_profiles` table
  ```
  id, user_id, phone, total_orders, delivered_count, cancelled_count,
  return_count, fraud_score (0-100), risk_level, last_updated
  ```
- [ ] Migration: `customer_blacklist` table
  ```
  id, user_id, phone, reason, blocked_at
  ```
- [ ] `FraudController.php` — routes:
  ```
  POST /api/fraud/check-phone      ← score একটি ফোন নম্বর
  GET  /api/fraud/blacklist         ← ব্লাকলিস্ট
  POST /api/fraud/blacklist         ← ব্লাকলিস্টে যোগ করুন
  DELETE /api/fraud/blacklist/{id}  ← সরান
  ```
- [ ] Fraud score algorithm (order history থেকে computed):
  ```
  +30  ফোনে 3+ অর্ডার এবং return rate > 40%
  +20  cancel rate > 40%
  +15  2+ বার same phone অন্য user-এর কাছেও returned
  -20  সফল delivery (trust signal)
  Score 0–30 → low, 31–60 → medium, 61+ → high
  ```
- [ ] Auto-fraud-score on order create (OrderController::store() এ hook)

**Frontend কাজ:**
- [ ] `/dashboard/orders/fraud-check/page.tsx` — phone search + fraud score card
  - Phone input → API call → স্কোর + risk badge + order history
  - Bulk check (paste multiple phones)
  - "Blacklist" বাটন
- [ ] `/dashboard/orders/blacklist/page.tsx` — blacklisted phones list
  - Table: phone, reason, date, remove button
  - Add to blacklist modal

---

#### P1-B: Dashboard Home (stat cards)

**Frontend কাজ:**
- [ ] `/dashboard/page.tsx` — এখনো placeholder
  - Today's orders, revenue, pending count, high-risk count
  - Quick actions: Create Order, Book Parcel
  - Recent orders mini-list

---

### Phase 1 সম্পন্ন হলে MVP হবে:
- ✅ পণ্য যোগ করা যাবে
- ✅ অর্ডার নেওয়া যাবে (manual + create wizard)
- ✅ কাস্টমার অটো-ট্র্যাক হবে
- ✅ Steadfast কুরিয়ার বুক করা যাবে
- 🔲 ফেক অর্ডার ধরা যাবে (Fraud Check)
- 🔲 ড্যাশবোর্ড হোম (stats overview)

---

### পরবর্তী কাজের অর্ডার (Recommended)

1. **Fraud Check** — `FraudController` + `/fraud-check` + `/blacklist` pages
2. **Dashboard Home** — stat cards + shortcuts
3. **Phase 2** শুরু → SMS Automation, Accounting
