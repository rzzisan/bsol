<?php
/**
 * Checkout-in-progress capture (Phase 17) — second storefront (not
 * wp-admin) module after checkout-otp. Captures name/phone/email/address +
 * cart contents as the customer fills the checkout form, before the order
 * completes, and relays it to BSOL's existing abandoned-checkouts system
 * (same table/dashboard UI landing pages already use — see
 * AbandonedCheckoutService::captureWooCommerce() backend-side).
 *
 * Cart contents are read server-side from WC()->cart, not scraped from the
 * rendered checkout DOM — no theme-dependent CSS selectors to keep in sync,
 * and always exactly what WooCommerce itself has in the cart.
 *
 * No current_user_can() gate on the AJAX handler — checkout is normally
 * anonymous; the nonce is the only credential here, same as
 * Bsol_Checkout_Otp's verify/resend handlers.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Abandoned_Checkout {

	const SESSION_KEY = 'bsol_abandoned_session_token';

	public function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue_assets' ) );

		add_action( 'wp_ajax_bsol_save_abandoned_checkout', array( $this, 'ajax_save' ) );
		add_action( 'wp_ajax_nopriv_bsol_save_abandoned_checkout', array( $this, 'ajax_save' ) );
	}

	public function maybe_enqueue_assets() {
		if ( ! function_exists( 'is_checkout' ) || ! is_checkout() ) {
			return;
		}

		wp_enqueue_script( 'bsol-abandoned-checkout', BSOL_PLUGIN_URL . 'assets/js/bsol-abandoned-checkout.js', array( 'jquery' ), BSOL_PLUGIN_VERSION, true );
		wp_localize_script(
			'bsol-abandoned-checkout',
			'bsol_abandoned_checkout',
			array(
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'nonce'    => wp_create_nonce( 'bsol_abandoned_checkout_nonce' ),
			)
		);
	}

	public function ajax_save() {
		check_ajax_referer( 'bsol_abandoned_checkout_nonce', 'nonce' );

		$session_token = isset( $_POST['session_token'] ) ? sanitize_text_field( wp_unslash( $_POST['session_token'] ) ) : '';
		if ( '' === $session_token ) {
			wp_send_json_error( array( 'message' => 'Missing session token.' ) );
		}

		$items = $this->cart_items();

		$data = array(
			'session_token'    => $session_token,
			'customer_name'    => isset( $_POST['name'] ) ? sanitize_text_field( wp_unslash( $_POST['name'] ) ) : '',
			'customer_phone'   => isset( $_POST['phone'] ) ? sanitize_text_field( wp_unslash( $_POST['phone'] ) ) : '',
			'customer_email'   => isset( $_POST['email'] ) ? sanitize_email( wp_unslash( $_POST['email'] ) ) : '',
			'customer_address' => isset( $_POST['address'] ) ? sanitize_textarea_field( wp_unslash( $_POST['address'] ) ) : '',
			'items'            => $items,
		);

		// Nothing worth capturing yet (customer hasn't typed anything
		// identifying, or the cart is empty) — a no-op, not an error.
		if ( empty( $items ) || ( empty( $data['customer_name'] ) && empty( $data['customer_phone'] ) && empty( $data['customer_email'] ) ) ) {
			wp_send_json_success();
		}

		// Outlives this single AJAX request across the rest of checkout —
		// class-bsol-order-sync.php reads it back to convert this row once
		// a real order completes (works for both classic and block-based
		// checkout, unlike a hidden form field tied to the classic form).
		if ( function_exists( 'WC' ) && WC()->session ) {
			WC()->session->set( self::SESSION_KEY, $session_token );
		}

		$api = new Bsol_Api();
		$api->sync_abandoned_checkout( $data );

		wp_send_json_success();
	}

	/** Authoritative cart snapshot — no DOM scraping, no theme-dependent selectors. */
	private function cart_items() {
		if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
			return array();
		}

		$items = array();
		foreach ( WC()->cart->get_cart() as $cart_item ) {
			$product = isset( $cart_item['data'] ) ? $cart_item['data'] : null;
			if ( ! $product ) {
				continue;
			}
			$items[] = array(
				'name'         => $product->get_name(),
				'sku'          => $product->get_sku(),
				'quantity'     => (int) $cart_item['quantity'],
				'unit_price'   => (float) $product->get_price(),
				'product_link' => get_permalink( $product->get_id() ),
			);
		}

		return $items;
	}
}
