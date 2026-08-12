<?php
/**
 * "Customer Health" column on the WooCommerce orders list — shows the BSOL
 * fraud/delivery-history score for each order's phone number, fetched via
 * AJAX and cached in a transient (24h) to avoid re-checking on every list
 * load. Registers both the legacy (posts-table) and HPOS column hooks.
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
			'<div class="bsol-health-bar" data-order-id="%d"><span class="bsol-health-text">%s</span></div>',
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
		wp_localize_script(
			'bsol-admin',
			'bsol_ajax',
			array(
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'nonce'    => wp_create_nonce( 'bsol_health_nonce' ),
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

		$cache_key = 'bsol_health_' . md5( $phone );
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			wp_send_json_success( $cached );
		}

		$api      = new Bsol_Api();
		$response = $api->check_fraud( $phone );

		if ( empty( $response['success'] ) ) {
			wp_send_json_error( array( 'message' => isset( $response['message'] ) ? $response['message'] : 'Check failed' ) );
		}

		$result = array(
			'fraud_score'    => $response['data']['fraud_score'],
			'risk_level'     => $response['data']['risk_level'],
			'is_blacklisted' => $response['data']['is_blacklisted'],
		);

		set_transient( $cache_key, $result, self::CACHE_TTL );

		wp_send_json_success( $result );
	}
}
