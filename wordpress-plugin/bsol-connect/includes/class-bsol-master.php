<?php
/**
 * Module loader and hook-registration hub. Loads dependencies once, then
 * wires WooCommerce/admin hooks only when the site is actually connected
 * (and WooCommerce is active) — mirrors the proven gate pattern from
 * zyro/wordpress_plugin/zayroo-connect, the precursor this plugin adapts.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Master {

	/** @var Bsol_Admin */
	protected $admin;

	/** @var Bsol_Product_Sync */
	protected $product_sync;

	/** @var Bsol_Order_Sync */
	protected $order_sync;

	public function __construct() {
		$this->load_dependencies();
		$this->define_hooks();
	}

	private function load_dependencies() {
		require_once BSOL_PLUGIN_PATH . 'includes/classes/class-bsol-helpers.php';
		require_once BSOL_PLUGIN_PATH . 'includes/classes/class-bsol-activity-log.php';
		require_once BSOL_PLUGIN_PATH . 'includes/classes/class-bsol-api.php';
		require_once BSOL_PLUGIN_PATH . 'includes/classes/class-bsol-update-checker.php';
		require_once BSOL_PLUGIN_PATH . 'includes/admin/class-bsol-admin.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/order-sync/class-bsol-order-sync.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/fraud/class-bsol-fraud-check.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/product-sync/class-bsol-product-sync.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/courier/class-bsol-courier.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/checkout-otp/class-bsol-checkout-otp.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/bulk-sync/class-bsol-bulk-sync.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/invoice/class-bsol-invoice.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/abandoned-checkout/class-bsol-abandoned-checkout.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/repeat-order-block/class-bsol-repeat-order-block.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/checkout-block/class-bsol-checkout-block.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/order-status/class-bsol-order-status.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/manual-sms/class-bsol-manual-sms.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/tracking/class-bsol-tracking.php';
		// NOT required here, deliberately — see init_payment_gateway_module().

		// Admin menu must render even when not connected (that's where the
		// Settings/connect form lives), so this is always instantiated.
		$this->admin = new Bsol_Admin();

		// Unlike every module in define_hooks() below, this runs regardless
		// of connection status — a disconnected-but-installed site still
		// needs to know about updates.
		new Bsol_Update_Checker();
	}

	private function define_hooks() {
		add_action( 'admin_menu', array( $this->admin, 'add_admin_menu' ) );
		add_action( 'admin_notices', array( $this, 'maybe_render_woocommerce_missing_notice' ) );

		if ( ! $this->is_connected() || ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		// Retained as properties (not just instantiated-and-discarded, like
		// the modules below) — Bsol_Bulk_Sync reuses these exact instances'
		// sync methods rather than creating its own, which would otherwise
		// double-register their constructors' add_action() hooks.
		$this->order_sync   = new Bsol_Order_Sync();
		$this->product_sync = new Bsol_Product_Sync();

		new Bsol_Fraud_Check();
		new Bsol_Courier();
		new Bsol_Checkout_Otp();
		new Bsol_Bulk_Sync( $this->product_sync, $this->order_sync );
		new Bsol_Invoice();
		new Bsol_Abandoned_Checkout();
		new Bsol_Repeat_Order_Block();
		new Bsol_Checkout_Block();
		new Bsol_Order_Status();
		new Bsol_Manual_Sms();
		new Bsol_Tracking();

		// class-bsol-gateway.php declares `class Bsol_Gateway extends
		// WC_Payment_Gateway` — that parent class must already exist at the
		// moment PHP parses the require()'d file (class inheritance
		// resolves immediately, not lazily), and WooCommerce is NOT
		// guaranteed to have defined it yet by the time *this* plugin's own
		// plugins_loaded callback runs (hook-callback ordering across
		// different plugins registered at the same priority is not something
		// to rely on — this is a well-documented WooCommerce extension
		// pitfall). `woocommerce_loaded` is WooCommerce's own action, fired
		// only once its core classes (including WC_Payment_Gateway) are
		// guaranteed to exist, regardless of plugin load order — so the
		// require + registration for this one module are deferred there
		// instead of running unconditionally in load_dependencies() like
		// every other module (none of which extend a WooCommerce core class
		// at file-parse time, so they don't have this problem).
		add_action( 'woocommerce_loaded', array( $this, 'init_payment_gateway_module' ) );
	}

	public function init_payment_gateway_module() {
		if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
			return; // shouldn't happen on woocommerce_loaded, but never fatal if it does
		}

		require_once BSOL_PLUGIN_PATH . 'includes/modules/payment-gateway/class-bsol-gateway.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/payment-gateway/class-bsol-payment-gateway.php';

		new Bsol_Payment_Gateway( $this->order_sync );
	}

	public function maybe_render_woocommerce_missing_notice() {
		if ( class_exists( 'WooCommerce' ) ) {
			return;
		}
		$screen = get_current_screen();
		if ( ! $screen || strpos( $screen->id, 'bsol_connect' ) === false ) {
			return;
		}
		echo '<div class="notice notice-error"><p>' .
			esc_html__( 'BSOL Connect requires WooCommerce to be installed and active.', 'bsol-connect' ) .
			'</p></div>';
	}

	public function is_connected() {
		return (bool) get_option( 'bsol_api_key' ) && (bool) get_option( 'bsol_domain' );
	}

	public function run() {
		// All hooks are registered in the constructor.
	}
}
