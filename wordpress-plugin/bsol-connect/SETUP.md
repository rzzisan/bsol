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
