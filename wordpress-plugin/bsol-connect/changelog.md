# BSOL Connect — Changelog

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
