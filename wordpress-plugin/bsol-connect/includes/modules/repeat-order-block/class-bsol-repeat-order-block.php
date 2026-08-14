<?php
/**
 * Blocks a customer from placing a second order with the same phone number
 * within a configurable window. Adapted from zayroo-connect's
 * `Zayroo_Blacklist_Manager::check_for_repeat_order_at_checkout()`, but:
 *
 * - Fully WP-local by design, same as the legacy version — the order
 *   history being checked already lives in this site's own WooCommerce
 *   database (`wc_get_orders()`), so no BSOL API call is needed or made.
 *   That is *why* the settings for this module live in wp-admin as plain
 *   options rather than on the BSOL dashboard (unlike, say, the checkout-OTP
 *   toggle) — reading them from BSOL on every checkout would add a network
 *   round-trip to a check whose entire point is to be instant and local.
 * - Covers BOTH classic (shortcode) and block-based (Store API) checkout.
 *   zayroo only ever hooked `woocommerce_checkout_process`, which never
 *   fires for block checkout — so on any store using the Block checkout
 *   (WooCommerce's default since 8.3), the legacy feature silently did
 *   nothing. `woocommerce_store_api_checkout_update_order_from_request` is
 *   the documented Store API equivalent — it fires on an already-persisted
 *   draft order with billing data applied, before payment is attempted, and
 *   throwing a `RouteException` there surfaces as a normal checkout error
 *   in the block UI (WooCommerce core wraps every Store API route handler
 *   in a try/catch for exactly this).
 * - Shows the seller how many hours are actually *left* on the block, not
 *   the full configured window regardless of elapsed time (zayroo always
 *   showed the full window, e.g. "try again after 24 hours" even 23 hours
 *   in).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Repeat_Order_Block {

	const DEFAULT_MESSAGE = 'আপনি সম্প্রতি একটি অর্ডার করেছেন। অনুগ্রহ করে %d ঘণ্টা পর আবার চেষ্টা করুন।';

	public function __construct() {
		add_action( 'woocommerce_checkout_process', array( $this, 'check_classic_checkout' ) );
		add_action( 'woocommerce_store_api_checkout_update_order_from_request', array( $this, 'check_block_checkout' ), 10, 2 );
	}

	public function check_classic_checkout() {
		$phone   = isset( $_POST['billing_phone'] ) ? sanitize_text_field( wp_unslash( $_POST['billing_phone'] ) ) : '';
		$message = $this->evaluate( $phone );
		if ( $message ) {
			wc_add_notice( $message, 'error' );
		}
	}

	/**
	 * @param \WC_Order        $order   The draft/pending order being finalized.
	 * @param \WP_REST_Request $request Full Store API checkout request.
	 * @throws \Exception A RouteException, if the Store API class is available and the block applies.
	 */
	public function check_block_checkout( $order, $request ) {
		$phone   = $order->get_billing_phone();
		$message = $this->evaluate( $phone );
		if ( ! $message ) {
			return;
		}

		$route_exception_class = '\Automattic\WooCommerce\StoreApi\Exceptions\RouteException';
		if ( ! class_exists( $route_exception_class ) ) {
			// Older WooCommerce Blocks versions namespaced this class
			// differently — fail open (classic-checkout enforcement still
			// applies) rather than fatal on a class that doesn't exist.
			return;
		}
		throw new $route_exception_class( 'bsol_repeat_order_blocked', $message, 400 );
	}

	/**
	 * Shared check — returns the error message to show, or null if the
	 * order isn't blocked (feature off, no matching recent order, or the
	 * phone number couldn't be parsed at all).
	 */
	private function evaluate( $phone ) {
		if ( '1' !== get_option( 'bsol_repeat_block_enabled', '0' ) ) {
			return null;
		}

		$phone = Bsol_Helpers::clean_bd_phone_number( $phone );
		if ( ! $phone ) {
			return null;
		}

		$hours = (int) get_option( 'bsol_repeat_block_hours', '24' );
		if ( $hours <= 0 ) {
			return null;
		}

		$orders = wc_get_orders(
			array(
				'billing_phone' => $phone,
				'limit'         => 1,
				'orderby'       => 'date',
				'order'         => 'DESC',
				'status'        => array( 'processing', 'completed', 'on-hold', 'pending' ),
			)
		);
		if ( empty( $orders ) ) {
			return null;
		}

		$latest_order = reset( $orders );
		$created      = $latest_order->get_date_created();
		if ( ! $created ) {
			return null;
		}

		$hours_since_last_order = ( time() - $created->getTimestamp() ) / HOUR_IN_SECONDS;
		if ( $hours_since_last_order >= $hours ) {
			return null;
		}

		$hours_remaining = max( 1, (int) ceil( $hours - $hours_since_last_order ) );
		$template        = get_option( 'bsol_repeat_block_message', self::DEFAULT_MESSAGE );

		return sprintf( $template, $hours_remaining );
	}
}
