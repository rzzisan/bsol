# Zyro SMS Gateway Context (Technical Reference)

Last updated: 2026-04-25  
Scope: `/var/www/hybrid-stack/zyro`

এই ডকুমেন্টের উদ্দেশ্য হলো `zyro` প্রজেক্টে SMS subsystem কীভাবে কাজ করে তা end-to-end সহজে বোঝানো, যাতে future feature/dev/debugging দ্রুত করা যায়।

---

## 1) High-level architecture

`zyro`-র SMS system একটি **credit-based + API-auth protected + event-driven** architecture অনুসরণ করে।

মূলত ৩ ধরনের SMS path আছে:

1. **Manual/Dashboard send**
   - UI form submit → `send_sms.php` → `SmsController::handleSendSmsRequest()`
2. **Direct API send (synchronous)**
   - `api/v1/send_sms.php`
3. **Automation API trigger (asynchronous / queue-based)**
   - `api/v1/trigger_sms.php` → `jobs` table → `cron/process_jobs.php` → `SmsAutomationService`

---

## 2) Core files (source of truth)

### Entry / API files
- `/var/www/hybrid-stack/zyro/send_sms.php`
- `/var/www/hybrid-stack/zyro/api/v1/send_sms.php`
- `/var/www/hybrid-stack/zyro/api/v1/trigger_sms.php`

### SMS logic
- `/var/www/hybrid-stack/zyro/controllers/smsController.php`
- `/var/www/hybrid-stack/zyro/core/SmsAutomationService.php`

### Auth / helpers / config
- `/var/www/hybrid-stack/zyro/core/api_auth_guard.php`
- `/var/www/hybrid-stack/zyro/core/functions.php`
- `/var/www/hybrid-stack/zyro/core/config.php`
- `/var/www/hybrid-stack/zyro/core/CreditService.php`

### Data models
- `/var/www/hybrid-stack/zyro/models/Job.php`
- `/var/www/hybrid-stack/zyro/models/SmsCredit.php`
- `/var/www/hybrid-stack/zyro/models/SmsHistory.php`
- `/var/www/hybrid-stack/zyro/models/SmsCreditHistory.php`
- `/var/www/hybrid-stack/zyro/models/User.php`

### Queue worker
- `/var/www/hybrid-stack/zyro/cron/process_jobs.php`

### WordPress plugin integration
- `/var/www/hybrid-stack/zyro/wordpress_plugin/zayroo-connect/includes/classes/class-zayroo-api.php`
- `/var/www/hybrid-stack/zyro/wordpress_plugin/zayroo-connect/includes/modules/sms/class-zayroo-sms-automation.php`

---

## 3) Gateway credentials কোথা থেকে আসে

Gateway credentials `.env` থেকে `core/config.php`-এ constants হিসেবে load হয়:

- `SMS_GATEWAY_URL`
- `SMS_GATEWAY_API_KEY`
- `SMS_GATEWAY_SECRET_KEY`
- `SMS_GATEWAY_SENDER_ID`

Actual gateway API call হয়:
- `SmsController::sendSms($to, $message)` (`controllers/smsController.php`)

POST payload fields:
- `apikey`
- `secretkey`
- `callerID`
- `toUser`
- `messageContent`

Current success criteria:
- cURL error না থাকলে এবং HTTP status `200` হলে success ধরা হয়।

---

## 4) Phone format validation policy

`formatPhoneNumber()` (`core/functions.php`) BD number normalize করে `8801XXXXXXXXX` format-এ নিয়ে আসে।

Supported normalization examples:
- `01XXXXXXXXX` → `8801XXXXXXXXX`
- `1XXXXXXXXX` (10-digit mobile local body) → `8801XXXXXXXXX`
- `008801XXXXXXXXX` → `8801XXXXXXXXX`

Invalid হলে `null` return করে এবং request reject হয়।

---

## 5) Security flow (API requests)

`api/v1/send_sms.php` এবং `api/v1/trigger_sms.php`-এ `authenticate_api_request()` বাধ্যতামূলক।

Validation chain (`core/api_auth_guard.php`):

1. API key from header/body/JSON
2. DB token lookup (`api_tokens`)
3. Domain binding check (`X-Client-Domain` or body `client_domain`)
4. website domain mismatch হলে reject (403)

ফলাফল:
- arbitrary origin থেকে API key misuse কঠিন হয়
- plugin/site specific isolation enforce হয়

---

## 6) Credit calculation & deduction logic

Credit গণনা (`core/CreditService.php`):

- Unicode message: প্রতি segment 70 char
- GSM/non-Unicode message: প্রতি segment 160 char
- required credit = `ceil(length / segment_limit)`

Balance source:
- `User::find()` (`models/User.php`) query-তে `sms_credits.balance as sms_balance` join করে

Deduction:
- `SmsCredit::deductCredits($user_id, $credits)` (`models/SmsCredit.php`)

Audit লগ:
- `sms_history` (`models/SmsHistory.php`)
- `sms_credit_history` (`models/SmsCreditHistory.php`)

System-wide balance:
- `settings` table key: `master_sms_balance` (send success হলে deduct)

---

## 7) Direct API send flow (`api/v1/send_sms.php`)

Flow summary:

1. API auth pass
2. POST + required fields (`phone_number`, `message`) validate
3. Phone normalize
4. User balance check
5. DB transaction start
6. User credit reserve/deduct
7. Gateway send (`SmsController::sendSms`)
8. Success হলে:
   - credit history log
   - SMS history log
   - `master_sms_balance` deduct
   - transaction commit
9. Fail হলে rollback

Key strength:
- এই path transactionally safer (gateway fail হলে rollback)

---

## 8) Manual dashboard send flow (`send_sms.php`)

Flow:

1. Form submit → `send_sms.php`
2. `action=send_sms` হলে `SmsController::handleSendSmsRequest()`
3. CSRF যাচাই
4. Input sanitize + phone normalize
5. Credit check
6. Gateway send
7. Success হলে credit/history/master balance update + redirect message

Important note:
- এই flow-তে direct API send-এর মতো explicit DB transaction wrapper নেই।
- future hardening-এ manual flow-ও transaction-wrapped করা ভালো।

---

## 9) Automation flow (WooCommerce event → queue → SMS)

### 9.1 Plugin side trigger

`class-zayroo-sms-automation.php`:
- WooCommerce hook: `woocommerce_order_status_changed`
- Event payload build করে `Zayroo_API::trigger_sms()` call করে

`class-zayroo-api.php`:
- endpoint: `trigger_sms.php`
- non-blocking request (`blocking => false`, timeout কম)

### 9.2 SaaS side queueing

`api/v1/trigger_sms.php`:
- auth pass করে
- event + data validate
- `jobs` table-এ `job_type='trigger_sms'` row create

### 9.3 Worker processing

`cron/process_jobs.php`:
- pending jobs fetch
- `job_type === 'trigger_sms'` হলে
  - `SmsAutomationService::processEvent(...)`

### 9.4 Automation decision engine

`SmsAutomationService` user preference থেকে:
- `enable_admin_sms`
- `enable_customer_sms`
- trigger list (`processing`, `completed`, `on-hold` etc.)
- templates

তারপর:
- template placeholder replace
- admin/customer numbers format
- credit check + transactional send attempt

---

## 10) Template placeholders (automation)

`SmsAutomationService::processSmsTemplate()` placeholders support:

- `{site_title}`
- `{order_id}`
- `{order_total}` / `{total}`
- `{customer_name}`
- `{customer_phone}`
- `{order_status}`
- `{billing_address}`

---

## 11) HTTP/API behavior snapshot

### `api/v1/send_sms.php`
- Method: `POST` only
- Required: `phone_number`, `message`
- Common responses:
  - `200` success
  - `400` bad input
  - `401/403` auth/domain errors
  - `402` insufficient credits
  - `502` gateway failure
  - `500` internal error

### `api/v1/trigger_sms.php`
- Method: `POST` only
- Required: `event`, `data`
- Success: queue accepted message

---

## 12) Known strengths

- API-level domain binding security strong
- Queue-first automation pattern scalable
- Credit হিসাব Unicode-aware
- SMS send history + credit history audit available

---

## 13) Known gaps / improvement opportunities

1. **Gateway response parsing minimal**
   - এখন HTTP 200 হলেই success ধরা হচ্ছে
   - provider-specific response code/body parse করা উচিত

2. **Manual path transaction hardening**
   - `handleSendSmsRequest()`-এ DB transaction যোগ করা ভালো

3. **Idempotency controls**
   - event duplication prevent করতে unique event key/hash উপকারী

4. **Retry/backoff for SMS failures**
   - direct send path-এ smart retry নেই

5. **Centralized observability**
   - structured logs + alerting (gateway fail spikes, low credit alert)

---

## 14) Future dev checklist (SMS related)

SMS feature touch করার আগে:

1. `core/config.php` constants intact কিনা verify
2. `api_auth_guard.php` domain-binding bypass হচ্ছে না নিশ্চিত করা
3. `formatPhoneNumber()` compatibility ভাঙে এমন change avoid
4. credit calculation logic (`CreditService`) regression test করা
5. API path + automation path দুটোতেই success/failure path test করা
6. `jobs` worker (`cron/process_jobs.php`) schedule/running আছে নিশ্চিত করা

Deploy/ops reminders:

- `.env` secrets কখনও repo-তে commit করা যাবে না
- gateway key rotate policy maintain করতে হবে
- critical API changes-এর পর WordPress plugin compatibility test করতে হবে

---

## 15) Quick flow map (mental model)

Manual UI:

`Dashboard Form -> send_sms.php -> SmsController::handleSendSmsRequest -> sendSms(cURL) -> Deduct + History`

Direct API:

`Client/Plugin -> api/v1/send_sms.php -> Auth + Validate + Txn -> sendSms(cURL) -> Commit/Rollback`

Automation:

`Woo status change -> api/v1/trigger_sms.php -> jobs.pending -> cron/process_jobs.php -> SmsAutomationService -> sendSms(cURL)`

---

## 16) Important caution for future contributors

- `catv`/`hybrid-stack` থেকে concept নিতে পারবেন, কিন্তু direct copy/paste না করে `zyro` architecture অনুযায়ী adapt করতে হবে।
- SMS/security/queue logic change করলে অবশ্যই backward compatibility impact check করতে হবে (বিশেষ করে WordPress plugin trigger path)।

---

## 17) Ownership note

এই doc future onboarding, debugging, এবং SMS module refactor planning-এর জন্য।  
যেকোনো major SMS architecture change হলে এই ফাইল update করা বাধ্যতামূলক।
