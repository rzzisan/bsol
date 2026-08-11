# Staff / Team Sub-account Role — Work Context

এই ফাইলে **"Staff/Team sub-account role"** মডিউল সংক্রান্ত সব প্ল্যানিং, ডিজাইন সিদ্ধান্ত এবং implementation log লিপিবদ্ধ থাকবে (user-এর নির্দেশনা অনুযায়ী, `subscription_billing_context.md`-এর কনভেনশন অনুসরণ করে)। Master context: `CONTEXT.md` (server/ops), `SAAS_MODULE_CONTEXT.md` (§16.6-এ প্রাথমিক সুপারিশ হিসেবে উল্লেখিত, §25-এ `adminScopeUserIds()` pattern — এই মডিউলের মূল স্থাপত্য ভিত্তি)।

> **ফাইলের নাম নোট:** ইউজার অনুরোধ করা ফাইলনেম (`StaffÑTeamÑsub-account role.md`) filesystem-এ ব্যবহারযোগ্য না (`/` এনকোডিং সমস্যায় করাপ্ট হয়ে `Ñ` হয়ে গিয়েছিল, এবং `/` ফাইলনেমে বৈধ না)। প্রজেক্টের বাকি context ফাইলের কনভেনশন (`subscription_billing_context.md`, `landing_page_context.md`) অনুসরণ করে `staff_team_role_context.md` নামে রাখা হলো।

Last updated: 2026-08-10 — **Phase 1 + Phase 2 উভয়ই সম্পূর্ণ (backend + frontend), deploy করা হয়েছে এবং live browser + live HTTP round-trip দিয়ে verify করা হয়েছে** (Phase 1: §7-৮, Phase 2: §9)। মডিউল কভারেজ এখন সম্পূর্ণ: orders/products/customers/courier/sms/accounting/analytics/landing_pages/fraud/facebook। Implementation-এর সময় Order.user_id owner-keying আবিষ্কারের (§3.3 ⚠️/§7.1) downstream প্রভাব LandingPage/Fraud-এও ছড়িয়ে পড়ে ধরা পড়ে এবং ঠিক করা হয়েছে (§9.3) — এখন এটা একটা সাধারণ নিয়ম হিসেবে ডকুমেন্টেড। Support chat threading সিদ্ধান্ত (প্রতি-staff আলাদা থ্রেড) নেওয়া হয়েছে, কোনো কোড পরিবর্তন লাগেনি (§9.1)। বাকি: Phase 2-এর কোনো নতুন follow-up আইটেম নেই, শুধু mobile viewport visual QA এখনো tool-সীমাবদ্ধতার কারণে বাকি (§9.7)।

---

## ⚡ নতুন ফিচার/মডিউল তৈরি করার জন্য দ্রুত চেকলিস্ট (2026-08-10 যোগ হয়েছে)

**এই ফাইলটা এখন শুধু "Staff/Team role কীভাবে তৈরি হয়েছে" তার log না — ভবিষ্যতে নতুন যেকোনো ফিচার/মডিউল তৈরির সময় বাধ্যতামূলক reference।** CONTEXT.md §৩১-এ এই নিয়ম master rule হিসেবে আছে, বিস্তারিত এখানে। পুরো ফাইল না পড়ে দ্রুত শুরু করতে চাইলে এই চেকলিস্টটা যথেষ্ট (বিস্তারিত/উদাহরণের জন্য লিংক করা সেকশনে যাও):

1. নতুন resource **Pattern A না Pattern B** ঠিক করো (§3.3):
   - Pattern A (team-shared): reads `whereIn('user_id', auth()->user()->shopUserIds())`, writes `auth()->id()` অপরিবর্তিত (audit)।
   - Pattern B (owner-only singleton/credential): সবসময় `auth()->user()->shopOwnerId()`, কোনো `whereIn` না।
2. **⚠️ সবচেয়ে ভুল-প্রবণ জায়গা:** নতুন resource যদি Order/Customer/CourierSetting/SmsGateway-এর মতো কোনো Pattern-B resource-কে creator-এর `user_id` দিয়ে reference করে — সেই `user_id` সরাসরি trust কোরো না, `shopOwnerId()` resolve করো (§9.3-এর LandingPage/Fraud উদাহরণ দেখো — এই একই ভুল দুইবার প্রায় হয়ে যাচ্ছিল)।
3. নতুন module-level permission দরকার হলে `StaffPermission::MODULE_KEYS` (backend) + `STAFF_MODULE_KEYS` (frontend) দুই জায়গায় যোগ করো (§3.1, §9.4)।
4. Route-এ `staff_permission:{module}` বা `owner_only` middleware বসাও (§3.4, §9.4-এর routes/api.php উদাহরণ)।
5. Frontend মেনুতে নতুন আইটেম হলে `user-shell.tsx`-এর `MODULE_KEY_BY_MENU_ITEM` ম্যাপে যোগ করো (§9.5) — নাহলে default-deny-এ staff-এর কাছে hide হয়ে যাবে।
6. Owner-এর staff-management পেজে (`dashboard/settings/staff/page.tsx`) নতুন module থাকলে `MODULE_KEYS`/`moduleLabels`-এ যোগ করো (§9.5)।
7. Verify করার সময় staff account দিয়ে তিনটা কেস টেস্ট করো: granted→200, non-granted→403 `staff_permission_denied`, owner-only→403 `owner_only`।

---

## 0. Scope (user request, সংক্ষেপে)

`SAAS_MODULE_CONTEXT.md §16.6`-এ চিহ্নিত gap: বর্তমানে `users.role` শুধু `user`/`admin` — একটা shop-এর মধ্যে multiple staff/team member (order processing-এ সাহায্য করা কর্মী) রাখার কোনো সুবিধা নেই। ছোট F-commerce ব্যবসাতেও সাধারণত ২-৩ জন অর্ডার প্রসেস করে — এই ফিচার না থাকা মানে বড় সেলার retain করা কঠিন (স্টাফ নিয়োগ দিলে তারা platform ছাড়তে বাধ্য হয়)।

**লক্ষ্য:** Shop owner তার নিজের একাউন্টের অধীনে সীমিত-অনুমতির staff একাউন্ট তৈরি করতে পারবে, যারা owner-এর ডেটা (order/product/customer ইত্যাদি) দেখতে/পরিচালনা করতে পারবে owner-নির্ধারিত module-permission অনুযায়ী।

---

## 1. Design decisions — user confirm করেছে (2026-08-10)

চারটা প্রশ্ন জিজ্ঞাসা করে user-এর কাছ থেকে confirm করা হয়েছে:

| প্রশ্ন | সিদ্ধান্ত |
|---|---|
| Permission model | **Granular per-module toggle** — owner প্রতিটা staff-এর জন্য module-ভিত্তিক (orders/products/customers/courier/sms/accounting ইত্যাদি) আলাদা আলাদা access on/off করতে পারবে |
| Staff seat সীমা | **Package-ভিত্তিক সীমা** — `SubscriptionPackage`-এ নতুন `max_staff` ফিল্ড যোগ হবে, উচ্চ-মূল্যের প্যাকেজে বেশি seat — এটা ইচ্ছাকৃতভাবে subscription upsell lever হিসেবে ডিজাইন করা হচ্ছে |
| Staff account তৈরি পদ্ধতি | **Owner সরাসরি temp password দিয়ে তৈরি করবে** — কোনো email invite dependency নেই; owner নাম/ইমেইল/temp password দিয়ে সরাসরি একাউন্ট বানাবে, staff প্রথম লগইনে পাসওয়ার্ড বদলাতে বাধ্য হবে |
| MVP module scope | **Core module প্রথমে** — Phase 1: Orders, Products, Customers, Courier, SMS send/history। Phase 2 (পরে): Accounting, Analytics, Landing Pages, Fraud/Blacklist, Facebook leads |

---

## 2. বর্তমান কোডবেস অডিট (গ্রাউন্ড-ট্রুথ, এই সেশনে স্ক্যান করা)

| বিষয় | বর্তমান অবস্থা |
|---|---|
| `users.role` | migration `2026_04_24_120100_...`: `string('role', 20)->default('user')` — শুধু `'user'`/`'admin'` value ব্যবহার হয়, কোনো enum constraint নেই (plain string) |
| `User` model | `SoftDeletes` **আছে** (migration `2026_08_02_073851_add_soft_deletes_to_users_table.php` — §17.0 item 10 CRITICAL fix-এর অংশ হিসেবে যোগ হয়েছিল) — মানে owner→staff cascade delete design করার সময় soft-delete safety আছে ধরে নেওয়া যায় |
| Admin-shared resource scoping | `adminScopeUserIds()` pattern (CONTEXT.md §25) — প্রতিটা admin-shared controller-এ duplicate করা private helper: query-তে `whereIn('user_id', $this->adminScopeUserIds())`, কিন্তু `store()`-এ সবসময় `auth()->id()` (audit trail-এর জন্য)। **এই মডিউলের scoping architecture (নিচে §3.3) এই একই pattern-এর সরাসরি সম্প্রসারণ** — শুধু "admin pool"-এর বদলে "shop pool" (owner + staff) |
| Middleware alias (`bootstrap/app.php`) | `is_admin` → `EnsureUserIsAdmin`, `active_subscription` → `EnsureActiveSubscription` |
| `EnsureActiveSubscription` | GET/HEAD সবসময় pass; non-GET-এ `$request->user()->isSubscriptionExpired()` চেক করে সরাসরি request user-এর উপর — **staff-এর জন্য এটা ভাঙবে** (staff-এর নিজের কোনো subscription থাকবে না) — §3.5-এ fix প্ল্যান |
| Per-user resource controllers | Order/Product/Customer/Courier/SMS ইত্যাদি প্রায় সবই `where('user_id', auth()->id())` প্যাটার্নে — এই সবগুলোকে shop-pool-scoped করতে হবে (§3.3, §4) |

---

## 3. Architecture Plan

### 3.1 DB Schema

**Migration ১ — `users` টেবিলে staff fields:**
```php
$table->foreignId('owner_id')->nullable()->after('role')
    ->constrained('users')->cascadeOnDelete(); // self-referencing FK; owner soft-delete হলে staff-ও soft-delete cascade (SoftDeletes-এর সাথে সামঞ্জস্যপূর্ণ)
$table->string('staff_status', 20)->default('active'); // active|suspended — শুধু owner_id সেট থাকলে অর্থবহ
$table->boolean('must_change_password')->default(false); // temp-password flow-এর জন্য
```
`owner_id === null` → normal owner/admin account (backward compatible, সব existing user অপরিবর্তিত)। `owner_id` সেট → staff account।

**Migration ২ — নতুন টেবিল `staff_permissions`:**
```php
Schema::create('staff_permissions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained('users')->cascadeOnDelete(); // staff-এর নিজের user id
    $table->string('module_key', 40); // 'orders'|'products'|'customers'|'courier'|'sms'|'accounting'|'analytics'|'landing_pages'|'fraud'
    $table->boolean('enabled')->default(false); // default-deny — owner explicitly enable করলেই access
    $table->timestamps();
    $table->unique(['user_id', 'module_key']);
});
```
**গুরুত্বপূর্ণ:** `"staff"` (team-management) নিজেই কখনো একটা `module_key` হবে না — staff-management route সবসময় hard-coded owner-only থাকবে (§3.4), কোনো toggle দিয়ে grant করা যাবে না — privilege-escalation ঝুঁকি এড়ানোর জন্য।

**Migration ৩ — `subscription_packages`-এ seat limit:**
```php
$table->unsignedInteger('max_staff')->nullable()->after('duration_days'); // null = unlimited, 0 = staff feature বন্ধ এই প্যাকেজে
```

### 3.2 `User` model — নতুন helper method

```php
public function owner() { return $this->belongsTo(User::class, 'owner_id'); }
public function staffMembers() { return $this->hasMany(User::class, 'owner_id'); }
public function staffPermissions() { return $this->hasMany(StaffPermission::class); }

public function isStaff(): bool { return $this->owner_id !== null; }

public function shopOwnerId(): int { return $this->owner_id ?? $this->id; }

/** owner নিজে + তার সব staff — "shop pool" */
public function shopUserIds(): array
{
    $ownerId = $this->shopOwnerId();
    return static::where('id', $ownerId)->orWhere('owner_id', $ownerId)->pluck('id')->toArray();
}

public function hasStaffPermission(string $moduleKey): bool
{
    if (!$this->isStaff()) return true; // owner/admin সবসময় ফুল অ্যাক্সেস
    return $this->staffPermissions()->where('module_key', $moduleKey)->where('enabled', true)->exists();
}
```

### 3.3 দুই ধরনের scoping pattern — এই মডিউলের সবচেয়ে গুরুত্বপূর্ণ স্থাপত্য সিদ্ধান্ত

সব resource এক নিয়মে scope হবে না। প্রতিটা নতুন/পরিবর্তিত controller-এ প্রশ্ন করতে হবে: **"এই resource কি team-shared (multi-row) নাকি single owner-level singleton?"**

**Pattern A — Team-shared operational data** (`whereIn` — `adminScopeUserIds()`-এর হুবহু অনুরূপ):
- Query: `where('user_id', auth()->id())` → `whereIn('user_id', auth()->user()->shopUserIds())`
- `store()`/`create()`: **অপরিবর্তিত** `'user_id' => auth()->id()` (staff নিজের id দিয়ে সেভ হয় — audit trail ফ্রি পাওয়া যায়, কারণ `shopUserIds()`-এ staff নিজেও অন্তর্ভুক্ত থাকায় read scoping ভাঙে না)
- প্রযোজ্য: Orders, Products (+categories/media/variants), Customers, Courier bookings/tracking, SMS send history, Accounting transactions, Landing pages, Fraud/blacklist

**Pattern B — Owner-level singleton/wallet resource** (`auth()->id()` → `auth()->user()->shopOwnerId()`, কোনো `whereIn` না, শুধু single id resolve):
- সরাসরি owner-এর resource ব্যবহার হয়, staff-এর নিজস্ব আলাদা কোনো row তৈরি হয় না
- প্রযোজ্য: SMS credit wallet balance/deduction (`SmsCreditService`-এ userId param সবসময় `shopOwnerId()`), Subscription/billing, Courier account credentials (settings), SMS gateway assignment, Shop profile settings
- এই resource-গুলোর **settings/management UI staff-এর জন্য একদমই খোলা থাকবে না** (permission toggle দিয়েও না) — শুধু "ব্যবহার" (যেমন staff SMS পাঠালে owner-এর wallet থেকে কাটবে) অনুমোদিত হতে পারে `sms` module permission থাকলে, কিন্তু গেটওয়ে কনফিগারেশন/রিচার্জ/সাবস্ক্রিপশন পেজ কখনোই না

> **⚠️ Implementation-এর সময় সংশোধন (§7.1-এ বিস্তারিত):** পরিকল্পনার সময় ধরে নেওয়া হয়েছিল Orders/Customers পুরোপুরি Pattern A (row-এর `user_id` = আসল acting staff-এর id)। কোড লেখার সময় ধরা পড়ে যে courier booking/tracking provider-গুলো (`app/Services/Courier/*CourierProvider.php`) credential resolve করে সরাসরি `$order->user_id` দিয়ে — যদি সেটা staff-এর id হতো, courier booking ভেঙে যেত (staff-এর কোনো courier credential নেই)। তাই **`Order.user_id` এবং `Customer.user_id` উভয়ই সবসময় shop owner id** (Pattern B-এর মতো single canonical key), কিন্তু read/write access পুরো shop pool-এর জন্য shared থাকে (`whereIn(shopUserIds())` সবসময় owner id-কে খুঁজে পায় যেহেতু owner নিজেও pool-এর সদস্য) — তাই কার্যকরভাবে "Pattern A-স্টাইল shared access, Pattern B-স্টাইল canonical FK"। আসল actor (কে বানিয়েছে/বদলেছে) audit trail `OrderStatusLog.changed_by` কলামে (আগে থেকেই বিদ্যমান) রেকর্ড থাকে, `Order.user_id` কলামে না। এই সংশোধনের সুবিধা: pre-existing courier/accounting/fraud/SMS-automation লজিক যেগুলো `$order->user_id` reference করে, সেগুলোর **একটাও touch করতে হয়নি** — automation trigger matching (`SmsAutomationRule::where('user_id', $order->user_id)`-জাতীয় কোড) নিজে থেকেই owner-এর rule খুঁজে পায়।

### 3.4 Middleware

`bootstrap/app.php`-এ নতুন alias:
```php
'staff_permission' => EnsureStaffPermission::class, // param: module key, e.g. staff_permission:orders
'owner_only'       => EnsureShopOwner::class,        // isStaff() হলে 403 — billing/staff-management/shop-settings রুটে
```
- `EnsureStaffPermission` — owner/admin হলে সবসময় pass; staff হলে `hasStaffPermission($param)` চেক করে, না থাকলে 403
- `EnsureShopOwner` — `isStaff()` true হলে unconditional 403 (permission table-এ কী আছে তা দেখেও না — hard rule)

### 3.5 `EnsureActiveSubscription` পরিবর্তন

বর্তমান কোড সরাসরি `$request->user()->isSubscriptionExpired()` চেক করে — staff account-এর নিজস্ব `subscription_ends_at` কখনো সেট হবে না বলে এটা ভুলভাবে সবসময় block করবে। ফিক্স:
```php
$user = $request->user();
$ownerId = $user->shopOwnerId();
$subscriptionOwner = $ownerId === $user->id ? $user : User::find($ownerId);
if ($subscriptionOwner && $subscriptionOwner->isSubscriptionExpired()) { ... }
```

### 3.6 Seat limit enforcement

`StaffController::store()`-এ নতুন staff তৈরির আগে:
```php
$owner = auth()->user(); // staff কখনো staff তৈরি করতে পারবে না, owner_only middleware দিয়ে already gated
$package = $owner->subscriptionPackage;
$maxStaff = $package?->max_staff; // null = unlimited
if ($maxStaff !== null) {
    $currentCount = User::where('owner_id', $owner->id)->where('staff_status', '!=', 'removed')->count();
    if ($currentCount >= $maxStaff) {
        return 422 "আপনার বর্তমান প্যাকেজে সর্বোচ্চ {$maxStaff} জন staff রাখা যাবে — আপগ্রেড করুন";
    }
}
if ($maxStaff === 0) { return 422 "আপনার প্যাকেজে staff ফিচার অন্তর্ভুক্ত না"; }
```

### 3.7 Temp password creation flow

Email dependency নেই (user সিদ্ধান্ত) — `StaffController::store(name, email, temp_password?)`:
- Owner নিজে temp password টাইপ করতে পারবে, অথবা "Generate" বাটনে auto-random password (frontend-এ once দেখানো হবে, copy-to-clipboard) — backend শুধু hash করে সেভ করে, plaintext কখনো DB-তে থাকবে না
- নতুন `User` row: `owner_id = auth()->id()`, `role = 'user'`, `must_change_password = true`, email/mobile verification bypass (owner নিজে তৈরি করেছে বলে verified ধরে নেওয়া হবে — `email_verified_at = now()`)
- Login flow অপরিবর্তিত (existing `AuthController::login`) — staff নিজের email+temp password দিয়ে লগইন করবে
- **Force password change:** `must_change_password = true` থাকলে নতুন middleware (`ForcePasswordChange`, `auth:sanctum` গ্রুপে global, কিন্তু password-change endpoint নিজে exclude) — অন্য যেকোনো route হিট করলে `403 { error_code: "must_change_password" }`, ফ্রন্টএন্ড এই কোড দেখলে বাধ্যতামূলক password-change স্ক্রিন দেখাবে
- Password change সফল হলে `must_change_password = false`

### 3.8 Token revocation (নিরাপত্তা — mandatory)

Staff suspend/remove করলে শুধু `staff_status` ফ্ল্যাগ বদলালেই যথেষ্ট না — ইতিমধ্যে ইস্যু করা Sanctum token দিয়ে এখনো authenticate করা যাবে। `StaffController::update()` (status → suspended) ও `destroy()` — দুটোতেই `$staffUser->tokens()->delete()` বাধ্যতামূলক কল করতে হবে। এছাড়া `EnsureStaffPermission`/general auth middleware-এ প্রতি রিকোয়েস্টে `staff_status === 'active'` চেক (suspended হলে 403, এমনকি পুরনো token থাকলেও)।

---

## 4. Phase plan

### Phase 1 — Foundation + Core modules (MVP)

**Backend:**
1. ৩টা migration (§3.1)
2. `User` model helper methods (§3.2), নতুন `StaffPermission` model
3. `StaffController` (owner-only): `index` (staff list + permission summary), `store` (create + seat-limit check), `update` (permissions/status), `resetPassword` (নতুন temp password + `must_change_password=true`), `destroy` (soft-delete + token revoke)
4. Middleware: `EnsureStaffPermission`, `EnsureShopOwner`, `ForcePasswordChange` + alias রেজিস্ট্রেশন
5. `EnsureActiveSubscription` fix (§3.5)
6. `AuthController::login`/`me` response-এ যোগ: `is_staff`, `must_change_password`, `owner_name` (staff হলে), `permissions: {module_key: bool}[]`
7. Core controller migration (Pattern A, §3.3) + route-এ `staff_permission:{module}` middleware যোগ:
   - `OrderController` + related (status, bulk-status, stats)
   - `ProductController`, `ProductCategoryController`, `ProductMediaController`, `ProductVariantController`
   - `CustomerController`
   - `CourierController` (booking/tracking/bulk — courier **account credentials/settings route Pattern B, owner-only, staff scope-এর বাইরে**)
   - SMS send/history route (`sms` module) — `SmsCreditService`-এ deduct call `shopOwnerId()` দিয়ে (Pattern B wallet)

**Frontend:**
1. `/dashboard/settings/staff` পেজ (owner-only, menu-তে `owner_only` হলে hide) — staff list card, "Add staff" মডাল (name/email/temp-password generate/permission checkbox grid), edit/suspend/remove, seat usage indicator ("২/৫ staff ব্যবহৃত" + প্যাকেজ আপগ্রেড CTA লিমিট ছুঁলে)
2. Force-password-change গার্ড — `/me` রেসপন্সে `must_change_password: true` দেখলে পুরো dashboard-এর আগে বাধ্যতামূলক password-change স্ক্রিন
3. `UserShell` — মেনু আইটেম `permissions` অনুযায়ী filter (staff হলে যে module permission নেই সেটার মেনু hide), topbar-এ "টিম মেম্বার — {owner_name}-এর শপ" badge
4. Design system rules (CONTEXT.md §22) — bilingual, mobile-first, dark/light, token color — বাধ্যতামূলক

### Phase 2 — ✅ সম্পন্ন (2026-08-10, বিস্তারিত §9)

Pattern A scoping + `staff_permission` middleware সম্প্রসারণ — সব সম্পন্ন:
- Accounting/Transactions
- Analytics (read-only module — `analytics` permission শুধু view gate করে)
- Landing Pages + Media Library + Landing Page Analytics + Abandoned Checkout (একটাই `landing_pages` module-এ গ্রুপ করা হয়েছে)
- Fraud Check + Blacklist + Courier-based fraud check
- Facebook — connect/pixel settings owner-only (Pattern B, courier settings-এর মতো), leads/reply-templates নতুন `facebook` module permission-এ (Pattern A shared)
- Support chat — user সিদ্ধান্ত: **প্রতিটা staff-এর জন্য আলাদা থ্রেড** (বিদ্যমান `unique(user_id)` constraint স্বাভাবিকভাবেই এটা দেয়) — কোনো কোড পরিবর্তন লাগেনি, দেখো §9.1

---

## 5. Verification checklist (প্রতিটা Phase শেষে, আগের কাজের মতোই)

- Rollback-wrapped tinker: seat-limit enforcement, permission enabled/disabled গেট সঠিকভাবে কাজ করছে কিনা, token revoke সাসপেন্ড/রিমুভে কার্যকর হচ্ছে কিনা, `shopUserIds()` owner+staff দুই দিকেই সঠিক সেট রিটার্ন করছে কিনা
- `php artisan route:list` — নতুন middleware সঠিকভাবে assign হয়েছে কিনা
- Security test: staff দিয়ে সরাসরি `/api/admin/*`, `/api/subscription/*`, `/api/staff` (owner-only) হিট করে 403 কনফার্ম; suspended staff-এর পুরনো token দিয়ে রিকোয়েস্ট → 403
- `npm run deploy:prod:safe` 8/8 pass + live smoke check

---

## 6. Execution order (এই কনভারসেশনে)

1. ✅ Design decision confirm (§1) + audit (§2) + প্ল্যান লেখা (এই ফাইল) — সম্পন্ন
2. ✅ Phase 1 backend implementation — সম্পন্ন (§7)
3. ✅ Phase 1 frontend implementation — সম্পন্ন (§8)
4. ✅ Phase 1 deploy + live verify — সম্পন্ন (§8.4, একই সেশনে backend fix + frontend deploy একসাথে)
5. ✅ Phase 2 backend + frontend implementation + deploy + live verify — সম্পন্ন (§9)
6. ✅ Phase 1 follow-up (dashboard home Quick Access permission-gate) — সম্পন্ন (§9.2)

---

## 7. Phase 1 — Backend Implementation log (2026-08-10)

### 7.1 নতুন/পরিবর্তিত ফাইল

**নতুন migration:**
- `2026_08_10_100000_add_staff_fields_to_users_table.php` — `users.owner_id`(self-FK, cascadeOnDelete)/`staff_status`/`must_change_password`
- `2026_08_10_100001_create_staff_permissions_table.php` — §3.1 অনুযায়ী হুবহু
- `2026_08_10_100002_add_max_staff_to_subscription_packages_table.php` — `subscription_packages.max_staff`

**নতুন Model:** `app/Models/StaffPermission.php` (`MODULE_KEYS` constant — single source of truth, `"staff"` deliberately absent)

**পরিবর্তিত Model:**
- `app/Models/User.php` — Fillable-এ `owner_id/staff_status/must_change_password` যোগ, নতুন relation (`owner/staffMembers/staffPermissions`), হেল্পার (`isStaff/shopOwnerId/shopOwner/shopUserIds/hasStaffPermission`) — §3.2 প্ল্যান অনুযায়ী, প্লাস নতুন `shopOwner(): User` (plan-এ ছিল না, implementation-এর সময় দরকার পড়েছে — subscriptionPackage-এর মতো owner-level relation object পড়ার জন্য, শুধু id না)
- `app/Models/SubscriptionPackage.php` — Fillable-এ `max_staff`
- `app/Models/Order.php` — `generateOrderNumber()` এখন `int|array $shopUserIds` নেয় (§7.1-এর ⚠️ নোট অনুযায়ী shop-wide sequential numbering-এর জন্য)
- `app/Models/Customer.php` — `syncFromOrder()`/`orders()` relation shop-owner-id দিয়ে canonical key করে (§7.1 নোট)

**নতুন Middleware:** `EnsureStaffPermission.php`, `EnsureShopOwner.php`, `ForcePasswordChange.php` (§3.4/§3.7 প্ল্যান অনুযায়ী হুবহু)

**পরিবর্তিত Middleware:** `EnsureActiveSubscription.php` (§3.5 অনুযায়ী)

**পরিবর্তিত:** `bootstrap/app.php` — `staff_permission`/`owner_only`/`force_password_change` alias যোগ

**নতুন Controller:** `app/Http/Controllers/Api/StaffController.php` — `index/store/update/resetPassword/destroy`, সব §3.6/§3.7/§3.8 প্ল্যান অনুযায়ী (seat-limit, token-revoke, ownership-check)

**পরিবর্তিত:** `app/Http/Controllers/AuthController.php` — `login()`/`me()`-এ `is_staff/must_change_password/owner_name/permissions` যোগ (নতুন private `staffAuthContext()`), `updateProfile()`-এ পাসওয়ার্ড বদলালে `must_change_password=false` auto-clear, `login()`-এ suspended-staff reject

**পরিবর্তিত routes/api.php:** নতুন `/staff` (owner-only) route group; `staff_permission:{module}` middleware — orders/products(+categories/media/variants)/customers/courier(booking-tracking অংশ)/sms(send+automation); `owner_only` middleware — courier settings, subscription (পুরো ব্লক), sms/credit purchase (পুরো ব্লক)

**Pattern A scoping refactor (auth()->id() → whereIn(shopUserIds()), store()-এ audit id অক্ষত):**
- `OrderController.php`, `CustomerController.php`, `ProductController.php`, `ProductCategoryController.php`, `ProductMediaController.php`, `ProductVariantController.php`, `CourierController.php` (booking/tracking অংশ), `AdminSmsGatewayController.php::myHistory`, `SmsAutomationController.php`

**Pattern B resolution (auth()->id() → shopOwnerId()):**
- `CourierController.php` (settings/credentials + সব provider service call — cities/zones/areas/stores/price ইত্যাদি, ২৪টা call site)
- `AdminSmsGatewayController.php` — gateway assignment (`shopOwner()->sms_gateway_id`) + SMS credit wallet (`getBalance`/`deduct`)

### 7.2 Verification (এই সেশনেই সম্পন্ন)

- `php -l` — সব নতুন/পরিবর্তিত ফাইলে (২৪টা) clean
- `php artisan migrate --force` — ৩টা migration সফল
- `php artisan route:list -v` দিয়ে middleware chain কনফার্ম: `/api/staff/*` → `EnsureShopOwner`; `/api/orders`, `/api/sms/automation/*` → `EnsureStaffPermission:{module}`; `/api/courier/settings*`, `/api/subscription/*` → `EnsureShopOwner`
- **Rollback-wrapped tinker test** (real DB row, transaction rollback করে): owner vs staff `isStaff()/shopOwnerId()/hasStaffPermission()` সঠিক; `shopUserIds()` owner ও staff উভয় দিক থেকে কল করলে identical pool রিটার্ন করে; seat-limit (package `max_staff=2`) সঠিকভাবে ২ জনের পর reached দেখায়; `shopOwner()` staff/owner উভয় ক্ষেত্রে সঠিক; **Order/Customer owner-id keying** — order তৈরি করে `user_id === owner id` কনফার্ম, staff-এর `shopUserIds()` দিয়ে `whereIn` query সেই order খুঁজে পায় কনফার্ম, `Customer::syncFromOrder()` canonical owner id ব্যবহার করে কনফার্ম; token revoke (`tokens()->delete()`) কার্যকর — সব pass, শেষে rollback, orphan test-data zero কনফার্ম করা হয়েছে
- বিদ্যমান normal (non-staff) user স্যাম্পল করে regression-check: `isStaff()=false, shopOwnerId()=self, shopUserIds()=[self]` — backward compatible কনফার্ম
- Final grep sweep — সব পরিবর্তিত controller-এ অবশিষ্ট `auth()->id()` শুধু ইচ্ছাকৃত audit-write/storage-path জায়গায় (৮টা, সব review করে confirm করা হয়েছে)

### 7.3 এই সেশনে (backend) যা করা হয়নি — পরের সেশনে (§8) সম্পন্ন হয়েছে

- ~~Frontend~~ ✅ §8-এ সম্পন্ন
- ~~Deploy + live smoke check~~ ✅ §8.4-এ সম্পন্ন
- Phase 2 module scoping (Accounting/Analytics/Landing Pages/Fraud/Facebook/Support chat) — এখনো বাকি

---

## 8. Phase 1 — Frontend Implementation log (2026-08-10, একই দিন)

### 8.1 নতুন/পরিবর্তিত ফাইল

**পরিবর্তিত:** `frontend/src/lib/dashboard-client.ts` — `AuthUser`-এ `is_staff/must_change_password/owner_name/permissions` (optional, sibling-key API response থেকে merge করতে হয়, `user` object-এর ভেতরে না)। নতুন এক্সপোর্ট: `STAFF_MODULE_KEYS`, `hasModuleAccess(user, moduleKey)`, `mergeAuthPayload(payload)`।

**পরিবর্তিত:** `frontend/src/app/page.tsx` (হোমপেজ লগইন ফর্ম) — `persistAuth()` এখন পুরো `/login` response নেয় (`data.user` না) এবং `mergeAuthPayload()` দিয়ে flatten করে store করে।

**পরিবর্তিত:** `frontend/src/components/catv-shell.tsx` — টপবার-এ staff হলে `displayMeta`-তে "· টিম মেম্বার (owner name)" সাফিক্স যোগ (bn/en)। প্রোফাইল-সেভ handler (`handleProfileSave`)-এ fix: `PUT /me` রেসপন্স-এ `is_staff/owner_name/permissions` sibling key থাকে না (relation-derived, real column না) — তাই নতুন `data.user`-কে existing state-এর উপর merge করে (replace না), নাহলে সাধারণ নাম/ইমেইল এডিটেও staff-এর permission set হারিয়ে যেত।

**পরিবর্তিত:** `frontend/src/components/user-shell.tsx` — বড় পরিবর্তন:
- `/me` background-sync effect এখন `mergeAuthPayload()` ব্যবহার করে
- নতুন `filterMenuForStaff()` — staff হলে শুধু Phase-1-gated ৫টা মডিউল (orders/products/customers/courier/sms) + dashboard home দেখায়, বাকি সব group (landing-pages, analytics, accounting, settings, facebook-leads, abandoned-checkouts) hide করে (কারণ সেগুলো Phase 2-এ এখনো backend-gated না, দেখালে খালি স্ক্রিন দেখাত)
- Settings গ্রুপে নতুন "টিম / স্টাফ" মেনু আইটেম (owner-only, staff-filtering-এর মাধ্যমে auto-hidden staff-দের কাছে)
- নতুন `ForcePasswordChangeScreen` কম্পোনেন্ট — `user.must_change_password === true` হলে পুরো dashboard-এর বদলে full-screen, non-dismissible পাসওয়ার্ড-বদল ফর্ম দেখায় (`PUT /me` কল করে, সফল হলে local state আপডেট করে dashboard আনলক করে) + লগআউট অপশন

**নতুন:** `frontend/src/app/dashboard/settings/staff/page.tsx` (owner-only) — হিরো কার্ড (seat usage progress bar), স্টাফ লিস্ট (status pill, must-change-password badge, permission chip, edit/reset-password/suspend-activate/remove action), Add/Edit modal (permission checkbox grid, custom বা auto-generate temp password), Credential-reveal modal (একবারই দেখানো temp password, copy বাটন) — সব বিদ্যমান design token/`catv-panel`/lucide-icon প্যাটার্ন অনুসরণ করে।

### 8.2 Design সিদ্ধান্ত (implementation-time)

- Dashboard home page (`/dashboard/page.tsx`)-এর "Quick Access" শর্টকাট গ্রিড touch করা হয়নি — permission-gate করা হয়নি, শুধু sidebar মেনু ফিল্টার করা হয়েছে। ফলে zero-permission staff dashboard home-এ এখনো সব শর্টকাট টাইল দেখে (ক্লিক করলে backend 403 দেয়, তাই কোনো ডেটা-লিক নেই, শুধু একটা minor UX rough edge) — **Phase 1-এর explicitly-scoped ফাইল লিস্টের বাইরে, ইচ্ছাকৃতভাবে touch করা হয়নি**, ভবিষ্যতে চাইলে ছোট ফলো-আপ হিসেবে ঠিক করা যাবে।
- Dashboard body content-এর bn/en toggle "মাউন্টের পর সাথে সাথে re-render হয় না, reload লাগে" — এটা landing_page_context.md §17-এ ডকুমেন্টেড established (bug না) আচরণ, staff page-এও একই আচরণ পাওয়া গেছে (browser QA-তে যাচাই করা হয়েছে, reload করলে ঠিক ভাষা দেখায়) — নতুন কোনো বাগ না।

### 8.3 একটা middleware বাগ ধরা পড়ে সাথে সাথে ফিক্স হয়েছে

Live HTTP round-trip test করার সময় ধরা পড়ে: `ForcePasswordChange::ALLOWED_PATHS = ['me', 'user', 'logout']` — কিন্তু Laravel-এর `Request::is()` পুরো path ম্যাচ করে framework-এর `api` prefix সহ (`bootstrap/app.php`-এর `withRouting(api: ...)` ডিফল্টে `apiPrefix: 'api'` যোগ করে) — তাই আসল request path হয় `api/me`, `api/user`, `api/logout`। ফলে staff-এর `GET /me` কলও ভুলভাবে `403 must_change_password` পেত, force-password-change screen নিজেই dead-lock হয়ে যেত (staff নিজের state read করতে না পেরে আটকে থাকত)। **Fix:** `ALLOWED_PATHS = ['api/me', 'api/user', 'api/logout']`। কোনো cache clear লাগেনি (route:cache/config:cache সক্রিয় না এই deployment-এ)।

### 8.4 Verification (এই সেশনেই সম্পন্ন)

- `npx tsc --noEmit` clean, `npm run build` (ESLint সহ) clean — ৬৩টা রুট, `/dashboard/settings/staff` নতুন স্ট্যাটিক রুট হিসেবে দেখা গেছে
- `sudo -n .../deploy-safe.sh` — 8/8 ধাপ pass, `hybrid-frontend.service` active
- Live smoke check: `/`, `/api/health`, `/dashboard/settings/staff` সব `200`
- **Live HTTP round-trip** (`bsol.zyrotechbd.com`, curl দিয়ে, seeded owner+package+staff, সেশন শেষে সব DB থেকে মুছে ফেলা হয়েছে):
  - Owner লগইন → `is_staff:false`
  - Owner `POST /staff` দিয়ে staff তৈরি → seat usage/permissions/temp_password সঠিক রেসপন্স
  - Staff লগইন → `is_staff:true, must_change_password:true, owner_name, permissions` সব সঠিক
  - `must_change_password=true` অবস্থায় `/orders` (permission থাকা সত্ত্বেও) → `403 must_change_password` (middleware bug ধরা এখানেই, §8.3)
  - `PUT /me` দিয়ে পাসওয়ার্ড বদল → `must_change_password` → `false`
  - পাসওয়ার্ড বদলের পর `/orders` (granted) → `200`; `/customers` (not granted) → `403 staff_permission_denied`; `/subscription/me`, `/staff`, `/courier/settings` (owner-only) → সব `403 owner_only`
  - **Order/Customer owner-keying লাইভ কনফার্ম:** staff দিয়ে অর্ডার তৈরি করে `order.user_id === owner_id` (স্টাফের নিজের id না) দেখা গেছে; owner সেই অর্ডার দেখতে পারে (shared visibility); `Customer::syncFromOrder()`-ও owner id দিয়ে key হয়েছে কনফার্ম
  - Owner staff-কে suspend করলে পুরনো token সাথে সাথে `401` (token revoke কার্যকর)
  - সব টেস্ট user/package/permission/token শেষে DB থেকে মুছে ফেলা হয়েছে এবং zero-remaining কনফার্ম করা হয়েছে
- **লাইভ ব্রাউজার QA** (claude-in-chrome দিয়ে, নতুন seeded owner + ২টা staff [একটা must_change_password=true, একটা permission-granted] দিয়ে, session শেষে সব cleanup):
  - Owner-এর `/dashboard/settings/staff` পেজ light+dark, bn+en — hero card, seat progress bar, staff list (status/permission chip), Add-staff মডাল (checkbox grid) — সব সঠিকভাবে রেন্ডার হয়েছে
  - Force-password-change screen (staff, temp password দিয়ে) — full-screen gate সঠিকভাবে দেখা গেছে, ফর্ম সাবমিট করে dashboard আনলক হওয়া পর্যন্ত **প্রকৃত ব্রাউজার ফ্লো দিয়ে** কনফার্ম করা হয়েছে
  - Team-member header badge ("Staff Gate QA · Team member (ডিজাইন QA Owner)") সঠিকভাবে দেখা গেছে
  - Sidebar menu filtering লাইভ কনফার্ম: zero-permission staff শুধু "Dashboard" দেখে; orders/products/courier-granted staff ঠিক সেই তিনটা group + Dashboard দেখে (customers/sms/landing-pages/analytics/accounting/settings — সব হাইড)
  - টেস্ট user/package/token সব session শেষে মুছে ফেলা হয়েছে এবং delete confirm করা হয়েছে

### 8.5 এই সেশনে যা করা হয়নি (out of scope / ভবিষ্যতের ফলো-আপ)

- ~~Dashboard home page "Quick Access" গ্রিড permission-gate করা~~ ✅ §9.2-এ সম্পন্ন
- Mobile viewport visual QA (আগের phase-গুলোর মতো একই tool সীমাবদ্ধতা — remote Chrome window resize কাজ করেনি)
- ~~Phase 2 module scoping~~ ✅ §9-এ সম্পন্ন

---

## 9. Phase 2 — Implementation log (2026-08-10, নতুন সেশন)

User request: "Phase 1 backend এবং frontend এর কোন কিছু implementation বাকি থাকলে সেটি শুরু কর। এরপর Phase 2 backend এবং frontend implementation শেষ করার পর কমিট পুশ কর।"

### 9.1 Support chat সিদ্ধান্ত (Phase 2 শুরুর আগে user-কে জিজ্ঞাসা করা হয়েছিল, §4-এ flag করা ছিল)

**সিদ্ধান্ত: প্রতিটা staff-এর জন্য আলাদা থ্রেড।** `support_conversations.unique(user_id)` constraint এমনিতেই প্রতিটা user (owner বা staff, উভয়ের নিজস্ব `id`) এর জন্য আলাদা থ্রেড দেয় — **কোনো ব্যাকএন্ড/ফ্রন্টএন্ড কোড পরিবর্তন লাগেনি**, শুধু `SupportController`-এর বিদ্যমান `auth()->id()`-based scoping ইচ্ছাকৃতভাবে অপরিবর্তিত রাখা হয়েছে (এটাই সঠিক আচরণ এই সিদ্ধান্তে)। Admin inbox-এ প্রতি শপ একাধিক থ্রেড (owner + প্রতিটা staff) হিসেবে দেখা যাবে — এটাই expected।

### 9.2 Phase 1 follow-up — Dashboard home "Quick Access" gating

`frontend/src/app/dashboard/page.tsx` — প্রতিটা shortcut item-এ `module: StaffModuleKey` ট্যাগ যোগ করে `hasModuleAccess()` দিয়ে ফিল্টার (`visibleShortcuts` memo)। সব shortcut বাদ পড়লে পুরো "Quick Access" section hide হয়।

### 9.3 স্থাপত্যগত আবিষ্কার — Order owner-keying-এর প্রভাব LandingPage/Fraud-এও ছড়িয়ে পড়ে

Phase 1-এর §3.3/§7.1 আবিষ্কারের (Order.user_id সবসময় owner id) একটা downstream প্রভাব এই সেশনে ধরা পড়ে এবং ঠিক করা হয়েছে:

- **`LandingPageOrderService::create()`** — আগে সরাসরি `$page->user_id` ব্যবহার করত Order-এর `user_id`/order-number generation-এর জন্য। যেহেতু landing page staff তৈরি করতে পারে (Pattern A, creator-keyed রাখা হয়েছে audit trail-এর জন্য), সরাসরি `$page->user_id` ব্যবহার করলে staff-তৈরি landing page থেকে আসা অর্ডারের `user_id` staff-এর id হয়ে যেত — courier booking ভেঙে যেত। **Fix:** `$page->user?->shopOwnerId()` রিজলভ করে ব্যবহার — landing page নিজে Pattern A থাকে, কিন্তু downstream Order সবসময় owner-keyed।
- **`CheckoutOtpService::maybeSendForOrder()`** — একইভাবে `$page->user_id` দিয়ে SMS gateway/credit wallet resolve করত (Pattern B রিসোর্স, staff-এর জন্য ভাঙত)। **Fix:** যেহেতু এতক্ষণে `$order->user_id` ইতিমধ্যে owner-resolved, সরাসরি `User::find($order->user_id)` ব্যবহার — কোনো অতিরিক্ত resolve লাগেনি।
- **`FraudController`/`CourierFraudCheckController`** — `customer_fraud_profiles`/`customer_blacklist` টেবিল shop-wide singleton রিসোর্স (Order/Customer-এর মতো) — `auth()->id()` না, `auth()->user()->shopOwnerId()` ব্যবহার করতে হয়েছে (single-value resolve, `whereIn` না — কারণ এটা owner-keyed singleton, multi-creator shared array না)।
- **`AbandonedCheckoutController::attachCustomerValue()`** — `Customer` টেবিল owner-keyed (Phase 1-এ প্রতিষ্ঠিত) বলে, এই helper-এ owner id resolve করে পাঠাতে হয়েছে যদিও মূল `AbandonedCheckout` query নিজে shopUserIds()-দিয়ে shared (Pattern A)।

এই প্যাটার্নটা এখন স্পষ্ট নিয়ম হিসেবে ডকুমেন্ট করা গেল: **"যেকোনো downstream resource যেটা Order/Customer/CourierSetting/SmsGateway-এর মতো owner-keyed singleton টেবিল রেফারেন্স করে, সবসময় `shopOwnerId()` (single value) ব্যবহার করতে হবে, `$creatorRow->user_id` সরাসরি trust করা যাবে না — এমনকি সেই creator row নিজে Pattern A (multi-creator shared) হলেও।"**

### 9.4 Backend — নতুন/পরিবর্তিত ফাইল

- **`StaffPermission::MODULE_KEYS`** — নতুন `'facebook'` key যোগ (কোনো migration লাগেনি, plain string column)
- **`LandingPageOrderService.php`**, **`CheckoutOtpService.php`** — owner-keying fix (§9.3)
- **`LandingPageController.php`** — `index/show/update/destroy/publish` → `whereIn(shopUserIds())`; `store()`-এ `$actingUserId` (creator, audit) বনাম `$shopUserIds` (product-ownership validation + read scope) আলাদা করা হয়েছে; `validatePayload()`/`syncProducts()` সিগনেচার `int $userId` → `array $shopUserIds`
- **`LandingMediaLibraryController.php`** — `index()` scoping
- **`LandingPageAnalyticsController.php`** (non-Api namespace) — ৫টা manual ownership check (`!==` → `!in_array(..., shopUserIds())`) + order-link Rule::exists → `shopOwnerId()`
- **`AbandonedCheckoutController.php`** — সব merchant method `whereIn(shopUserIds())`, `attachCustomerValue()`/order-link validation → `shopOwnerId()` (§9.3)
- **`TransactionController.php`** — সব read `whereIn(shopUserIds())`, `store()`-এ audit id অপরিবর্তিত
- **`AnalyticsController.php`** — সব ৪টা endpoint (sales/products/customers/courier) `whereIn(shopUserIds())`, pure read-only বলে audit-id বিবেচনা নেই
- **`FraudController.php`**, **`CourierFraudCheckController.php`** — `shopOwnerId()` single-value resolve (§9.3)
- **`FacebookLeadController.php`** — সব read `whereIn(shopUserIds())` (create নেই, সব webhook-driven বা update-only)
- **`FacebookReplyTemplateController.php`** — reads `whereIn(shopUserIds())`, `store()` audit id অপরিবর্তিত
- **`FacebookConnectController.php`**, **`FacebookPixelSettingController.php`** — কোনো internal পরিবর্তন লাগেনি (শুধু route-level `owner_only`, subscription-controller-এর মতো precedent)
- **`routes/api.php`** — Landing Page Builder+Analytics+Media+Abandoned Checkout ব্লক → `staff_permission:landing_pages`; Accounting → `staff_permission:accounting`; Analytics → `staff_permission:analytics`; Facebook connect+pixel → `owner_only`; Facebook leads+reply-templates → `staff_permission:facebook`; Fraud → `staff_permission:fraud`

### 9.5 Frontend — নতুন/পরিবর্তিত ফাইল

- **`frontend/src/lib/dashboard-client.ts`** — `STAFF_MODULE_KEYS`-এ `'facebook'` যোগ
- **`frontend/src/app/dashboard/settings/staff/page.tsx`** — `MODULE_KEYS` ৫→১০ এন্ট্রি, `moduleLabels` bn/en সম্পূর্ণ, checkbox grid `grid-cols-2 sm:grid-cols-3`, modal `max-w-md` → `max-w-lg` (১০টা টগলের জন্য বেশি জায়গা)
- **`frontend/src/components/user-shell.tsx`** — `filterMenuForStaff()` সম্পূর্ণ পুনর্লিখন: আগে শুধু top-level group filter করত, এখন **recursive item+child-level filter** — কারণ কিছু group-এর children আলাদা module দিয়ে gated (যেমন "Orders" group-এর ভেতরে "Fraud Check"/"Blacklist" আসলে `fraud` permission দিয়ে gated, `orders` না)। নতুন `MODULE_KEY_BY_MENU_ITEM` map (leaf-level) + `OWNER_ONLY_MENU_KEYS` set (`settings`, `sms-credit` — permission দিয়েও কখনো দেখানো হবে না)
- **`frontend/src/app/dashboard/page.tsx`** — Quick Access shortcut প্রতিটাতে `module` ট্যাগ, `hasModuleAccess()` দিয়ে ফিল্টার করা `visibleShortcuts` (§9.2)

### 9.6 Verification (এই সেশনেই সম্পন্ন)

- `php -l` — ১৪টা নতুন/পরিবর্তিত backend ফাইলে clean
- `php artisan route:list -v` — সব নতুন middleware assignment কনফার্ম (`landing_pages`/`accounting`/`analytics`/`facebook` → `EnsureStaffPermission:{module}`; facebook connect/pixel → `EnsureShopOwner`)
- **Rollback-wrapped tinker**: নতুন module permission check, staff-তৈরি LandingPage থেকে `LandingPageOrderService::create()` কল করে Order.user_id owner id হয়েছে কনফার্ম (staff id না), `shopUserIds()` উভয় দিক থেকে সঠিক — সব pass, rollback করা হয়েছে
- **Live HTTP round-trip** (`bsol.zyrotechbd.com`, seeded owner+staff+package, পরে DB থেকে মোছা): `landing_pages` granted → `200`; `accounting` not granted → `403 staff_permission_denied`; `facebook/connect/status` (owner_only) → `403 owner_only`; `fraud/blacklist` granted → `200`; `analytics` not granted → `403`
- `npx tsc --noEmit` + `npm run build` clean (ESLint সহ), `/dashboard/settings/staff` route intact
- `sudo -n .../deploy-safe.sh` — 8/8 pass, live smoke check (`/`, `/api/health`, `/dashboard/settings/staff`) সব `200`
- **লাইভ ব্রাউজার QA** (claude-in-chrome, owner + মিশ্র-permission staff [orders✓, landing_pages✓, facebook✓, fraud✗, products✗] দিয়ে, session শেষে সব cleanup):
  - Staff dashboard — sidebar-এ শুধু Dashboard/Landing Pages/Abandoned Checkouts/Orders/Facebook Leads দেখা গেছে (বাকি সব হাইড); "Orders" expand করে দেখা গেছে ভেতরে শুধু "All Orders"/"New Order" আছে, "Fraud Check"/"Blacklist" নেই — **recursive child-level filtering লাইভ কনফার্ম**
  - Dashboard home Quick Access-এ শুধু "Create New Order" দেখা গেছে (বাকি ৫টা shortcut হাইড, permission অনুযায়ী)
  - Team-member header badge সঠিক
  - Owner-এর staff-list পেজে ঠিক granted module chip দেখা গেছে (Orders/Landing Pages/Facebook Leads, Fraud Check না)
  - Add-staff মডালে ১০-checkbox গ্রিড ৩-কলামে পরিষ্কারভাবে রেন্ডার হয়েছে
  - টেস্ট user/package/permission/token সব cleanup করা হয়েছে

### 9.7 এই সেশনে যা করা হয়নি

- Mobile viewport visual QA (আগের মতোই একই tool সীমাবদ্ধতা)
- Facebook go-live external dependency (Meta App Review) — অপরিবর্তিত, `facebook_integration_context.md`-এ ট্র্যাক হচ্ছে, এই স্টাফ-ফিচার কাজের সাথে সম্পর্কহীন
