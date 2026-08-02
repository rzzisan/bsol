# Facebook/Meta Lead Capture — Detailed Context

এই ফাইল `SAAS_MODULE_CONTEXT.md` §15.11 / §16.3-এর deep-reference — Facebook Page comment/inbox lead-capture ফিচারের সব বিস্তারিত টেকনিক্যাল তথ্য, Meta App setup log, এবং known issue এখানে। `landing_page_context.md`-এর মতোই একটা module-specific deep-dive ফাইল, `SAAS_MODULE_CONTEXT.md` শুধু summary + link রাখে।

**Last updated:** 2026-08-02

---

## 1. Architecture Summary

**Model:** একটাই platform-level Meta for Developers App (super-admin কনফিগার করে), প্রতিটা seller নিজের Facebook Page নিজে OAuth দিয়ে কানেক্ট করে — Shopify-app-এর মতো "one app, many per-merchant connections" pattern। Per-user data isolation (CONTEXT.md §25) অনুসরণ করে।

```
┌─────────────────────────────┐
│ Meta for Developers App      │  ← platform_facebook_settings (singleton row, admin UI)
│ (App ID + App Secret,        │     .env FACEBOOK_* fallback if DB empty
│  shared, super-admin owns)   │
└──────────────┬────────────────┘
               │
      ┌────────┴─────────┐
      │ Per-seller OAuth  │  ← facebook_page_connections (per-user_id row)
      │ "Connect Page"    │     page_access_token (encrypted)
      └────────┬─────────┘
               │
      ┌────────┴─────────┐
      │ Meta webhook      │  → POST /api/facebook/webhook (public, signature-verified)
      │ (feed + messages) │  → FacebookLeadCaptureService (synchronous, no queue)
      └────────┬─────────┘
               │
      ┌────────┴─────────┐
      │ facebook_leads    │  ← BD-phone regex auto-link → customers table
      │ (per-user)        │  → /dashboard/leads inbox for manual review/convert
      └───────────────────┘
```

**Why synchronous webhook processing, not queued:** this deployment has no queue worker consuming `QUEUE_CONNECTION=redis` (discovered while building this feature — see §17.0 finding #12 in `SAAS_MODULE_CONTEXT.md`, also affects `SendAutomationSmsJob` delayed SMS). Rather than depend on a broken queue, `FacebookWebhookController::receive()` calls `FacebookLeadCaptureService::handle()` directly in-request — capture work is a handful of DB writes with no outbound HTTP calls, so this stays well within Meta's webhook response-time budget.

---

## 2. File Map

### Backend (Laravel)

| File | Purpose |
|---|---|
| `database/migrations/2026_08_02_125718_create_facebook_page_connections_table.php` | Per-user Page connection (fb_page_id unique, page_access_token encrypted) |
| `database/migrations/2026_08_02_125719_create_facebook_leads_table.php` | Captured comment/message events, dedupe key `(channel, fb_event_id)` |
| `database/migrations/2026_08_02_132037_create_platform_facebook_settings_table.php` | Singleton row: App ID/Secret/Webhook-verify-token (admin-configured) |
| `app/Models/FacebookPageConnection.php` | `encrypted` cast on `page_access_token`/`fb_user_access_token` |
| `app/Models/FacebookLead.php` | `raw_payload` array cast, belongs to `Customer` (nullable) |
| `app/Models/PlatformFacebookSetting.php` | `getSetting()` singleton helper, `masked()` for admin display, `resolvedAppId()/resolvedAppSecret()/resolvedWebhookVerifyToken()/resolvedGraphVersion()` — DB value wins, falls back to `config('services.facebook.*')` (i.e. `.env`) when DB empty |
| `app/Services/Facebook/FacebookGraphClient.php` | Graph API wrapper: OAuth code↔token exchange, long-lived token exchange, `GET /me/accounts` (list pages), `POST/DELETE {page}/subscribed_apps` (webhook subscribe), `X-Hub-Signature-256` HMAC verify |
| `app/Services/Facebook/FacebookLeadCaptureService.php` | Parses webhook payload (`entry[].changes[]` for comments, `entry[].messaging[]` for Messenger), dedupes, BD-phone regex `(?:\+?88)?01[3-9]\d{8}`, auto-links/creates `Customer` |
| `app/Http/Controllers/Api/FacebookWebhookController.php` | Public route: `GET` verify handshake, `POST` receive (signature-checked, synchronous) |
| `app/Http/Controllers/Api/FacebookConnectController.php` | Per-user (auth:sanctum): `status`, `redirect` (mint signed `state`, return Meta login dialog URL), `callback` (public — Meta redirects browser here directly, identity proven by signed `state` not Sanctum), `pendingPages`/`select` (multi-page picker via 10-min cache), `disconnect` |
| `app/Http/Controllers/Api/FacebookLeadController.php` | Per-user: `index`, `unreadCount`, `markRead`, `ignore`, `convertToCustomer` |
| `app/Http/Controllers/Api/Admin/PlatformFacebookSettingsController.php` | `is_admin`-gated: `show` (masked), `update` (blank secret/token fields = "leave unchanged", never round-trips the real secret to the frontend) |
| `routes/api.php` | Public: `GET/POST /facebook/webhook`, `GET /facebook/connect/callback` (throttled). Auth (inside `active_subscription` group): `/facebook/connect/*`, `/facebook/leads/*`. Admin: `/admin/settings/facebook` |
| `config/services.php` | `services.facebook.{app_id,app_secret,webhook_verify_token,graph_version}` — env-sourced fallback layer |
| `.env` / `.env.example` | `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET`/`FACEBOOK_WEBHOOK_VERIFY_TOKEN`/`FACEBOOK_GRAPH_VERSION` — left blank in `.env` now that the admin UI is the primary config path |

### Frontend (Next.js)

| File | Purpose |
|---|---|
| `src/app/dashboard/settings/facebook/page.tsx` | Seller: connect/disconnect, multi-page picker, connection status |
| `src/app/dashboard/leads/page.tsx` | Seller: lead inbox, channel/status filter, convert-to-customer form |
| `src/app/admin/settings/facebook/page.tsx` | Super-admin: App ID/Secret/Webhook-token form, webhook callback URL display, setup checklist |
| `src/components/user-shell.tsx` | Menu entries: `facebook-leads` (top-level), `facebook-connect` (under settings) |
| `src/lib/admin-menu.ts` | Menu entry: `settings-facebook` → `/admin/settings/facebook` |

**Commits:** `0fdc3ab` (courier abstraction, unrelated), Facebook backend+frontend MVP `ea1d08f`. The `platform_facebook_settings` admin-config-UI follow-up (migration + model + admin controller/route + admin page + `PlatformFacebookSetting::resolved*()` wiring into the 3 Facebook classes) — **not yet committed** as of this writing, check `git status`.

---

## 3. Meta for Developers App — Setup Log (2026-08-02)

Done together with the user via live browser session (claude-in-chrome), against the user's real Meta account.

- **App name:** Zyrotech BSOL
- **App ID:** `1900768904642203`
- **Business portfolio:** Zareen Natural Foods (pre-existing, verified — connected at app-creation time so future App Review won't need this step separately)
- **App creation path:** "Create an app without a use case" (avoided preset wizards like Fundraiser/ThreatExchange that don't match our use case)
- **Use case added:** "Engage with customers on Messenger from Meta" (auto-added "Facebook Login for Business" as a dependency)
- **Permissions — Ready for testing:** `pages_manage_metadata`, `pages_messaging`, `pages_show_list`, `pages_read_engagement` (added manually; not in the default use-case bundle)
- **Not added (not needed for MVP — read-only capture, no auto-reply):** `pages_manage_engagement`
- **Webhook (Messenger API Settings → Configure webhooks):**
  - Callback URL: `https://bsol.zyrotechbd.com/api/facebook/webhook`
  - Verify token: generated via `bin2hex(random_bytes(16))`, stored in `platform_facebook_settings.webhook_verify_token` (encrypted) — **not reproduced here**, retrievable only by the app itself (never round-tripped to any UI)
  - Status: ✅ **Verified** (green checkmark) — Meta's live handshake request against our GET endpoint succeeded
- **App Secret:** retrieved via Basic Settings → Show (required re-entering the Facebook account password — the user did this step themselves; the assistant does not enter passwords). Saved into `platform_facebook_settings.app_secret` (encrypted) via `php artisan tinker` directly on the server, **not** typed into any file.
- **App Domains** (Basic Settings): `bsol.zyrotechbd.com` — ⚠️ first save attempt silently failed (the field is a chip/tag input; typing text + Enter alone doesn't commit it, you must click the autocomplete suggestion that appears below the input). Confirmed via page reload after the second attempt + saw the "Changes saved" toast.
- **Valid OAuth Redirect URIs** (Facebook Login for Business → Settings): `https://bsol.zyrotechbd.com/api/facebook/connect/callback` — this is a **separate field from App Domains**, both are required for the seller-facing "Connect Facebook Page" OAuth dialog to load. Missing this was the actual root cause of the "Can't load URL" error the user hit.

### Known issue at time of writing

Seller-side "Connect Facebook Page" (`/dashboard/settings/facebook` → Connect) was still showing **"Can't load URL — domain not in app's domains"** even after both App Domains and Valid OAuth Redirect URIs were correctly saved (confirmed via page reload). Working theory: Meta's live OAuth dialog endpoint is served from a more heavily cached layer than the developer dashboard, with a propagation delay (commonly 5–15 min, occasionally longer) after a Basic Settings save. **Not yet confirmed resolved** — next session should verify with the user whether a retry succeeded, and if not, check the Redirect URI Validator tool on the Facebook Login for Business → Settings page (`Check URI` button) for a more specific error.

### Still open before real (non-admin) sellers can use this

1. **App Review** — not submitted. Required for `pages_messaging`/`pages_read_engagement` to work for anyone other than the app's own admin/developer/tester roles. Meta's submission checklist currently blocks on:
   - App icon (1024×1024) — not uploaded
   - Privacy Policy URL — not set (reusing `https://bsol.zyrotechbd.com/terms` is a plausible stopgap but that page is a Terms of Use, not a true privacy policy — worth flagging to the user rather than silently reusing it)
   - Category — not selected
   - App Review typically also wants a screencast demonstrating the use case
2. **Testing a real Page connection** — the in-dashboard "Connect a Facebook Page for testing" button (Messenger API Settings → step 2) didn't open its OAuth popup during the automated browser session (likely popup-blocked); this is optional (only needed for pre-review dev-mode testing) and the user was left to try it manually.
3. Once App Review passes: verify the full pipeline live — comment on the connected Page, DM the Page, confirm both land in `/dashboard/leads` with correct dedupe/phone-auto-link behavior (already unit-verified via rollback-wrapped tinker tests against synthetic payloads, but never against a real Meta-delivered webhook event yet).

---

## 4. Related — Queue Worker Gap (discovered during this work, not fixed)

Building the webhook receiver surfaced that this deployment has **no queue worker process** at all — `QUEUE_CONNECTION=redis` but nothing runs `php artisan queue:work` (checked: no systemd service, no supervisor, no cron entry beyond `schedule:run`). This means any `ShouldQueue` job dispatched with `->delay()` (specifically `SendAutomationSmsJob` for `delay_minutes > 0` SMS automation rules) silently never executes. Full detail in `SAAS_MODULE_CONTEXT.md` §17.0 finding #12 and §17.5. Not fixed as part of this Facebook work — flagged as a separate critical, unfixed finding.

---

## 5. Resuming This Work — Quick Orientation

- Real credentials (App ID/Secret/Webhook verify token) are in `platform_facebook_settings` (DB, encrypted) — check via `/admin/settings/facebook` (masked) or `php artisan tinker` → `App\Models\PlatformFacebookSetting::getSetting()->masked()`. Never re-print the raw secret into a doc or commit.
- To test the webhook handshake without Meta: `curl "https://bsol.zyrotechbd.com/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=test"` should echo `test` with `200`.
- To test lead capture without a real Page: rollback-wrapped tinker test pattern is in the session history — construct a synthetic `entry[].changes[]` (comment) or `entry[].messaging[]` (message) payload and call `app(FacebookLeadCaptureService::class)->handle($payload)` inside `DB::beginTransaction()/rollBack()`.
- The uncommitted `platform_facebook_settings` admin-config-UI changes should be committed together (migration + model + controller + route + admin page + the 3 call-site edits in `FacebookGraphClient`/`FacebookWebhookController`/`FacebookConnectController` that switched from `config('services.facebook.*')` to `PlatformFacebookSetting::resolved*()`).
