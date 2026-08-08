# Facebook/Meta Lead Capture — Detailed Context

এই ফাইল `SAAS_MODULE_CONTEXT.md` §15.11 / §16.3-এর deep-reference — Facebook Page comment/inbox lead-capture ফিচারের সব বিস্তারিত টেকনিক্যাল তথ্য, Meta App setup log, এবং known issue এখানে। `landing_page_context.md`-এর মতোই একটা module-specific deep-dive ফাইল, `SAAS_MODULE_CONTEXT.md` শুধু summary + link রাখে।

**Last updated:** 2026-08-08 — §4 queue-worker-gap note corrected (fixed), §5 stale uncommitted-changes note corrected (already committed), added §6 prioritized recommendations for future work. Sections 1-3, 3.2, 3.3 kept as-is (2026-08-02/07 work log).

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

### Known issue at time of writing — RESOLVED 2026-08-02

The "Can't load URL" error above did clear on its own (propagation-delay theory confirmed). It was immediately followed by a **different** error: **"Feature Unavailable — Facebook Login is currently unavailable for this app, since we are updating additional details for this app."**

Root cause: this app is **Facebook Login for Business** (see §3 above — auto-added as a dependency of the Messenger use case). Apps of that type reject the classic `scope`-based `/dialog/oauth` URL entirely; Meta serves the "Feature Unavailable" wall instead of the login dialog. [FacebookGraphClient::loginDialogUrl()](backend/app/Services/Facebook/FacebookGraphClient.php:24) was building the classic form (`scope=pages_show_list,...`) — that's what every seller was hitting.

Fix (done, live as of this writing):
1. Created a **Login Configuration** in App Dashboard → Facebook Login for Business → Configurations — name "BSOL Page Connect", "General" variation, **User access token** (not system-user, since sellers log in with their own personal FB account), permissions `pages_manage_metadata` + `pages_messaging` + `pages_read_engagement` + `pages_show_list` (matches the app's "Ready for testing" permission set; `pages_manage_engagement` intentionally excluded per §3's "not needed for MVP" note). Got **Configuration ID `1026176940256089`**.
2. Added `login_config_id` column to `platform_facebook_settings` (migration `2026_08_02_140000_...`), `PlatformFacebookSetting::resolvedLoginConfigId()` (DB → `FACEBOOK_LOGIN_CONFIG_ID` env fallback, same pattern as the other resolved* methods), admin controller/frontend field to set it.
3. `FacebookGraphClient::loginDialogUrl()` now sends `config_id` instead of `scope` — permissions live on the Configuration itself, not the OAuth URL.
4. Set the value in the live DB via tinker: `PlatformFacebookSetting::getSetting()->update(['login_config_id' => '1026176940256089'])`.

**Second issue found immediately after, same session (still 2026-08-02):** with `config_id` wired up, the seller-side Connect click progressed past "Feature Unavailable" but hit **"Can't load URL — domain not in app's domains"** again (the same error text §3 originally described). Checked live in Facebook Login for Business → Settings: **Valid OAuth Redirect URIs was empty** — despite §3 recording it as set. "Use Strict Mode for redirect URIs" is On, so Meta rejects any `redirect_uri` not exactly matching an entry in that (empty) list; App Domains (Basic Settings) was still correctly `bsol.zyrotechbd.com` + `zyrotechbd.com`, so that half was never the problem this time. Re-added `https://bsol.zyrotechbd.com/api/facebook/connect/callback` as a chip in Valid OAuth Redirect URIs and saved — confirmed "Changes saved" toast. Root cause of it going missing is unclear (never explicitly cleared by us this session) — worth rechecking next session that it's still present, since it's silently gone missing at least once already.

**End-to-end click-through — now verified, 2026-08-04.** Real blocker turned out to be a third issue, found only once an actual seller (the admin's own account, testing with the "Zyro Tech" Page) clicked through for real:

### Third issue — RESOLVED 2026-08-04: "No Facebook Pages found for this account"

After OAuth completed successfully (code exchange + long-lived token both fine, no errors logged), [`FacebookGraphClient::getUserPages()`](backend/app/Services/Facebook/FacebookGraphClient.php:98) — `GET /me/accounts` — came back **200 OK with an empty `data` array**, even after the seller used "Edit settings" (not "Continue") and explicitly picked "Zyro Tech" in Facebook's own Page-picker. Confirmed via temporary debug logging (added, used, then removed same session) that this was a clean empty response, not an API error.

Root cause: **"Zyro Tech" is owned by a Business Portfolio** ("Zareen Natural Foods", connected at app-creation time — see §3). Per Meta's own Login Configuration UI ("System-user access token... required if this configuration needs continuous access to business assets like Facebook Pages... owned by a business portfolio") and corroborating developer-community reports, `/me/accounts` does not surface Business-Portfolio-owned Pages to a **User access token** flow unless the token was also granted `business_management` — even when the connecting person has Full Access to that Page in Business Settings → Pages → assigned people (checked live; access was already Full, that wasn't the gap).

Fix: added `business_management` to the **"BSOL Page Connect" Login Configuration** (same `config_id` `1026176940256089`, permissions now `pages_manage_metadata` + `pages_messaging` + `pages_read_engagement` + `pages_show_list` + `business_management`). No code change needed — `loginDialogUrl()` only references `config_id`, permissions live on the Configuration. After reconnecting (fresh consent — a new "Choose the Businesses you want Zyrotech BSOL to access" screen appears, this is expected and correct), `/me/accounts` returned the Page and the full flow completed: Page connected, webhook auto-subscribed (`webhook_subscribed_at` set, `last_error` null).

**Implication for real (non-Business-Portfolio) sellers:** likely fine either way — a typical seller's own Page, not owned by *our* Business Portfolio, should list normally via a plain personal-token `/me/accounts` call. `business_management` was added defensively since some sellers' Pages will themselves be Business-Portfolio-owned (increasingly common on Facebook) and would hit the identical empty-`/me/accounts` symptom without it. Worth confirming with a second real Page (personal, non-Business-owned) if one becomes available, but not blocking.

### Still open before real (non-admin) sellers can use this

1. **App Review** — not submitted. Required for `pages_messaging`/`pages_read_engagement`/`pages_manage_metadata`/`pages_show_list` to work for anyone other than the app's own admin/developer/tester roles. Status as of 2026-08-04:
   - App icon (1024×1024) — ✅ uploaded (teal "B" monogram, generated this session, also served at `frontend/public/app-icon-1024.png` / `https://bsol.zyrotechbd.com/app-icon-1024.png`)
   - Privacy Policy URL — ✅ set to `https://bsol.zyrotechbd.com/privacy` (real bilingual Privacy Policy built this session, admin-editable at `/admin/settings/platform-branding` alongside Terms — see `PlatformSetting` model, `privacy_content_bn/en` columns)
   - Category — ✅ "Business and pages" (already set)
   - Submission draft in progress: justification text + compliance checkboxes filled in for `pages_show_list`/`pages_manage_metadata`/`pages_messaging`/`public_profile` (draft, not submitted — auto-saved in Meta's UI). `business_management` was removed from the *App Review* submission (assumed unused, `grep` found no direct call) before the Login Configuration finding above — **should be reconsidered/re-added to App Review too now that it's confirmed functionally required**, not just cosmetic.
   - Blocking: Meta requires a real screencast video (per permission) + at least 1 real API test call (per permission) before "Submit for review" enables. The 2026-08-04 real connect (Zyro Tech) *is* a genuine API test call for `pages_show_list`/`pages_manage_metadata`/`business_management` — worth checking the Testing tab next session to see if it registered (Meta says up to 24h). Screencast still needed.
   - Also noted in passing: submitting to App Review now prompts "Become a Tech Provider... you'll be required to complete access verification" — a business/identity verification step, not yet started.
2. Once App Review passes: verify comment-capture (not just Messenger) lands correctly in `/dashboard/leads` with dedupe/phone-auto-link — Messenger-side is now real-world-verified (this session), comments not yet tested against a real Meta-delivered webhook event.

### Fourth issue — RESOLVED 2026-08-04: Page connected, webhook subscribed, but zero leads captured

After the `business_management` fix, Page connect succeeded end-to-end, but a real comment + Messenger message sent to the connected Page produced **no rows in `facebook_leads`**, and `nginx` access logs showed **zero hits** on `/api/facebook/webhook` — Meta never called it. Two red herrings ruled out first: (a) added the sending account as an App Tester (App Roles → Testers) since dev-mode only delivers Messenger/Page events involving accounts with a role on the app — necessary but not sufficient here; (b) per-Page subscription (`POST /{page}/subscribed_apps`, called by `FacebookGraphClient::subscribeAppToPage()`) was confirmed already succeeding (`webhook_subscribed_at` set).

Actual root cause: **App-level webhook field subscriptions** (App Dashboard → Messenger API Settings → "1. Configure webhooks" → Webhook fields list) had `feed` and `messages` both showing **Unsubscribed**. This is a separate, one-time, app-wide gate on top of the per-Page subscription — Meta only delivers a field to *any* Page if the app itself is subscribed to that field. Toggled both to Subscribed via the dashboard (equivalent to `POST /{app-id}/subscriptions`, done once, not per-Page, not something `subscribeAppToPage()` can reach). After this, both a comment and a Messenger message landed correctly in `/dashboard/leads`.

**Fifth issue — RESOLVED same session: comment sender name/link showing blank.** `FacebookLeadCaptureService::captureComment()` read `$value['sender_name']` / `$value['sender_id']` — those keys don't exist in Meta's actual `feed` comment payload, which nests them as `$value['from']['name']` / `$value['from']['id']`. Fixed the key paths; backfilled the 2 leads captured before the fix from their stored `raw_payload`. Comment leads now show a clickable `facebook.com/{id}` profile link in `/dashboard/leads` (added client-side, comment-channel only).

Messenger sender names remain unavailable by design on Meta's side — webhook `messaging` events only ever carry the sender's PSID, never a name. Added `FacebookGraphClient::getUserProfileName()` (`GET /{psid}?fields=name`) as a best-effort lookup called from `captureMessage()`; live-tested and Meta returned nothing (privacy-restricted since the 2018 Messenger Platform policy changes) — expected, not a bug to chase further. Message leads display the numeric PSID only; no profile link is possible for PSIDs (not real, publicly resolvable user IDs).

### Reply-from-dashboard feature — added 2026-08-04

Seller can now reply to a lead directly from `/dashboard/leads` (`POST /api/facebook/leads/{id}/reply`, `FacebookLeadController::reply()`). `facebook_leads` gained `replied_at`/`reply_message` columns (migration `2026_08_04_164044_...`).

- **Message replies** — `FacebookGraphClient::sendMessage()`, `POST /me/messages` with `messaging_type: RESPONSE`. **Live-tested and confirmed working** (real reply sent to the test PSID during this session). Only works within Meta's standard 24-hour messaging window since the lead's last message — outside that window Graph API rejects it, surfaced to the seller as a normal error, not a 500.
- **Comment replies** — `FacebookGraphClient::replyToComment()`, `POST /{comment-id}/comments`. Needs `pages_manage_engagement`, which didn't exist anywhere in this app's permission catalog under the "Engage with customers on Messenger" use case (confirmed via UI search — zero matches). Root cause: that permission only ships under a *different* use case, **"Manage everything on your Page"** (Content management category) — added it to the app, then `pages_manage_engagement` became addable.

  Added `pages_manage_engagement` alone to the **BSOL Page Connect Login Configuration** first — this **broke the OAuth dialog entirely**, every Connect attempt hit Facebook's generic "Sorry, something went wrong" page (not one of our own error messages — nothing reached our callback at all). Root cause: `pages_manage_engagement` has an undeclared hard dependency on **`pages_read_user_content`**, which Meta's "we'll auto-select dependencies for you" UI copy claims to handle but did not actually add. Confirmed by process of elimination — removed `pages_manage_engagement` alone, Connect worked again immediately (back to 5 permissions); comment-reply then failed with our own clean 422 (`"comment replies need the pages_manage_engagement permission..."`), confirming the permission itself, not the OAuth flow, was gated. Added `pages_read_user_content` to the app (via the same "Manage everything on your Page" use case) and to the Login Configuration alongside `pages_manage_engagement` — Configuration is now 7 permissions: the original 5 + `pages_manage_engagement` + `pages_read_user_content`.

  **Confirmed working end-to-end 2026-08-04** after the seller disconnected/reconnected: Page connect, comment + Messenger lead capture, and both reply types (comment reply, message reply) all verified live by the user. Code (`replyToComment()`, controller, frontend) never changed during this debugging — only Meta-side Login Configuration permissions needed fixing (see above).

**Facebook lead-capture + reply feature is now fully functional in production for the connected test Page.** Still gated behind App Review (§3.1) before it works for sellers who aren't admin/developer/tester on the Meta app.

### Tech Provider / Access Verification — submitted 2026-08-04

Adding *any* permission to the App Review submission (not just `business_management`/`pages_manage_engagement` — confirmed this applies to the original 4 too) now requires the app to first register as a **Tech Provider**, an irreversible app-level classification for apps that access data belonging to businesses other than the app owner's own Business Portfolio — which fits BSOL's actual architecture (sellers connect their own Pages, outside our "Zareen Natural Foods" portfolio). Confirmed with the user this is the correct classification and registered.

Three sub-requirements, checked live at Apps → Review → Verification:
1. **Business verification** — already ✅ Verified (Zareen Natural Foods was verified separately, pre-existing — no new documents needed).
2. **Access verification** — a short questionnaire (no document upload): business type (SaaS Platform), how Platform Data is used on behalf of clients, whether we manage multiple business portfolios (No), website URL. Filled in and **submitted** — status "In review", Meta says up to 5 days.
3. **App Review** — not yet started; blocked until Access Verification clears, and still separately needs the screencast + real API test call requirements from §3.1.

Next session: check Access Verification status (Apps → Review → Verification), and once "Verified", proceed to the App Review submission draft (pages_show_list/pages_manage_metadata/pages_messaging/public_profile/pages_manage_engagement/pages_read_user_content, `business_management` intentionally left out per §3.1 note) — still needs screencasts + real API test calls before "Submit for review" enables.
- Needs re-adding to the App Review submission draft too (same as `business_management` — see §3.1 above) once that's resumed.

### App Review — submitted 2026-08-07

Tech Provider verification cleared (Meta email: "Your business has been verified as a Tech Provider" for both Zyrotech BSOL and the Zareen Natural Foods portfolio). Resumed the App Review submission and pushed it all the way to **"Submit for review"** — status now **Review in progress** (Meta: most submissions reviewed within 20 days).

All 8 permissions were in the submission's "New requests" list already (`business_management`/`pages_manage_engagement`/`pages_read_user_content` had in fact already been re-added in an earlier session, contrary to §3.1's note above): `pages_show_list`, `pages_manage_metadata`, `pages_messaging`, `public_profile`, `pages_manage_engagement`, `pages_read_user_content`, `business_management`, `pages_read_engagement`.

What was completed this session, per the submission's 5 sections:
1. **Allowed usage** (per-permission "how does your app use this" + screencast + API test call + compliance checkbox) — wrote the justification text for the 4 permissions that were missing it (`pages_read_user_content`, `pages_manage_engagement`, `business_management`, `pages_read_engagement`); the other 4 already had it. All 8 permissions' **real API test calls had already registered as "Completed"** — confirms the live testing done in earlier sessions (Page connect, comment reply, message reply) counted as genuine Graph API calls. Screencast videos were recorded and uploaded by the user (not something this browser session could do — no ability to record the user's own screen).
2. **App settings fixes** — found two wrong placeholder URLs in Basic Settings: **Terms of Service URL** and **User Data Deletion Instructions URL** were both pointing to `https://www.facebook.com/` (clearly never set). Fixed to `https://bsol.zyrotechbd.com/terms` and `https://bsol.zyrotechbd.com/privacy` respectively (the Privacy Policy's existing §7 "Your Rights & Choices" section already covers deletion requests, so it doubles as data-deletion instructions). Also added the missing **Website platform** (`https://bsol.zyrotechbd.com`) to App settings — required before the Reviewer Instructions section becomes accessible at all.
3. **Data handling** questionnaire (data processor/controller/government-request questions — the one genuinely legal/business-judgment section) — answered via explicit user confirmation: responsible entity = **Zyrotech BSOL**, country = **Bangladesh**, no third-party data processors (all data stays on the self-hosted server), no government/national-security data requests in the past 12 months, no formal public-authority-request policies in place yet ("None of the above" — honest for a brand-new company, not overclaiming).
4. **Reviewer instructions** — filled in the test URL, step-by-step testing instructions (connect Page → Facebook Leads inbox → Reply → Convert to Customer, referencing the exact Graph API calls per permission), "Is Facebook Login integrated? Yes", N/A for the payment/geo-restriction questions, and **test seller credentials** (provided by the user: `rzcomputer.bd@gmail.com` / user id 3) — this account already has the "Zyro Tech" Page connected with real leads in its inbox, so the Meta reviewer doesn't need to complete OAuth themselves to see the feature working.

All 5 sections went green and "Submit for review" was clicked with explicit user confirmation ("submit now").

**Next check-in:** Apps → Review → App Review on developers.facebook.com (app ID `1900768904642203`) — watch for reviewer questions or an approve/reject decision, up to ~20 days per Meta's estimate.

---

## 3.2 Bug fix — comment replies re-appearing as new leads (2026-08-07)

Seller-reported: replying to a comment from the BSOL dashboard caused that same reply to show up again as a brand-new lead in the Leads inbox, duplicating the conversation.

**Root cause:** `FacebookGraphClient::replyToComment()` posts the reply as the connected Page (`POST /{comment-id}/comments`). Meta redelivers that new comment through the exact same `feed` webhook event as any customer comment — unlike Messenger, which flags the Page's own outgoing messages with `is_echo: true`, comment webhook payloads carry no such flag. `FacebookLeadCaptureService::captureComment()` had no check for this, so every reply we sent came back around and got stored as a fresh lead authored by "ourselves" (`from.id` == the Page's own `fb_page_id`).

**Fix:** `captureComment()` now returns early when `$value['from']['id'] === $connection->fb_page_id`. One bad lead already in production (id 6, the literal echo of a reply) was deleted via tinker as cleanup.

## 3.3 Leads Manager UI redesign (2026-08-07)

Same request also asked for a more usable Leads Manager (`frontend/src/app/dashboard/leads/page.tsx`) and a matching backend `FacebookLeadController::index()` update:
- Search (`q` param — matches message/sender_name/detected_phone via `ilike`), sort (`sort=newest|oldest`), unread-only filter, alongside the existing channel/status filters.
- Pagination controls (backend already paginated via `per_page`/`page`; frontend now reads `meta.total/current_page/last_page` and renders prev/next).
- Conversation now renders as chat bubbles (incoming message left, our reply right) instead of a flat "your reply: ..." line — makes the reply-thread bug above much easier to spot visually too.
- Avatar-with-channel-icon per lead, unread count badge, tidied action buttons.

---

## 4. Related — Queue Worker Gap — ✅ FIXED 2026-08-08 (was: discovered during this work, not fixed)

Building the webhook receiver surfaced that this deployment has **no queue worker process** at all — `QUEUE_CONNECTION=redis` but nothing runs `php artisan queue:work` (checked: no systemd service, no supervisor, no cron entry beyond `schedule:run`). This means any `ShouldQueue` job dispatched with `->delay()` (specifically `SendAutomationSmsJob` for `delay_minutes > 0` SMS automation rules) silently never executes. Full detail in `SAAS_MODULE_CONTEXT.md` §17.0 finding #12 / §17.5 / §17.10.

**Update:** fixed 2026-08-08 — `hybrid-queue-worker.service` (systemd, `queue:work redis`) now runs persistently. The Facebook webhook receiver itself is **still sync by design** (light DB-only work, well within Meta's response budget — see §1 above), but the queue being available now is a real option for §6 item 6 below if async processing is ever wanted.

---

## 5. Resuming This Work — Quick Orientation

- Real credentials (App ID/Secret/Webhook verify token) are in `platform_facebook_settings` (DB, encrypted) — check via `/admin/settings/facebook` (masked) or `php artisan tinker` → `App\Models\PlatformFacebookSetting::getSetting()->masked()`. Never re-print the raw secret into a doc or commit.
- To test the webhook handshake without Meta: `curl "https://bsol.zyrotechbd.com/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=test"` should echo `test` with `200`.
- To test lead capture without a real Page: rollback-wrapped tinker test pattern is in the session history — construct a synthetic `entry[].changes[]` (comment) or `entry[].messaging[]` (message) payload and call `app(FacebookLeadCaptureService::class)->handle($payload)` inside `DB::beginTransaction()/rollBack()`.
- ~~The uncommitted `platform_facebook_settings` admin-config-UI changes should be committed together~~ — stale note, this was already committed (`28d4623`, `03e8b1a`) before this correction was made; `git status`/`git log` confirmed clean as of 2026-08-08.

---

## 6. সুপারিশকৃত ভবিষ্যৎ কাজ (Recommendations, added 2026-08-08 — owner: "পরবর্তীতে এই কাজগুলো করব")

App Review approve না হওয়া পর্যন্ত non-admin seller-দের জন্য ফিচারটা কাজ করবে না, কিন্তু approve হওয়ার আগেই নিচের কাজগুলো প্ল্যান/prioritize করে রাখা যায়। Priority অনুযায়ী সাজানো।

### 6.1 লজিক/ব্যাকএন্ড

| # | সুপারিশ | বিস্তারিত |
|---|---|---|
| 1 | Multi-page support | `facebook_page_connections`-এ `unique('user_id')` — এক seller = এক Page। Multi-page picker UI আছে শুধু "কোনটা কানেক্ট করব" বাছাইয়ের জন্য, একসাথে একাধিক রাখার জন্য না। একাধিক ব্র্যান্ড/পেজ চালানো বড় seller-দের জন্য ব্লকার |
| 2 | Keyword-triggered auto-reply | এখন শুধু manual reply (dashboard থেকে ক্লিক করে)। Original vision-এ ছিল "keyword detection → auto-reply", MVP-তে ইচ্ছাকৃতভাবে বাদ গেছে |
| 3 | Facebook Lead Ads form integration | আলাদা webhook field (`leadgen`) — organic comment/Messenger থেকে সম্পূর্ণ ভিন্ন, এখনো implement হয়নি। পেইড lead-gen ক্যাম্পেইন চালানো seller-দের জন্য দরকার |
| 4 | CAPI (Conversions API) Purchase event | মূল SaaS vision-এর "Ads ROI Tracker" অংশ ছিল, Lead-capture MVP-তে বাদ। ল্যান্ডিং পেজ checkout থেকে server-side Purchase event পাঠালে seller-এর ad campaign নিজে থেকে optimize হবে |
| 5 | Lead → Order conversion attribution | কোন লিড শেষে অর্ডারে কনভার্ট হলো তার ট্র্যাকিং নেই — Analytics-এর Ads ROI placeholder খোলার prerequisite |
| 6 | Webhook processing async-এ move করা | queue worker এখন সচল (§4-এর আপডেট দেখো) — sync থেকে queued job-এ সরালে Meta timeout risk কমবে; আগে queue না থাকায় sync বাধ্যতামূলক ছিল, এখন optional upgrade |
| 7 | Comment webhook বাস্তব ট্রাফিকে পর্যবেক্ষণ | App Review-এর জন্য synthetic payload দিয়ে verify হয়েছিল, real production comment volume-এ এখনো observe করা হয়নি |
| 8 | `business_management` non-portfolio seller-এ টেস্ট | শুধু ১টা admin-owned (Business-Portfolio) Page দিয়ে verify হয়েছে (§3 "Third issue")— সাধারণ ব্যক্তিগত Page-ওয়ালা seller-এ কাজ করবে কিনা confirm বাকি |

### 6.2 ডিজাইন/UX

| # | সুপারিশ | বিস্তারিত |
|---|---|---|
| 9 | Sidebar unread badge | ব্যাকএন্ডে `GET /facebook/leads/unread-count` route আগে থেকেই আছে (`FacebookLeadController::unreadCount`) কিন্তু frontend কোথাও ব্যবহার করে না। ঠিক এই প্যাটার্নেই support-chat-widget-এ pulsing badge + toast বানানো হয়েছিল (commit `bd3bb08`) — একই প্যাটার্ন এখানে বসালে seller প্যাসিভলি নতুন লিড জানতে পারবে, এখন ম্যানুয়ালি পেজ চেক করতে হয় |
| 10 | Conversion funnel/stats card | Leads inbox এখন শুধু list+filter — লিড কাউন্ট vs customer-conversion কাউন্ট এমন summary card নেই |
| 11 | Quick-reply template | Common প্রশ্নের জন্য প্রি-সেট reply টেমপ্লেট |
| 12 | Lead priority/visual badge | phone-detected lead vs শুধু নাম-পাওয়া lead — backend `detected_phone` দিয়ে distinguish করে কিন্তু UI-তে জোরালো visual cue নেই |

### Suggested execution order
App Review approve হওয়ার পরে বাস্তব ট্রাফিক দেখে re-prioritize করা ভালো, তবে এখনকার best-guess order: **#9 (কম effort, ready backend) → #5/#4 (Ads ROI আনলক করে) → #1 (বড় seller ব্লকার) → বাকিগুলো।**
