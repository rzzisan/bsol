<?php
/**
 * Shared static helpers — phone normalization, site-domain resolution, and
 * the WooCommerce-status -> BSOL-status vocabulary map.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Helpers {

	/**
	 * Bare host for the connect API's X-Client-Domain header — must match
	 * what the seller entered when generating the key on the BSOL dashboard
	 * (Bsol_Api::api_key_matches_domain server-side check).
	 */
	public static function site_domain() {
		$host = parse_url( home_url(), PHP_URL_HOST );
		return $host ? strtolower( $host ) : '';
	}

	/**
	 * Best-effort real visitor IP for tracking's client_ip_address
	 * (tracking_capi_context.md §3.3) — Cloudflare's own header first (most
	 * sites proxy through it), then the general X-Forwarded-For, then the
	 * raw connection as a last resort. Not used for any security decision,
	 * only ad-attribution match quality, so a spoofable header here is an
	 * accepted trade-off, not a vulnerability.
	 */
	public static function client_ip() {
		foreach ( array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' ) as $key ) {
			if ( empty( $_SERVER[ $key ] ) ) {
				continue;
			}
			$value = sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) );
			$first = trim( explode( ',', $value )[0] );
			if ( filter_var( $first, FILTER_VALIDATE_IP ) ) {
				return $first;
			}
		}
		return null;
	}

	/**
	 * Clean and format a Bangladeshi phone number to 01XXXXXXXXX.
	 * Returns false if the input can't be normalized into a valid BD number.
	 *
	 * @param string $phone
	 * @return string|false
	 */
	public static function clean_bd_phone_number( $phone ) {
		$cleaned = preg_replace( '/[^\d]/', '', (string) $phone );

		if ( substr( $cleaned, 0, 4 ) === '8801' ) {
			$cleaned = '01' . substr( $cleaned, 4 );
		} elseif ( substr( $cleaned, 0, 3 ) === '880' ) {
			$cleaned = '0' . substr( $cleaned, 3 );
		}

		if ( strlen( $cleaned ) === 10 && substr( $cleaned, 0, 1 ) === '1' ) {
			$cleaned = '0' . $cleaned;
		}

		if ( strlen( $cleaned ) === 11 && substr( $cleaned, 0, 2 ) === '01' ) {
			return $cleaned;
		}

		return false;
	}

	/**
	 * WooCommerce order status -> BSOL canonical status. BSOL's
	 * /orders/sync-status endpoint only accepts its own vocabulary
	 * (pending, confirmed, processing, shipped, delivered, cancelled,
	 * returned) — this plugin owns the translation so the backend API stays
	 * stable across future non-WooCommerce integrations too.
	 *
	 * WC statuses not present here (pending, on-hold, draft, trash) are
	 * deliberately not synced — the BSOL order simply stays at whatever
	 * status it already has (created as "pending").
	 *
	 * `bsol-confirmed`/`bsol-shipped` are the two custom statuses this
	 * plugin itself registers (class-bsol-order-status.php) for BSOL
	 * vocabulary that has no native WC equivalent — 1:1, no translation
	 * needed since the slug already matches BSOL's own status name.
	 *
	 * Filterable via `bsol_connect_status_map` if a store needs a different
	 * mapping (e.g. a custom "shipped" status plugin).
	 */
	public static function status_map() {
		$map = array(
			'processing'     => 'confirmed',
			'completed'      => 'delivered',
			'cancelled'      => 'cancelled',
			'refunded'       => 'returned',
			'failed'         => 'cancelled',
			'bsol-confirmed' => 'confirmed',
			'bsol-shipped'   => 'shipped',
		);

		return apply_filters( 'bsol_connect_status_map', $map );
	}
}
