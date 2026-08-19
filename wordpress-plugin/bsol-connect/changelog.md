# BSOL Connect — Changelog

## 1.19.2 — 2026-08-19

Second live-test fix, same day: after 1.19.1, the seller reported no
payment method showed at checkout at all, and no enable/disable setting
was findable anywhere — even though BSOL dashboard confirmed the channels
were correctly enabled/configured server-side.

- **Root cause**: this site's checkout page uses WooCommerce's **block-based
  Checkout** (the Cart & Checkout block, WooCommerce's default on
  new/updated sites since 8.3) rather than the classic `[woocommerce_checkout]`
  shortcode. A plain `WC_Payment_Gateway` (what `class-bsol-gateway.php`
  registers) is only visible on the *classic* checkout — the block
  checkout requires a *separate* Store API integration
  (`AbstractPaymentMethodType`) to make a payment method selectable there
  at all. Without it, the gateway is silently invisible — no error, no
  log entry, it just never renders. (This plugin's other checkout-time
  modules — repeat-order-block, checkout-block — already special-cased
  block checkout for their own hooks; the new payment-gateway module
  hadn't yet.)
- **Fix**: new `Bsol_Gateway_Blocks_Support` (one instance per enabled
  channel, mirroring `Bsol_Gateway`'s own per-channel instantiation) +
  `assets/js/bsol-gateway-blocks.js` (no build step — plain
  `wp.element.createElement()` calls against WooCommerce's own exposed
  globals, same approach lightweight non-bundled Blocks-compatible gateway
  plugins use). Registered via `woocommerce_blocks_payment_method_type_registration`,
  guarded behind `class_exists()` so older WooCommerce/Blocks versions
  simply fall back to classic-checkout-only support instead of erroring.
  `process_payment()` itself needed no changes — the Store API still calls
  the same `WC_Payment_Gateway::process_payment()` server-side; this
  addition only makes the option selectable in the block checkout's UI.
- If your checkout page still uses the classic shortcode (WooCommerce →
  Settings → Advanced → Checkout page), you were never affected by this —
  block-only issue.

## 1.19.1 — 2026-08-19

Live-test fix, same day as 1.19.0's release, reported by the first seller
who actually activated it: **BSOL: {Provider} payment methods never
appeared at all, and Cash on Delivery vanished from checkout too.**

- **Root cause**: `class-bsol-gateway.php` declared `class Bsol_Gateway
  extends WC_Payment_Gateway` and was `require_once`'d unconditionally
  inside `Bsol_Master::load_dependencies()`, which runs on this plugin's
  own `plugins_loaded` callback. PHP resolves a class's parent
  *immediately* when the file is parsed — but WooCommerce is not
  guaranteed to have defined `WC_Payment_Gateway` yet at that exact point;
  hook-callback ordering between two *different* plugins registered on the
  same `plugins_loaded` priority isn't something to rely on (a
  well-documented WooCommerce extension pitfall). If WooCommerce's own
  gateway classes hadn't loaded yet, this was a PHP fatal error on every
  page load — which would abort the rest of that request's plugin/hook
  execution entirely, plausibly explaining why even *native* WooCommerce
  payment methods (Cash on Delivery) stopped showing at checkout, not just
  BSOL's own.
- **Fix**: the require + registration for the payment-gateway module alone
  is now deferred to `woocommerce_loaded` — WooCommerce's own action,
  fired only once its core classes are guaranteed to exist, regardless of
  plugin load order. Every other module in this plugin was already safe
  from this specific problem (none of them extend a WooCommerce core class
  at file-parse time), so only this one module needed to move.
- **Also hardened**: `Bsol_Gateway::process_payment()` now proactively
  calls the existing order-sync method right before asking BSOL to
  initiate a payment, instead of assuming `woocommerce_new_order` already
  synced the order in every checkout flow. Classic checkout's ordering
  (order created, then `process_payment()` runs, same request) was already
  safe; WooCommerce Blocks' Store API checkout builds/updates a draft
  order across separate earlier requests, which is a looser guarantee.
  This call is a safe, idempotent no-op when the order was already synced
  (`ConnectOrderController::sync()` is a create-or-update upsert and
  doesn't redispatch OTP/CAPI on update) — it fixes the "No synced order
  found for this wc_order_id yet" error some checkouts hit.

If you already have 1.19.0 installed, re-download the plugin from your
BSOL dashboard and reinstall — this isn't a WordPress.org-distributed
update, so the self-update notice is informational only, it won't install
this for you.

## 1.19.0 — 2026-08-19

- **Online payment gateways** — every channel enabled on the seller's BSOL
  account now shows up as a WooCommerce payment method automatically:
  personal-wallet send-and-verify (bKash/Nagad/Rocket, no merchant account
  needed) and automated checkout (SSLCommerz, AamarPay, ZiniPay, ShurjoPay,
  EPS, bKash Merchant, Nagad Merchant). New `payment-gateway` module:
  `Bsol_Gateway` (one `WC_Payment_Gateway` class, instantiated once per
  enabled channel — WooCommerce accepts pre-built objects from the
  `woocommerce_payment_gateways` filter, so no per-provider subclass was
  needed) + `Bsol_Payment_Gateway` (registration, channel-list caching, and
  two new endpoints this feature required beyond the existing
  `/connect/v1/*` surface):
  - `GET /wp-json/bsol-connect/v1/payment-return` — a browser-redirect
    bridge. BSOL's gateway callback confirms a payment server-to-server (it
    never talks to WordPress at all during that step) and then needs to
    send the customer's browser back to *this site's own* order-received
    page — but BSOL has no `wc_get_order()` to build that URL correctly
    (needs the order `key`, and "checkout" isn't a guaranteed permalink
    slug), so it redirects here instead and this route builds the real URL
    via `get_checkout_order_received_url()`.
  - `POST /wp-json/bsol-connect/v1/payment-status` — inbound webhook (same
    `X-BSOL-Webhook-Secret` auth as the existing `/stock-update` route),
    BSOL → here, telling WooCommerce a payment was confirmed
    (`$order->payment_complete()`), since nothing in WooCommerce's own
    request cycle would otherwise learn that.
  - Order-received page also gets a small send-money-and-submit-TrxID form
    for wallet_manual channels (mirrors the BSOL landing-page checkout's
    own claim card), and a success/failed banner for gateway_auto channels.
  - No credential fields added to WooCommerce's payment-gateway settings
    screens — configuration stays in the BSOL dashboard only, same as
    courier credentials and the checkout-OTP toggle elsewhere in this
    plugin.
  - Known limitation: the wallet-claim form doesn't support the optional
    screenshot upload the BSOL dashboard/landing-page flow offers —
    TrxID + sender number only, for now.

## 1.18.0 — 2026-08-16

- **Purchase event match-quality fix**: `build_order_payload()` now
  forwards `_fbp`/`_fbc` cookies (read from `$_COOKIE` at order-sync
  time, same PHP request as checkout — same source `client_ip`/
  `user_agent` already used) alongside the existing IP/UA/URL fields.
  1.17.0's changelog entry claimed the browser-side Purchase copy on
  the order-received page "dedupes for free" against the server-side
  one for match-quality enrichment — that was wrong: BSOL's ingest
  only ever kept the *first* copy of a duplicate event_id and silently
  dropped every field the second copy carried, so fbp/fbc from the
  browser copy never actually reached Meta. The server-side Purchase
  event (fired at order-sync time, from `ConnectOrderController`) now
  carries fbp/fbc directly, and BSOL's ingest pipeline separately
  gained a genuine merge-on-duplicate fallback for any race this
  doesn't already cover. No plugin-side action needed for the fix
  itself beyond updating — the browser-side Purchase copy this file's
  own JS already fires stays as-is, it's simply no longer the only way
  fbp/fbc could reach Meta.

## 1.17.0 — 2026-08-16

- **Facebook/Meta tracking for WooCommerce**: a new `Bsol_Tracking`
  module — Meta Pixel base code in `wp_head` (id fetched from BSOL,
  cached 1h, never hardcoded), PageView/ViewContent on load,
  AddToCart (classic form submit + WooCommerce's own AJAX
  `added_to_cart` event), InitiateCheckout on the checkout page,
  Lead when billing phone/email becomes valid, and a browser-side
  Purchase copy on the order-received page for fbp/fbc match-quality
  enrichment (the authoritative Purchase already fires server-side at
  order-sync time — this repeat submission dedupes for free against
  BSOL's own `tracking_events` unique index). Every event relays
  through `admin-ajax.php` (`bsol_track_event`, nopriv) rather than a
  direct browser→BSOL call — the plugin's API key never reaches the
  browser, same trust model as every other module, and still
  same-origin against ad blockers/Safari ITP either way. `DNT: 1` is
  always honoured. Order-flow events (Confirmed/Shipped/Delivered/
  Returned/Canceled) are deliberately *not* sent from here — BSOL's
  own `OrderStatusService::transition()` is their authoritative
  source, not WooCommerce's lagging status.

## 1.16.0 — 2026-08-14

- **Checkout blacklist block**: optionally stop checkout for a phone
  number this seller has blacklisted on their BSOL dashboard (Orders
  → Blacklist) — a new `Bsol_Checkout_Block` module, settings in
  **BSOL Connect → Settings** (off by default). Unlike Repeat Order
  Block, this needs a real BSOL API call (the blacklist lives on
  BSOL), reusing the same `check_fraud()` call the Customer Health
  column already makes. Fails open on any network error. Covers both
  classic and block-based Store API checkout.
- **BSOL order statuses**: two new WooCommerce order statuses,
  "BSOL: Confirmed" and "BSOL: Shipped", for BSOL vocabulary that has
  no native WooCommerce equivalent — selectable from the order edit
  screen and as a bulk action on the orders list. Deliberately
  narrower than legacy zayroo-connect's 5-status version, which
  replaced native WC statuses (processing/completed/cancelled/
  refunded) outright — these two only add to WooCommerce's own
  vocabulary, nothing native is touched or reinterpreted.
- **Manual SMS**: a new "SMS" column on the orders list with a
  one-click "Send SMS" button — type a message, it goes out via
  BSOL's SMS gateway immediately, no need to switch to the BSOL
  dashboard's Send SMS page. Delegates entirely to
  `/connect/v1/sms/send` (new) → the same
  `AdminSmsGatewayController::send()` the dashboard itself uses —
  same gateway selection, credit deduction, and history logging.

## 1.15.0 — 2026-08-14

- **Repeat order block**: optionally stop the same phone number from
  placing a second order within a configurable window (default 24
  hours) — a new `Bsol_Repeat_Order_Block` module, settings in
  **BSOL Connect → Settings** (off by default). Fully local to this
  site — checked against this site's own WooCommerce order history,
  no BSOL API call needed for the check itself. Covers both classic
  (shortcode) checkout and WooCommerce's block-based Store API
  checkout (the legacy zayroo-connect version only ever covered
  classic checkout). Shows how many hours are actually left, not the
  full configured window regardless of elapsed time.

## 1.14.0 — 2026-08-14

- **Abandoned/incomplete checkout tracking**: the plugin now captures
  name/phone/email/address + cart contents as a customer fills the
  checkout form, before the order completes, and sends it to BSOL — a
  new "Checkout in progress" module (`Bsol_Abandoned_Checkout`), the
  second storefront-facing module after checkout OTP. Shows up in the
  same BSOL dashboard → Abandoned Checkouts list/detail view landing
  pages already use, tagged with which site it came from. Automatically
  flips to "Converted" once the customer completes the order — no
  wp-admin UI added to the plugin itself, the seller manages everything
  from the BSOL dashboard.

## 1.13.1 — 2026-08-13

Fix: sites that had viewed the orders list on 1.12.0 or earlier still had
`bsol_health_{phone}` transients cached in the old fraud_score shape (up
to 24h left on their TTL) — 1.13.0 read that stale shape as-is instead of
fetching fresh courier data, so every order except whichever phone had
already been re-checked showed "No data". Cache key bumped to
`bsol_health_v2_{phone}`; old entries just expire unread.

## 1.13.0 — 2026-08-13

- **Customer Health redesigned**: was a generic 0-100 fraud score (always
  0 for a phone with no prior BSOL order history — true for most
  WooCommerce-only customers). Now a delivered-vs-not progress bar built
  from live per-courier delivery history (Steadfast/Pathao/RedX/CarryBee/
  Paperfly) — the same data BSOL's own dashboard "Courier Delivery
  History" panel shows. Click the bar for a per-courier breakdown.
- Still cached per phone number in a WP transient (24h) — BSOL only ever
  sees one request per phone per cache window, no matter how many times
  the order list is viewed. Backend: new `POST /connect/v1/fraud/courier-health`.

## 1.12.0 — 2026-08-13

UI/UX pass — no backend changes:

- **Admin UI redesigned** to match BSOL's own dashboard (teal accent,
  pill nav tabs, card layout, status pill) instead of generic wp-admin
  chrome — settings, dashboard, activity log, and sync-data tabs.
- **Courier column, WooCommerce orders list**: the 5 separate
  "Send via ..." buttons are replaced with one "Book to Courier" button
  that opens a dropdown to pick the courier. The booked state now shows
  a status badge + refresh/cancel/print icon buttons instead of plain
  text links.
- Customer Health badge restyled to match (pill shape, same semantic
  colors).

## 1.11.0 — 2026-08-13

Distribution/polish pass — no new sync features:

- **Self-update notice**: an admin notice appears in wp-admin when a
  newer version is available on BSOL, with a direct download link.
  Checked at most once every 12 hours (transient-cached), not on every
  page load. Runs regardless of connection status.
- **Translation-ready**: `languages/bsol-connect.pot` — every
  user-facing PHP string already went through `__()`/`_e()`/
  `esc_html__()`/etc. with the `bsol-connect` text domain since day
  one; this adds the actual template file a translator would use.
- **`readme.txt`** — standard WordPress plugin readme format, alongside
  the existing `changelog.md` (full history) and `SETUP.md` (QA
  checklist).

## 1.10.0 — 2026-08-13

Order invoice PDF — a seller→customer sales invoice, distinct from the
courier waybill/sticker label:

- New "Invoice" column on the WooCommerce orders list — a print icon
  next to any synced order, no courier-booking required (works even for
  an order that was never sent to a courier).
- Same 22-template-free, always-available PDF BSOL's own dashboard
  already generates — no new logic, just a new proxy (same pattern as
  the waybill print icon).

This completes the outbound/inbound WooCommerce order lifecycle: sync,
status, courier booking, waybill, checkout OTP, Facebook CAPI, and now
invoicing.

## 1.9.0 — 2026-08-13

Bulk/historical sync — new **Sync Data** tab:

- **Sync All Products** / **Sync All Orders** buttons push everything that
  existed *before* this site connected — new products/orders already sync
  automatically going forward, this is only for the backlog.
- Batched with a progress bar (10 at a time), safe to leave running or
  re-run — never creates duplicates (same upsert logic as live sync).
- Backfilled orders sync with their real current WooCommerce status, but
  deliberately do **not** trigger a checkout-OTP SMS or a Facebook
  Purchase event — those only make sense for an order actually placed
  just now, not one from weeks or months ago.

## 1.8.0 — 2026-08-13

Facebook Conversions API (CAPI) — a Purchase event now fires on BSOL's
side for every WooCommerce order synced here, same as BSOL's landing
pages already do:

- No setup on the WordPress side — configure Facebook Pixel ID + Access
  Token once on the BSOL dashboard (Settings → Facebook), and it applies
  automatically to every synced order.
- The plugin forwards the customer IP address and user agent WooCommerce
  already records at checkout (`WC_Order::get_customer_ip_address()` /
  `get_customer_user_agent()`) plus the checkout page URL — nothing new
  is collected, just relayed — so Meta's ad-attribution match quality is
  as good as it would be from a native Facebook-for-WooCommerce plugin.
- Only fires once, when an order is first synced — never on updates.
- No-op if Facebook CAPI isn't configured for the shop.

## 1.7.0 — 2026-08-13

Checkout OTP verification for WooCommerce orders — the first storefront
(not wp-admin) feature in this plugin:

- Off by default. Turn it on from BSOL dashboard → Settings → WordPress
  Connect (requires an SMS gateway with balance already configured).
- When on, a synced order gets a code texted to the customer's phone; a
  small verification card appears on WooCommerce's own order-received
  page, blocking nothing else on that page. Entering the right code
  confirms the order (`pending` → `confirmed`) on BSOL.
- Reuses BSOL's existing landing-page checkout-OTP engine end to end
  (same attempts/expiry/resend-cooldown rules) — no new verification
  logic, just a new surface for it.
- The verify/resend AJAX handlers are registered `nopriv` (checkout is
  normally anonymous) and only ever enqueue their JS/CSS on the
  order-received page itself.

## 1.6.0 — 2026-08-13

Pathao, RedX, and CarryBee booking, for orders synced from WooCommerce:

- Three new buttons in the **Courier** column, alongside Steadfast and
  Paperfly. No new logic on the WordPress side — the address→location-ID
  resolution happens entirely on BSOL (`CourierLocationResolverService`).
- Best-effort: BSOL tries to determine the delivery city/zone/area from
  the order's address text. When it can't do so confidently, booking
  fails with a specific message (e.g. "could not determine the zone
  within Dhaka") instead of a cryptic remote courier error — same as the
  message Pathao/RedX/CarryBee used to always show before this version.
- Orders with a short, vague, or non-Bangladeshi address are unlikely to
  resolve — this works best with a normal, specific delivery address.

## 1.5.0 — 2026-08-13

Inbound stock push-back — the first BSOL → WordPress direction:

- If a unit of a WooCommerce-linked product/variant is sold through
  another BSOL channel (Facebook, manual order), BSOL now pushes the
  updated stock quantity back to this site automatically, so WooCommerce
  never oversells a unit that's already gone.
- New REST endpoint `wp-json/bsol-connect/v1/stock-update`, authenticated
  by a dedicated webhook secret issued at connect time (separate from the
  API key, which BSOL never stores in reversible form) — reconnect after
  updating if the site was connected before this version.
- Guarded against an echo-loop the same way the legacy zayroo-connect
  plugin did: this plugin's own save hooks are unhooked for the instant
  it writes a stock value that came from BSOL.
- A dashboard-side stock edit or a WooCommerce-side sale still work
  exactly as before — untouched by this change.

## 1.4.0 — 2026-08-13

Reliability and hygiene pass — no new outward features, hardens the five
modules already shipped:

- **HPOS compatibility declared** (`FeaturesUtil::declare_compatibility`)
  — the plugin already only used `WC_Order::get_meta()`/
  `update_meta_data()`, this just tells WooCommerce so, removing the
  "untested" badge on the Plugins page.
- **Activity Log tab** — every call to BSOL (connect, order/product/status
  sync, fraud check, courier book/track/cancel) now records a success/
  fail entry (last 50, `BSOL Connect → Activity Log`), so a sync that
  silently failed is finally visible instead of just... not showing up.
- **Automatic retry** for failed order sync (3 attempts, 5 min apart) and
  product sync (3 attempts, 2 min apart) via WP-Cron, tracked in the
  order/product's own meta. Gives up and logs a permanent-failure entry
  after the 3rd attempt rather than retrying forever.
- **`uninstall.php`** — deleting the plugin now revokes the API key on
  BSOL's side and removes every option/transient it created. Previously
  nothing was cleaned up.
- Trashing or permanently deleting a WooCommerce product now syncs it to
  BSOL as inactive — previously a deleted product stayed "active" in
  BSOL forever.

## 1.3.0 — 2026-08-13

Print the courier waybill/sticker label PDF for a booked order — same
22-template system, barcode/QR, and real Bengali shaping the BSOL
dashboard already generates, no new logic on either side.

- A print icon appears next to a booked order's tracking info in the
  **Courier** column, opening the PDF in a new tab.
- Implemented as a plain link + `admin-post.php` handler, not AJAX — the
  browser can't attach the plugin's API key itself, so WordPress fetches
  the PDF server-side (where the key is known) and streams it back. Same
  standard WP pattern as a CSV-export download link.

## 1.2.0 — 2026-08-13

Courier booking, directly from the WooCommerce orders list:

- New "Courier" column (legacy + HPOS) — "Send via Steadfast"/"Send via
  Paperfly" buttons before booking; consignment ID + status + refresh/
  cancel links after.
- **Restricted to Steadfast and Paperfly.** Pathao, RedX, and Carrybee all
  need their own city/zone/area *ID* that a WooCommerce order has no way to
  supply — BSOL rejects those cleanly server-side rather than surfacing a
  confusing remote-API failure. A real address→location-ID resolver for
  those three is a separate, later feature.
- A "Steadfast Balance" widget on the plugin's Dashboard tab.
- Order-list meta is stored via `WC_Order::update_meta_data()` (HPOS-native),
  not `update_post_meta()`.

## 1.1.0 — 2026-08-12

Product sync (outbound only — WooCommerce → BSOL):

- Simple and variable products, synced on `save_post_product`,
  `woocommerce_product_quick_edit_save`, and `woocommerce_reduce_order_stock`
  (same trigger set as `zayroo-connect`'s proven product-sync module).
- WooCommerce's regular/sale-price model is translated into BSOL's
  amount-discount model; products missing a SKU get a stable synthetic one
  (`WC-{id}`) since BSOL requires one.
- Orders synced after a matching product now link their line items to real
  `Product`/`ProductVariant` rows by SKU (falls back to an unlinked ad-hoc
  line item on a miss, same as before).
- **Backend bug fix (unrelated to this plugin, but blocking it):**
  `ProductVariantController::validateVariantPayload()`'s hand-built SKU
  uniqueness rule crashed on every variant *create* call
  ("Undefined array key 1") — only updates happened to work. Fixed with
  `Rule::unique()`.

**Not yet implemented**: inbound stock push-back (BSOL → WooCommerce) —
requires BSOL to call out to the seller's own WordPress REST API, a
separate phase. See `bsol_history_and_new_context.md` §5.2.

## 1.0.0 — 2026-08-12

Initial release. Adapted from the proven `zayroo-connect` plugin architecture
(`zyro/wordpress_plugin/zayroo-connect`) — thin client, domain-bound API key,
zero business logic on the WordPress side. Scope matches BSOL backend Phase 1
(`/api/connect/v1/*`):

- Settings tab: connect (API key + domain-bound handshake) / disconnect.
- Dashboard tab: connection status + a manual "Test Fraud Check" tool.
- Order sync: new orders and status changes pushed to BSOL
  (`woocommerce_new_order`, `woocommerce_order_status_changed`), with a
  filterable WC-status → BSOL-status map (`bsol_connect_status_map`).
- "Customer Health" column on the WooCommerce orders list (legacy + HPOS),
  backed by BSOL's phone fraud/delivery-history check, 24h transient cache.

**Not yet implemented** (no backend support yet — see
`bsol_history_and_new_context.md` §5.2): product sync, checkout OTP, courier
booking from WP admin, Facebook CAPI, waybill PDF download.
