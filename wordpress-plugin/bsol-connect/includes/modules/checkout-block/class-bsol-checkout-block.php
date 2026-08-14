<?php
/**
 * Blocks checkout for a phone number this seller has blacklisted on BSOL.
 * Adapted from zayroo-connect's
 * `Zayroo_Blacklist_Manager::check_if_blocked_at_checkout()`, same dual
 * classic + block-checkout hook pair as class-bsol-repeat-order-block.php.
 *
 * Unlike repeat-order-block, this genuinely needs a BSOL API call — the
 * blacklist lives on BSOL, not in this site's own WooCommerce data — so it
 * reuses the *existing* `check_fraud()` method (already used by the Customer
 * Health column and the Settings → "Test Fraud Check" tool) rather than
 * adding a new API method. `is_blacklisted` is phone-only on the backend
 * (no IP blacklist exists there) — zayroo's own IP parameter is dropped
 * rather than sent for a field the backend has never read.
 *
 * Fail-open on any communication error or non-blacklisted result, same
 * "never break checkout on a remote hiccup" philosophy as every other
 * storefront-facing check in this plugin.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Checkout_Block {

	const DEFAULT_MESSAGE = 'দুঃখিত, আপাতত এই নম্বর দিয়ে অর্ডার করা যাচ্ছে না। বিস্তারিত জানতে যোগাযোগ করুন।';

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
	 */
	public function check_block_checkout( $order, $request ) {
		$phone   = $order->get_billing_phone();
		$message = $this->evaluate( $phone );
		if ( ! $message ) {
			return;
		}

		$route_exception_class = '\Automattic\WooCommerce\StoreApi\Exceptions\RouteException';
		if ( ! class_exists( $route_exception_class ) ) {
			return; // fail open — classic-checkout enforcement still applies.
		}
		throw new $route_exception_class( 'bsol_checkout_blocked', $message, 400 );
	}

	private function evaluate( $phone ) {
		if ( '1' !== get_option( 'bsol_checkout_block_enabled', '0' ) ) {
			return null;
		}

		$phone = Bsol_Helpers::clean_bd_phone_number( $phone );
		if ( ! $phone ) {
			return null;
		}

		$api      = new Bsol_Api();
		$response = $api->check_fraud( $phone );

		// Fail-open: only block on an explicit, successful is_blacklisted=true —
		// any network error, malformed response, or false is a pass-through.
		if ( empty( $response['success'] ) || empty( $response['data']['is_blacklisted'] ) ) {
			return null;
		}

		return get_option( 'bsol_checkout_block_message', self::DEFAULT_MESSAGE );
	}
}
