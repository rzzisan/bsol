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

	public function __construct() {
		$this->load_dependencies();
		$this->define_hooks();
	}

	private function load_dependencies() {
		require_once BSOL_PLUGIN_PATH . 'includes/classes/class-bsol-helpers.php';
		require_once BSOL_PLUGIN_PATH . 'includes/classes/class-bsol-activity-log.php';
		require_once BSOL_PLUGIN_PATH . 'includes/classes/class-bsol-api.php';
		require_once BSOL_PLUGIN_PATH . 'includes/admin/class-bsol-admin.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/order-sync/class-bsol-order-sync.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/fraud/class-bsol-fraud-check.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/product-sync/class-bsol-product-sync.php';
		require_once BSOL_PLUGIN_PATH . 'includes/modules/courier/class-bsol-courier.php';

		// Admin menu must render even when not connected (that's where the
		// Settings/connect form lives), so this is always instantiated.
		$this->admin = new Bsol_Admin();
	}

	private function define_hooks() {
		add_action( 'admin_menu', array( $this->admin, 'add_admin_menu' ) );
		add_action( 'admin_notices', array( $this, 'maybe_render_woocommerce_missing_notice' ) );

		if ( ! $this->is_connected() || ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		new Bsol_Order_Sync();
		new Bsol_Fraud_Check();
		new Bsol_Product_Sync();
		new Bsol_Courier();
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
