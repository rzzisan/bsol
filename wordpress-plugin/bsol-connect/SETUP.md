# BSOL Connect — Setup & Manual QA

No WordPress/WooCommerce install exists in the environment this plugin was
built in, so it has been verified by PHP lint and structural review only
(every hook name, nonce action, and AJAX action name cross-checked between
the PHP handlers and `assets/js/bsol-admin.js`). Run this checklist against
a real WooCommerce staging site before rolling out to sellers.

## Install

1. Zip the `bsol-connect/` folder, or copy it directly into
   `wp-content/plugins/bsol-connect/` on the target site.
2. Activate **BSOL Connect** in WP Admin → Plugins (requires WooCommerce
   active — the plugin shows an admin notice on its own page if not).

## Connect

1. On the BSOL dashboard: **Settings → WordPress Connect**, enter the exact
   domain of the WooCommerce site, click **Generate API Key**, copy the raw
   key shown (shown once).
2. On the WordPress site: **BSOL Connect → Settings**, paste the key, **Save
   & Connect**.
3. Expect "Connected successfully!" and the Dashboard tab to show the shop
   name/domain. A domain mismatch shows BSOL's own error message directly.

## Product sync

1. Create a simple WooCommerce product (name, SKU, regular price, a sale
   price, stock quantity) and publish it.
2. In BSOL dashboard → Products, confirm it appears with matching
   name/price/discount/stock, tagged as synced from WooCommerce.
3. Create a **variable** product with 2+ variations (different SKUs/prices/
   stock per variation), publish it.
4. Confirm the parent product and all variants appear in BSOL, with
   `has_variants` on and each variant's own stock/price.
5. Edit the price or stock of the simple product (or a variation) and save
   — confirm BSOL updates the *same* product/variant, not a duplicate.
6. Place a WooCommerce order using a SKU that was already synced — confirm
   the resulting BSOL order's line item is linked to the real product (not
   just an unlinked ad-hoc entry).

## Courier booking

1. On a synced order, open **WooCommerce → Orders** — under the **Courier**
   column, click **Send via Steadfast** (or **Send via Paperfly** — these
   are the only two supported for WooCommerce orders; Pathao/RedX/Carrybee
   need location data this plugin can't supply yet).
2. Confirm a consignment ID + status appears in the column.
3. Click the refresh icon — confirm the status updates.
4. Click the cancel icon — Paperfly should cancel; Steadfast should show a
   clear "not supported" message (expected — Steadfast's API has no cancel
   endpoint).
5. On **BSOL Connect → Dashboard**, click **Check Balance** — confirm it
   shows your Steadfast balance (or a clear "not configured" message if you
   haven't added Steadfast credentials on the BSOL dashboard yet).
6. On the same booked order, click the printer icon in the **Courier**
   column — confirm a waybill PDF opens in a new tab, matching whatever
   sticker template is set as default on your BSOL dashboard.

## Order sync

1. Place a test order on the WooCommerce store (any payment method).
2. In BSOL dashboard → Orders, confirm it appears with source `woocommerce`,
   matching customer name/phone/address/line items.
3. Change the WooCommerce order status to **Processing**, then
   **Completed**. Confirm in BSOL the order moves to `confirmed` then
   `delivered` (see `Bsol_Helpers::status_map()` for the full mapping) and a
   new entry appears in the order's status-log timeline.

## Fraud check

1. Open **WooCommerce → Orders** — confirm the **Customer Health** column
   renders a score for each order within a few seconds (AJAX-loaded).
2. On **BSOL Connect → Dashboard**, use **Test Fraud Check** with a known
   phone number and confirm the risk level/score matches what BSOL's own
   dashboard fraud-check tool shows for the same number.

## Disconnect

1. **BSOL Connect → Settings → Disconnect**, confirm the dialog.
2. Place another test order — confirm it does **not** sync to BSOL.
3. In BSOL dashboard → Settings → WordPress Connect, confirm the key shows
   as revoked.

## Checkout OTP (1.7.0)

1. On BSOL dashboard → Settings → WordPress Connect, confirm an SMS
   gateway is configured with a positive balance, then turn on
   **Checkout OTP Verification**.
2. Place a test order on the WooCommerce store with a valid Bangladeshi
   phone number.
3. Confirm an SMS with a 4-digit code arrives, and the order-received
   page shows a "Verify your phone number" card — confirm nothing else
   on the page is hidden/broken by it.
4. Enter the wrong code — confirm a clear error appears and the page
   doesn't reload/break.
5. Enter the right code — confirm the card disappears and, in BSOL
   dashboard → Orders, the order's status is `confirmed`.
6. Click **Resend code** twice in a row — confirm the second attempt is
   blocked with a cooldown message (matches the existing landing-page OTP
   resend limits — 2 resends, then a 1-hour block).
7. Turn the toggle back off — confirm a new test order does **not**
   trigger an SMS or show the verification card.

## Order invoice (1.10.0)

1. On **WooCommerce → Orders**, find the **Invoice** column on any synced
   order — including one that was **never** courier-booked.
2. Click the print icon — confirm a PDF opens with correct line items,
   totals, and the shop's own info (matches what the same order's invoice
   looks like from the BSOL dashboard).
3. Confirm it also works for an order booked with a courier (no conflict
   with the Courier column's own waybill print icon).

## Bulk/historical sync (1.9.0)

1. On a site with pre-existing products and orders (created *before*
   connecting, or before this version), go to **BSOL Connect → Sync
   Data**.
2. Click **Sync All Products** — confirm the progress bar reaches 100%
   and every pre-existing product appears in BSOL dashboard → Products.
3. Click **Sync All Orders** — confirm every pre-existing order appears
   in BSOL dashboard → Orders, each with its **real current** status
   (not stuck at "pending").
4. Confirm no OTP SMS was sent and no Facebook Purchase event fired for
   any of the backfilled orders (check Activity Log / SMS history / Meta
   Events Manager — none should show new activity from step 3).
5. Click **Sync All Products** again — confirm no duplicate products are
   created (same products, same count).

## Facebook CAPI (1.8.0)

1. On BSOL dashboard → Settings → Facebook, configure a Pixel ID + Access
   Token (and optionally a Test Event Code for Meta's Test Events tool),
   make sure it's enabled.
2. Place a test order on the WooCommerce store.
3. In Meta Events Manager (or the Test Events tool if a test event code
   is set), confirm a `Purchase` event appears within a minute or two,
   with `client_ip_address`/`client_user_agent`/a hashed phone number
   attached, and `event_source_url` pointing at the store's checkout URL.
4. Sync the same order again (e.g. change its status in WooCommerce) —
   confirm a second Purchase event does **not** fire.

## Pathao/RedX/CarryBee booking (1.6.0)

1. Make sure Pathao/RedX/CarryBee credentials are configured on the BSOL
   dashboard (Settings → Courier) for the courier you're testing.
2. Place a WooCommerce order with a **real, specific Bangladeshi address**
   (e.g. "House 5, Road 2, Dhanmondi, Dhaka") — a vague address like "Test
   City" has no chance of matching.
3. On **WooCommerce → Orders**, click **Send via Pathao** (or RedX /
   CarryBee) — confirm it books successfully and a consignment ID appears.
4. Repeat with a deliberately vague/foreign address — confirm booking
   fails with a specific, readable message (not a raw API error), and
   confirm nothing is left half-booked.
5. **CarryBee specifically**: the resolver's field-name assumptions for
   CarryBee's `area-suggestion` response were written without a live
   fixture (see `CourierLocationResolverService::resolveCarrybee()`) — if
   step 3 fails for CarryBee specifically while Pathao/RedX work, check
   the actual response shape from CarryBee's sandbox and adjust the
   defensive key-fallback list there.

## Stock push-back (1.5.0)

1. Sync a WooCommerce product to BSOL (see "Product sync" above), note
   its stock quantity.
2. On BSOL dashboard → Products, edit that same product's stock to a
   different number and save. Within a few seconds (queue worker
   dependent), confirm the WooCommerce product's stock updates to match.
3. Place a **manual** (non-WooCommerce) BSOL order for the same product
   and confirm it — confirm WooCommerce's stock decreases by the same
   amount once the order reaches a stock-consuming status.
4. Repeat steps 2–3 for a **variation** of a variable product.
5. Confirm this doesn't loop: after step 2, check BSOL dashboard →
   Products again — the stock value should NOT have changed again (no
   ping-pong back and forth).
6. If a site connected before upgrading to 1.5.0 sees stock-update calls
   silently fail, reconnect once (**BSOL Connect → Settings →
   Disconnect**, then reconnect) to receive a webhook secret — sites
   connected on an older version don't have one yet.

## Activity log, retry, and uninstall (1.4.0)

1. Open **BSOL Connect → Activity Log** — confirm it lists recent sync/
   connect calls with a time, event name, ✓/✗, and message.
2. Temporarily break the connection (edit the `bsol_api_key` option to a
   wrong value directly in the DB, or just wait for the key to be revoked
   on BSOL's side), then place a test order — confirm a ✗ entry appears
   in the log within a few seconds.
3. Wait ~5 minutes (or run `wp cron event run bsol_retry_order_sync` if
   using WP-CLI) — confirm a retry attempt appears in the log. Restore
   the correct API key and confirm the next retry succeeds and the order
   appears in BSOL.
4. Trash a synced product — confirm (via a temporary debug log line, or
   just watching the Activity Log) a `products/sync` call fires with
   `status: inactive`.
5. **Plugins → Delete** the plugin on a disposable staging site — confirm
   in BSOL dashboard → Settings → WordPress Connect that the key shows as
   revoked, and check `wp_options` directly to confirm no `bsol_*` rows
   remain.
6. **Plugins → Plugins list** — confirm BSOL Connect no longer shows an
   "HPOS incompatible / untested" notice (requires WooCommerce's
   High-Performance Order Storage feature enabled under WooCommerce →
   Settings → Advanced → Features).
