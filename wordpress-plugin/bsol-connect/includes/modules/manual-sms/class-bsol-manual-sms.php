<?php
/**
 * "SMS" column on the WooCommerce orders list — a one-click shortcut to send
 * an ad-hoc SMS to the order's billing phone, without leaving wp-admin for
 * the BSOL dashboard's own Send SMS page. Same dual legacy+HPOS column
 * pattern already used for Courier/Customer Health/Invoice, and the same
 * "prompt() for free text, AJAX-relay to BSOL" shape as every other
 * wp-admin action in this plugin (no custom modal framework anywhere in
 * this codebase — matching that, not introducing one just for this).
 *
 * Delegates entirely to BSOL's existing /connect/v1/sms/send endpoint —
 * gateway selection, credit balance/deduction, and history logging all
 * happen server-side, identically to the dashboard's own Send SMS page.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Manual_Sms {

	public function __construct() {
		add_filter( 'manage_edit-shop_order_columns', array( $this, 'add_sms_column' ), 35 );
		add_action( 'manage_shop_order_posts_custom_column', array( $this, 'render_sms_column' ), 35, 2 );

		// HPOS equivalents.
		add_filter( 'manage_woocommerce_page_wc-orders_columns', array( $this, 'add_sms_column' ), 35 );
		add_action( 'manage_woocommerce_page_wc-orders_custom_column', array( $this, 'render_sms_column' ), 35, 2 );

		add_action( 'wp_ajax_bsol_send_sms', array( $this, 'ajax_send_sms' ) );
	}

	public function add_sms_column( $columns ) {
		$columns['bsol_sms'] = __( 'SMS', 'bsol-connect' );
		return $columns;
	}

	/** $order_or_post_id is the order ID in both legacy and HPOS contexts. */
	public function render_sms_column( $column, $order_or_post_id ) {
		if ( 'bsol_sms' !== $column ) {
			return;
		}
		$order = wc_get_order( $order_or_post_id );
		if ( ! $order ) {
			return;
		}

		$phone = $order->get_billing_phone();
		if ( ! $phone ) {
			echo '&#8212;';
			return;
		}

		printf(
			'<button type="button" class="button-link bsol-send-sms-btn" data-order-id="%d" data-phone="%s" title="%s"><span class="dashicons dashicons-email-alt"></span></button>',
			(int) $order->get_id(),
			esc_attr( $phone ),
			esc_attr__( 'Send SMS', 'bsol-connect' )
		);
	}

	public function ajax_send_sms() {
		check_ajax_referer( 'bsol_sms_nonce', 'nonce' );

		if ( ! current_user_can( 'edit_shop_orders' ) ) {
			wp_send_json_error( array( 'message' => __( 'Unauthorized', 'bsol-connect' ) ) );
		}

		$phone   = isset( $_POST['phone'] ) ? sanitize_text_field( wp_unslash( $_POST['phone'] ) ) : '';
		$message = isset( $_POST['message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['message'] ) ) : '';

		if ( ! $phone || ! $message ) {
			wp_send_json_error( array( 'message' => __( 'Phone and message are required.', 'bsol-connect' ) ) );
		}

		$api      = new Bsol_Api();
		$response = $api->send_sms( $phone, $message );

		if ( ! empty( $response['success'] ) ) {
			wp_send_json_success( array( 'message' => __( 'SMS sent.', 'bsol-connect' ) ) );
		}

		wp_send_json_error( array(
			'message' => isset( $response['message'] ) ? $response['message'] : __( 'Failed to send SMS.', 'bsol-connect' ),
		) );
	}
}
