<?php
/**
 * "Invoice" column on the WooCommerce orders list — prints the
 * seller->customer sales invoice PDF for any synced order, no courier-
 * booking precondition (unlike the waybill print icon in the Courier
 * column — class-bsol-courier.php). Same proven dual legacy+HPOS column
 * pattern already used for the Courier and Customer Health columns, and
 * the same admin-post proxy pattern already used for the waybill
 * download (the browser can't attach the plugin's API key itself, so
 * WordPress fetches the PDF server-side and streams it back).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Invoice {

	public function __construct() {
		add_filter( 'manage_edit-shop_order_columns', array( $this, 'add_invoice_column' ), 30 );
		add_action( 'manage_shop_order_posts_custom_column', array( $this, 'render_invoice_column' ), 30, 2 );

		// HPOS equivalents.
		add_filter( 'manage_woocommerce_page_wc-orders_columns', array( $this, 'add_invoice_column' ), 30 );
		add_action( 'manage_woocommerce_page_wc-orders_custom_column', array( $this, 'render_invoice_column' ), 30, 2 );

		add_action( 'admin_post_bsol_download_invoice', array( $this, 'handle_invoice_download' ) );
	}

	public function add_invoice_column( $columns ) {
		$columns['bsol_invoice'] = __( 'Invoice', 'bsol-connect' );
		return $columns;
	}

	/** $order_or_post_id is the order ID in both legacy and HPOS contexts. */
	public function render_invoice_column( $column, $order_or_post_id ) {
		if ( 'bsol_invoice' !== $column ) {
			return;
		}
		$order = wc_get_order( $order_or_post_id );
		if ( ! $order ) {
			return;
		}

		$url = wp_nonce_url(
			admin_url( 'admin-post.php?action=bsol_download_invoice&order_id=' . $order->get_id() ),
			'bsol_invoice_download'
		);

		printf(
			'<a href="%s" target="_blank" title="%s"><span class="dashicons dashicons-media-document"></span></a>',
			esc_url( $url ),
			esc_attr__( 'Print invoice', 'bsol-connect' )
		);
	}

	public function handle_invoice_download() {
		check_admin_referer( 'bsol_invoice_download' );

		if ( ! current_user_can( 'edit_shop_orders' ) ) {
			wp_die( esc_html__( 'Unauthorized', 'bsol-connect' ) );
		}

		$order_id = isset( $_GET['order_id'] ) ? (int) $_GET['order_id'] : 0;
		$order    = $order_id ? wc_get_order( $order_id ) : null;

		if ( ! $order ) {
			wp_die( esc_html__( 'Order not found.', 'bsol-connect' ) );
		}

		$api      = new Bsol_Api();
		$response = $api->get_invoice_pdf( $order->get_id() );

		if ( empty( $response['success'] ) ) {
			wp_die( esc_html( isset( $response['message'] ) ? $response['message'] : __( 'Invoice not available.', 'bsol-connect' ) ) );
		}

		nocache_headers();
		header( 'Content-Type: ' . ( $response['content_type'] ?: 'application/pdf' ) );
		header( 'Content-Disposition: inline; filename="invoice-order-' . $order->get_id() . '.pdf"' );
		header( 'Content-Length: ' . strlen( $response['body'] ) );
		echo $response['body']; // phpcs:ignore WordPress.Security.EscapeOutput -- raw PDF bytes, not HTML.
		exit;
	}
}
