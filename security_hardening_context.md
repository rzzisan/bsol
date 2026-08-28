# Security Hardening — Admin 2FA + Audit Trail

Last updated: 2026-08-28 — **§1-৩ সব ✅ সম্পন্ন ও লাইভ (Phase 1 MVP scope)।** `production_audit_report_context.md §৭` আইটেম ৮, `feature_roadmap_context.md` P8।

---

## ১. এই ফিচারটা কী

audit রিপোর্টের P8 প্রায়োরিটি ("2FA + admin audit trail — নিরাপত্তা hardening, স্কেলের আগে") থেকে — প্রোডাকশনে বড় স্কেলে যাওয়ার আগে admin একাউন্টের নিরাপত্তা শক্ত করা এবং কে কী গুরুত্বপূর্ণ কাজ করল তার একটা রেকর্ড রাখা।

**স্কোপ (এই ব্যাচ): শুধু admin role।** Seller/staff account-এ 2FA প্রসারিত করা একটা সম্ভাব্য future-extension, এই ব্যাচে করা হয়নি (admin account-ই সবচেয়ে বেশি blast-radius — পুরো প্ল্যাটফর্ম access)।

---

## ২. Two-Factor Authentication (TOTP)

### ডিজাইন সিদ্ধান্ত

- **RFC 6238 TOTP, নিজে implement করা** — কোনো composer package যোগ করা হয়নি। কারণ: অ্যালগরিদমটা ছোট (~৩০ লাইন HMAC-SHA1 + bit truncation) এবং এই কোডবেসের নিজের established convention-ই হলো payment-gateway crypto (Nagad-এর RSA sign/encrypt, EPS-এর HMAC signing)-এর মতো "স্পেক পড়ে নিজে implement করে টেস্ট দিয়ে lock করা" — external dependency যোগ না করে। **`TotpService`** (`backend/app/Services/Security/TotpService.php`) — official RFC 6238 Appendix B SHA1 test vector দিয়ে verify করা (৬টা vector, `tests/Unit/TotpServiceTest.php`), তাই Google Authenticator/Authy-সহ যেকোনো standard authenticator app-এর সাথে সরাসরি ইন্টারঅপারেবল।
- **QR কোড রেন্ডার করা হয়নি** — শুধু secret (base32) + `otpauth://` URI টেক্সট হিসেবে দেখানো হয়, ইউজার authenticator app-এ "Enter setup key" দিয়ে ম্যানুয়ালি যোগ করে। নতুন frontend dependency (QR encoder লাইব্রেরি) এড়াতে ইচ্ছাকৃত সিদ্ধান্ত। **পরবর্তী ব্যাচ candidate:** dependency-free inline SVG QR generator যোগ করে UX উন্নত করা।
- **Setup → Enable দুই ধাপে বিভক্ত** — `setup()` শুধু secret generate করে row-এ বসায় (কিন্তু `two_factor_confirmed_at` null-ই থাকে, তাই `hasTwoFactorEnabled()` false), `enable()` একটা real code দিয়ে proof-of-possession চাওয়ার পরই কনফার্ম করে। মাঝপথে ছেড়ে দেওয়া setup কখনো নিঃশব্দে 2FA চালু করে দেয় না।
- **Recovery codes** — ৮টা `XXXX-XXXX` ফরম্যাট কোড, প্রতিটা bcrypt-hashed করে store হয় (User model-এর `two_factor_recovery_codes` কলাম নিজেই `encrypted:array` cast — অর্থাৎ DB+app-key দুটোই compromise হলেও শুধু hash exposed হয়, plaintext না)। প্রতিটা কোড একবার ব্যবহারযোগ্য, ব্যবহারের পর array থেকে সরিয়ে ফেলা হয় (`RecoveryCodeService::consume()`)।
- **Login flow** — `AuthController::login()`-এ password check-এর পর, token mint করার ঠিক আগে hook করা হয়েছে (subdomain-handoff branch-এর পরে — admin-এর কখনো subdomain handoff হয় না, `SubdomainHandoffService::redirectHostFor()` admin-এর জন্য সবসময় null রিটার্ন করে)। 2FA enabled হলে token না দিয়ে একটা `challenge_token` রিটার্ন করে (`TwoFactorChallengeService` — `SubdomainHandoffService`-এর হুবহু pattern: `Str::random(64)` + `Cache::put`/`pull`, single-use, ৫ মিনিট TTL)। নতুন public endpoint `POST /api/2fa/challenge` (কোনো bearer token লাগে না — সেটাই তো এখনো নেই) সেই challenge + TOTP/recovery code নিয়ে আসল token mint করে।
- **Brute-force protection, দুই স্তরে:**
  1. Route-level `throttle:10,1` (public route, বাকি সব public route-এর convention)
  2. প্রতি-challenge ৫-attempt cap (`CheckoutOtpService`-এর ঠিক একই ৫-attempt convention) — ৫ বার ভুল হলে challenge invalidate, নতুন করে লগইন করতে হয়
- **Disable** password re-confirmation লাগে (শুধু active session না) — একটা compromised session-এর সবচেয়ে বেশি blast-radius action হলো নিজের 2FA বন্ধ করে দেওয়া, তাই এই একটা gate ইচ্ছাকৃতভাবে বাকিদের চেয়ে শক্ত।

### Backend ফাইল

- `app/Services/Security/TotpService.php` — RFC 6238 core algorithm
- `app/Services/Security/TwoFactorChallengeService.php` — login-time challenge token (issue/peek/recordFailedAttempt/redeem/invalidate)
- `app/Services/Security/RecoveryCodeService.php` — generate/consume recovery codes
- `app/Http/Controllers/Api/Admin/TwoFactorController.php` — `status/setup/enable/disable/regenerateRecoveryCodes` (সব `is_admin` middleware-এর ভেতরে)
- `app/Http/Controllers/AuthController.php` — `login()` (2FA branch) + নতুন `verifyTwoFactorChallenge()`
- `app/Models/User.php` — `two_factor_secret`/`two_factor_recovery_codes`/`two_factor_confirmed_at` কলাম, `encrypted`/`encrypted:array` cast, `#[Hidden]`-এ (কখনো API response-এ leak হয় না), `hasTwoFactorEnabled()` helper
- Migration: `2026_08_28_090000_add_two_factor_columns_to_users_table`

### Frontend ফাইল

- `components/marketing/home-content.tsx` — লগইন ফর্ম এখন `requires_2fa`/`challenge_token` হ্যান্ডল করে, code/recovery-code ইনপুট স্টেপ যোগ হয়েছে (bn/en দুটোতেই)
- `app/admin/settings/security/page.tsx` — setup/enable/disable/regenerate UI
- `lib/admin-menu.ts` — Settings-এর ভেতরে "Security (2FA)" মেনু আইটেম

### Routes

```
POST /api/2fa/challenge                          (public, throttle:10,1)
GET  /api/admin/2fa/status                       (is_admin)
POST /api/admin/2fa/setup                        (is_admin)
POST /api/admin/2fa/enable                       (is_admin)
POST /api/admin/2fa/disable                      (is_admin)
POST /api/admin/2fa/recovery-codes/regenerate    (is_admin)
```

### Test coverage

`tests/Unit/TotpServiceTest.php` (১৩টা, RFC vector-সহ), `tests/Feature/TwoFactorAuthTest.php` (১৫টা — setup/enable/login-gate/challenge single-use/attempt-lockout/recovery-code single-use/disable-password-gate/non-admin-unaffected/route-403-for-non-admin/audit-log-entries)। পুরো suite চালিয়ে regression check করা হয়েছে — pre-existing ৮০টা sqlite-vs-postgres ব্যর্থতা (নিচে §৪ দেখো) অপরিবর্তিত, নতুন কোনো ব্যর্থতা যোগ হয়নি।

---

## ৩. Admin Audit Trail

### ডিজাইন সিদ্ধান্ত

- **Shared admin resource** (CONTEXT.md §25 pattern) — সব admin সব admin-এর log দেখে, flat admin role model-এর সাথে সামঞ্জস্যপূর্ণ।
- **প্রতিটা endpoint-এ instrument করা হয়নি** — ইচ্ছাকৃতভাবে শুধু আসল financial/account-takeover blast-radius থাকা actions cover করা হয়েছে প্রথম ব্যাচে (নিচের তালিকা)। নতুন sensitive action যোগ হলে `AdminAuditLogger::log()` কল করাই যথেষ্ট।
- **`admin_user_id` নালাবল + `nullOnDelete`** (cascade না) — ইচ্ছাকৃতভাবে বিপরীত intent §17.9 #10 (soft-delete)-এর চেয়ে: একজন admin ডিলিট হলেও তার audit history হারানো ঠিক হবে না।
- **Actor resolution** — বেশিরভাগ জায়গায় `Auth::id()` (ambient auth guard, `auth:sanctum` middleware দিয়ে ইতিমধ্যে resolved) দিয়ে কাজ চলে। ব্যতিক্রম: login action নিজেই — সেই একই request-এ token mint হয় কিন্তু request-এর auth guard-এ attach হয় না, তাই `AuthController` explicit `actingAdminId` পাস করে।

### এখন যা log হয়

| Action | কোথায় | Meta |
|---|---|---|
| `admin.login` | `AuthController::login()` | — |
| `admin.login_via_2fa` / `admin.login_via_recovery_code` | `AuthController::verifyTwoFactorChallenge()` | — |
| `admin.2fa_enabled` / `admin.2fa_disabled` / `admin.2fa_recovery_codes_regenerated` | `TwoFactorController` | — |
| `user.update` | `AdminController::updateUser()` | changed_fields, password_changed |
| `user.delete` | `AdminController::deleteUser()` | email, role |
| `package.create` / `package.update` / `package.delete` | `AdminController` | name / changed_fields |
| `subscription_payment.approve` / `.reject` | `AdminSubscriptionController` | user_id, amount, trx_id/admin_note |
| `addon_purchase.approve` / `.reject` | `AdminAddonPurchaseController` | user_id, amount/admin_note |

### Backend ফাইল

- `app/Models/AdminAuditLog.php`, migration `2026_08_28_090100_create_admin_audit_logs_table`
- `app/Services/Security/AdminAuditLogger.php` — write-only helper
- `app/Http/Controllers/Api/Admin/AdminAuditLogController.php` — `GET /api/admin/audit-logs` (paginated, `admin_user_id`/`action`/`from`/`to` filter)

### Frontend

- `app/admin/audit-logs/page.tsx` — list view, action filter, pagination
- `lib/admin-menu.ts` — top-level "Audit Log" মেনু আইটেম

---

## ৪. এই ব্যাচে পাওয়া, কিন্তু আলাদা একটা জিনিস — Test infra gap (fix করা হয়নি, শুধু নথিভুক্ত)

পুরো backend test suite (`php artisan test`) চালিয়ে confirm করা হয়েছে আমার নতুন কোড কোনো regression আনেনি (আগে ও পরে দুটোতেই ঠিক ৮০টা ব্যর্থতা, একই টেস্টগুলো)। কিন্তু এই ৮০টা ব্যর্থতা নিজেই একটা real, বাড়তে-থাকা সমস্যা — `phpunit.xml` টেস্ট চালায় SQLite in-memory-তে (`DB_CONNECTION=sqlite`), কিন্তু কোডবেসে ক্রমবর্ধমানভাবে Postgres-specific raw SQL ব্যবহার হচ্ছে (`to_char()`, `now()`, `ON CONFLICT` upsert) — এগুলো SQLite সাপোর্ট করে না, তাই সেই টেস্টগুলো সবসময় fail করে, আসল লজিক বাগ না। এটা `pre_launch_polish_context.md`-এ নতুন আইটেম হিসেবে যোগ করা হয়েছে (এই ফাইলের স্কোপ না, বড় আলাদা সিদ্ধান্ত লাগবে — টেস্ট suite real Postgres-এ চালানো, নাকি raw SQL গুলো DB-agnostic করে লেখা)।

---

## ৫. পরবর্তী ধাপ (এই ব্যাচে করা হয়নি)

- Seller/staff account পর্যন্ত 2FA প্রসারিত করা (এখন admin-only)
- QR কোড রেন্ডারিং (এখন শুধু ম্যানুয়াল সিক্রেট এন্ট্রি)
- আরও admin action audit-log-এ যোগ করা (SMS gateway/credit changes, courier settings, email config — সবই সম্ভাব্য candidate)
- Super-admin tier (granular admin role) — production_audit_report §৩ item ৩৬-এ এখনো আলাদা open item হিসেবে আছে
