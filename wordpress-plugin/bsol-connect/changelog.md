# BSOL Connect — Changelog

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
