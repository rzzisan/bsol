<?php
/**
 * "Customer Health" column on the WooCommerce orders list — a delivered-vs-
 * not progress bar built from live per-courier delivery history (BSOL's
 * CourierFraudCheckService — the same data the dashboard's own "Courier
 * Delivery History" panel shows), not the generic in-house fraud_score,
 * which reads 0 for any phone with no prior BSOL order history — true for
 * most WooCommerce-only sellers' customers. Clicking the bar shows the
 * per-courier breakdown.
 *
 * Fetched via AJAX and cached in a transient keyed by phone number (not
 * order id) for CACHE_TTL — several orders from the same customer share
 * one lookup, and every order-list view after the first is served entirely
 * from this transient, so BSOL only ever sees one request per phone per
 * cache window regardless of how often the list is viewed. Registers both
 * the legacy (posts-table) and HPOS column hooks.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Fraud_Check {

	const CACHE_TTL = DAY_IN_SECONDS;

	public function __construct() {
		add_filter( 'manage_edit-shop_order_columns', array( $this, 'add_health_column' ) );
		add_action( 'manage_shop_order_posts_custom_column', array( $this, 'render_health_column' ), 10, 2 );

		// HPOS (High-Performance Order Storage) equivalents.
		add_filter( 'manage_woocommerce_page_wc-orders_columns', array( $this, 'add_health_column' ) );
		add_action( 'manage_woocommerce_page_wc-orders_custom_column', array( $this, 'render_health_column' ), 10, 2 );

		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_action( 'wp_ajax_bsol_get_health', array( $this, 'ajax_get_health' ) );
	}

	public function add_health_column( $columns ) {
		$new_columns = array();
		foreach ( $columns as $key => $label ) {
			$new_columns[ $key ] = $label;
			if ( 'order_status' === $key ) {
				$new_columns['bsol_health'] = __( 'Customer Health', 'bsol-connect' );
			}
		}
		if ( ! isset( $new_columns['bsol_health'] ) ) {
			$new_columns['bsol_health'] = __( 'Customer Health', 'bsol-connect' );
		}
		return $new_columns;
	}

	/**
	 * $order_or_post_id is the order ID in both the legacy
	 * (manage_shop_order_posts_custom_column) and HPOS
	 * (manage_woocommerce_page_wc-orders_custom_column) contexts.
	 */
	public function render_health_column( $column, $order_or_post_id ) {
		if ( 'bsol_health' !== $column ) {
			return;
		}
		$order = wc_get_order( $order_or_post_id );
		if ( ! $order ) {
			return;
		}
		printf(
			'<div class="bsol-health-bar" data-order-id="%d"><span class="bsol-health-loading">%s</span></div>',
			(int) $order->get_id(),
			esc_html__( 'Loading…', 'bsol-connect' )
		);
	}

	public function enqueue_assets( $hook ) {
		$screen = get_current_screen();
		$is_orders_screen = $screen && ( 'shop_order' === $screen->post_type || 'woocommerce_page_wc-orders' === $screen->id );
		if ( ! $is_orders_screen ) {
			return;
		}

		wp_enqueue_style( 'bsol-admin', BSOL_PLUGIN_URL . 'assets/css/bsol-admin.css', array(), BSOL_PLUGIN_VERSION );
		wp_enqueue_script( 'bsol-admin', BSOL_PLUGIN_URL . 'assets/js/bsol-admin.js', array( 'jquery' ), BSOL_PLUGIN_VERSION, true );
		// Shared script/style handle across every order-list module (fraud
		// check + courier + manual SMS) — localized once here so each
		// module's JS can read from the same bsol_ajax object.
		wp_localize_script(
			'bsol-admin',
			'bsol_ajax',
			array(
				'ajax_url'      => admin_url( 'admin-ajax.php' ),
				'nonce'         => wp_create_nonce( 'bsol_health_nonce' ),
				'courier_nonce' => wp_create_nonce( 'bsol_courier_nonce' ),
				'sms_nonce'     => wp_create_nonce( 'bsol_sms_nonce' ),
			)
		);
	}

	public function ajax_get_health() {
		check_ajax_referer( 'bsol_health_nonce', 'nonce' );

		if ( ! current_user_can( 'edit_shop_orders' ) ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ) );
		}

		$order_id = isset( $_POST['order_id'] ) ? (int) $_POST['order_id'] : 0;
		$order    = $order_id ? wc_get_order( $order_id ) : null;

		if ( ! $order ) {
			wp_send_json_error( array( 'message' => 'Order not found' ) );
		}

		$phone = Bsol_Helpers::clean_bd_phone_number( $order->get_billing_phone() );
		if ( ! $phone ) {
			wp_send_json_error( array( 'message' => 'No valid phone on this order' ) );
		}

		// "_v2" — 1.13.0 changed what's cached here (courier breakdown, not
		// fraud_score/risk_level). Sites that viewed the orders list on an
		// older version still have "bsol_health_{md5}" transients in the old
		// shape sitting with up to 24h left on their TTL; reusing the same
		// key would silently serve that stale shape (data.overall would be
		// undefined) instead of a fresh courier-health lookup. A key bump
		// sidesteps that cleanly — old entries just expire unread.
		$cache_key = 'bsol_health_v2_' . md5( $phone );
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			wp_send_json_success( $cached );
		}

		$api      = new Bsol_Api();
		$response = $api->check_courier_health( $phone );

		if ( empty( $response['success'] ) ) {
			wp_send_json_error( array( 'message' => isset( $response['message'] ) ? $response['message'] : 'Check failed' ) );
		}

		$result = $response['data'];

		set_transient( $cache_key, $result, self::CACHE_TTL );

		wp_send_json_success( $result );
	}
}
