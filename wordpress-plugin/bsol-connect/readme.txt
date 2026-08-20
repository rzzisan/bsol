=== BSOL Connect ===
Contributors: zyrotechbd
Tags: woocommerce, order management, courier, sms otp, facebook conversions api, payment gateway
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.19.5
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connects your WooCommerce store to BSOL — order/product sync, courier booking, waybill and invoice printing, checkout OTP, phone fraud checking, online payment gateways, and Facebook Conversions API.

== Description ==

BSOL Connect is a thin client: it collects data from WooCommerce and sends it to your BSOL account, and shows you what BSOL sends back. All business logic — pricing rules, fraud scoring, courier dispatch, PDF generation, SMS sending — runs on BSOL's servers, not on your WordPress site. This keeps the plugin small and means every improvement to BSOL applies to your store automatically, with no plugin update required for backend-only changes.

**What it does:**

* **Order sync** — every WooCommerce order (and its status changes) is pushed to BSOL automatically.
* **Product sync** — simple and variable products, including stock and pricing, both ways: WooCommerce → BSOL on save, and BSOL → WooCommerce when a unit sells through another BSOL channel (Facebook, manual entry), so you never oversell.
* **Courier booking** — book Steadfast, Paperfly, Pathao, RedX, or CarryBee for a synced order directly from the WooCommerce orders list, no need to switch to the BSOL dashboard.
* **Waybill & invoice printing** — print the courier sticker label or the customer sales invoice straight from the orders list.
* **Customer Health** — a fraud/delivery-history score for every order's phone number, right in the orders list.
* **Checkout OTP** (optional, off by default) — verify a customer's phone number by SMS before an order is confirmed.
* **Facebook Conversions API** (optional) — a server-side Purchase event for every order, for ad-attribution that survives ad blockers and iOS tracking limits.
* **Bulk sync** — a one-time "Sync Data" tool to push products/orders that existed before you connected.
* **Abandoned checkout tracking** — captures name/phone/email/address + cart as a customer fills the checkout form, before the order completes, so you can follow up on carts that never finish.
* **Repeat order block** (optional, off by default) — stop the same phone number from placing a second order within a set number of hours.
* **Checkout blacklist block** (optional, off by default) — stop checkout for a phone number you've blacklisted on your BSOL dashboard.
* **BSOL order statuses** — two extra WooCommerce order statuses ("BSOL: Confirmed", "BSOL: Shipped") for BSOL vocabulary that has no native WooCommerce equivalent, selectable from the order edit screen and as a bulk action.
* **Manual SMS** — send an ad-hoc SMS to any order's phone number directly from the orders list, no need to switch to the BSOL dashboard.
* **Online payment gateways** — every payment channel enabled on your BSOL account (bKash/Nagad/Rocket personal send-and-verify, or SSLCommerz/AamarPay/ZiniPay/ShurjoPay/EPS/bKash Merchant/Nagad Merchant automated checkout) appears as a WooCommerce payment method automatically — configure credentials once in BSOL, nothing to set up here.

= Requirements =

* A BSOL account with an active subscription.
* WooCommerce active on this site.
* PHP 7.4+.

== Installation ==

1. Download the plugin from your BSOL dashboard: **Settings → WordPress Connect → Download Plugin**.
2. In WordPress, go to **Plugins → Add New → Upload Plugin**, choose the downloaded zip, and activate.
3. On the BSOL dashboard, go to **Settings → WordPress Connect**, enter this site's exact domain, and click **Generate API Key**.
4. In WordPress, go to **BSOL Connect → Settings**, paste the key, and click **Save & Connect**.
5. (Optional) If you have products/orders that existed before connecting, go to **BSOL Connect → Sync Data** and run the two bulk-sync buttons once.

== Frequently Asked Questions ==

= Do I need a BSOL account? =

Yes — this plugin only connects an existing BSOL account to WooCommerce. Sign up at your BSOL dashboard first.

= Will this slow down my checkout? =

No. Every BSOL call happens after checkout completes (via WooCommerce's own order hooks), and heavier calls (Facebook CAPI, checkout-OTP SMS) run through a background job on BSOL's side — nothing blocks the customer.

= Does it work with High-Performance Order Storage (HPOS)? =

Yes — fully compatible, declared via `FeaturesUtil::declare_compatibility()`. Every order-meta read/write in this plugin uses `WC_Order::get_meta()`/`update_meta_data()`, never the legacy post-meta functions.

= What happens if I deactivate or delete the plugin? =

Deactivating just stops the sync hooks — nothing is deleted. Deleting the plugin (via **Plugins → Delete**) revokes the API key on BSOL's side and removes every option/transient this plugin created.

= Which couriers are supported? =

Steadfast, Paperfly, Pathao, RedX, and CarryBee. For Pathao/RedX/CarryBee, BSOL does a best-effort match of the order's address to determine the courier's required location IDs — if it can't determine this confidently, booking fails with a clear message rather than a cryptic remote error.

== Screenshots ==

1. BSOL Connect settings — connect/disconnect.
2. WooCommerce orders list — Courier, Customer Health, and Invoice columns.
3. Checkout OTP verification card on the order-received page.

== Changelog ==

= 1.19.5 =
Checkout payment-method list now gets real styling (card layout, selected-state highlight) instead of the theme's bare default list — on both classic and block checkout. Fix: a gateway's Title field defaulted to two different values depending on whether the admin had opened its settings screen ("BSOL: SSLCommerz") or not ("SSLCommerz"), showing an inconsistent mix at checkout — now always defaults to the plain provider name.

= 1.17.0 =
Facebook/Meta tracking: Pixel base code, PageView/ViewContent/AddToCart/InitiateCheckout/Lead/Purchase events, all relayed through your own site (your BSOL API key never reaches the browser). Order outcome events (Confirmed/Delivered/Returned etc.) are sent by BSOL itself, not this plugin.

= 1.16.0 =
Three additions: checkout blacklist block (optional, off by default — stop checkout for a phone number blacklisted on your BSOL dashboard); two extra WooCommerce order statuses ("BSOL: Confirmed"/"BSOL: Shipped") for BSOL vocabulary with no native WC equivalent, selectable on the order edit screen and as a bulk action; a "Send SMS" button in a new SMS column on the orders list for an ad-hoc message to any order's phone number.

= 1.15.0 =
Repeat order block (optional, off by default): stop the same phone number from placing a second order within a set number of hours (configurable in BSOL Connect → Settings). Fully local — no BSOL connection needed for the check. Works on both classic and block-based checkout.

= 1.14.0 =
Abandoned/incomplete checkout tracking — captures name/phone/email/address + cart as a customer fills the checkout form, before the order completes, and shows it in your BSOL dashboard's Abandoned Checkouts list.

= 1.13.1 =
Fix: stale cached data from 1.12.0 and earlier could show "No data" for Customer Health after upgrading, until its old 24h cache expired. Cache key bumped so this can't happen.

= 1.13.0 =
Customer Health column redesigned: a delivered-vs-not progress bar from live per-courier delivery history instead of the generic fraud score, click for a per-courier breakdown.

= 1.12.0 =
Admin UI redesigned to match the BSOL dashboard. Courier column on the orders list now shows one "Book to Courier" button with a courier dropdown instead of five separate buttons.

= 1.11.0 =
Self-update notice in wp-admin (checks BSOL for a newer version, cached), translation-ready strings (`languages/bsol-connect.pot`), this readme.

= 1.10.0 =
Order invoice PDF — a new "Invoice" column, no courier-booking required.

= 1.9.0 =
Bulk/historical sync — a "Sync Data" tab to backfill products/orders that existed before connecting.

= 1.8.0 =
Facebook Conversions API — a server-side Purchase event for every synced order.

= 1.7.0 =
Checkout OTP verification, optional, off by default.

= 1.6.0 =
Pathao, RedX, and CarryBee courier booking (in addition to Steadfast/Paperfly).

= 1.5.0 =
Inbound stock push-back — BSOL pushes stock changes from other sales channels back to WooCommerce.

= 1.4.0 =
Reliability pass: HPOS compatibility declaration, Activity Log tab, automatic sync retry, proper uninstall cleanup.

= 1.3.0 =
Print the courier waybill/sticker label PDF for a booked order.

= 1.2.0 =
Courier booking (Steadfast/Paperfly) directly from the WooCommerce orders list.

= 1.1.0 =
Product sync (WooCommerce → BSOL), simple and variable products.

= 1.0.0 =
Initial release — connect/disconnect, order sync, Customer Health fraud-check column.

(Full details for every version: `changelog.md` in the plugin folder.)

== Upgrade Notice ==

= 1.5.0 =
Sites connected before this version should reconnect once (Settings → Disconnect, then reconnect) to receive a webhook secret required for inbound stock push-back.
