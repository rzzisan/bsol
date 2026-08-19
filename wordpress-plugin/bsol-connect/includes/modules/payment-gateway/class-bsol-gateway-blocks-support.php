<?php
/**
 * WooCommerce Blocks (Cart & Checkout block) compatibility for BSOL's
 * gateways. A plain WC_Payment_Gateway (class-bsol-gateway.php) is enough
 * for the classic/shortcode checkout — but the block-based Checkout,
 * WooCommerce's default on new/updated sites since 8.3, only shows
 * payment methods that ALSO register a Store API integration here.
 * Without this, a WC_Payment_Gateway is silently invisible on that
 * checkout — no error, it just never appears.
 *
 * process_payment() itself needs no changes for Blocks — the Store API
 * still calls the same WC_Payment_Gateway::process_payment() server-side
 * when the customer submits payment; this class only makes the option
 * selectable in the block checkout's UI.
 *
 * Guarded behind class_exists() in class-bsol-payment-gateway.php — older
 * WooCommerce versions (or ones with Blocks explicitly disabled) simply
 * never load this file, falling back to classic-checkout-only support.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Gateway_Blocks_Support extends \Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType {

	/** @var WC_Payment_Gateway */
	private $gateway;

	public function __construct( $gateway ) {
		$this->gateway = $gateway;
		$this->name    = $gateway->id;
	}

	public function initialize() {
		$this->settings = get_option( 'woocommerce_' . $this->name . '_settings', array() );
	}

	public function is_active() {
		return $this->gateway->is_available();
	}

	public function get_payment_method_script_handles() {
		wp_register_script(
			'bsol-gateway-blocks',
			BSOL_PLUGIN_URL . 'assets/js/bsol-gateway-blocks.js',
			array( 'wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities' ),
			BSOL_PLUGIN_VERSION,
			true
		);

		return array( 'bsol-gateway-blocks' );
	}

	public function get_payment_method_data() {
		return array(
			'title'       => $this->gateway->title,
			'description' => $this->gateway->description,
			'supports'    => is_array( $this->gateway->supports ) ? $this->gateway->supports : array( 'products' ),
		);
	}
}
