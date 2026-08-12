# BSOL Connect — Changelog

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
