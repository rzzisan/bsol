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
