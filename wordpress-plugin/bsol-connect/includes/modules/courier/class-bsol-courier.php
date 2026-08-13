<?php
/**
 * "Courier" column on the WooCommerce orders list — book/track/cancel a
 * shipment for an order without leaving WordPress. Steadfast and Paperfly
 * book directly off the free-text address; Pathao/RedX/Carrybee need their
 * own city/zone/area IDs, which BSOL now derives server-side on a
 * best-effort basis (CourierLocationResolverService) — if it can't
 * confidently resolve a location, booking fails with a clear message
 * rather than a cryptic remote error, same as before this was added.
 *
 * Uses HPOS-native order meta (WC_Order::get_meta()/update_meta_data()) —
 * unlike zayroo-connect's update_post_meta()/get_post_meta(), which isn't
 * actually HPOS-safe despite that plugin registering HPOS column hooks too.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Courier {

	const META_CONSIGNMENT_ID = '_bsol_consignment_id';
	const META_PROVIDER       = '_bsol_courier_provider';
	const META_STATUS         = '_bsol_courier_status';

	public function __construct() {
		add_filter( 'manage_edit-shop_order_columns', array( $this, 'add_courier_column' ), 20 );
		add_action( 'manage_shop_order_posts_custom_column', array( $this, 'render_courier_column' ), 20, 2 );

		// HPOS equivalents.
		add_filter( 'manage_woocommerce_page_wc-orders_columns', array( $this, 'add_courier_column' ), 20 );
		add_action( 'manage_woocommerce_page_wc-orders_custom_column', array( $this, 'render_courier_column' ), 20, 2 );

		add_action( 'wp_ajax_bsol_courier_book', array( $this, 'ajax_book' ) );
		add_action( 'wp_ajax_bsol_courier_track', array( $this, 'ajax_track' ) );
		add_action( 'wp_ajax_bsol_courier_cancel', array( $this, 'ajax_cancel' ) );

		// Plain-link file download (not AJAX/JSON) — see handle_waybill_download().
		add_action( 'admin_post_bsol_download_waybill', array( $this, 'handle_waybill_download' ) );
	}

	public function add_courier_column( $columns ) {
		$new_columns = array();
		foreach ( $columns as $key => $label ) {
			$new_columns[ $key ] = $label;
			if ( 'order_status' === $key ) {
				$new_columns['bsol_courier'] = __( 'Courier', 'bsol-connect' );
			}
		}
		if ( ! isset( $new_columns['bsol_courier'] ) ) {
			$new_columns['bsol_courier'] = __( 'Courier', 'bsol-connect' );
		}
		return $new_columns;
	}

	/** $order_or_post_id is the order ID in both legacy and HPOS contexts. */
	public function render_courier_column( $column, $order_or_post_id ) {
		if ( 'bsol_courier' !== $column ) {
			return;
		}
		$order = wc_get_order( $order_or_post_id );
		if ( ! $order ) {
			return;
		}

		$consignment_id = $order->get_meta( self::META_CONSIGNMENT_ID );
		$provider       = $order->get_meta( self::META_PROVIDER );
		$status         = $order->get_meta( self::META_STATUS );

		echo '<div class="bsol-courier-column" data-order-id="' . esc_attr( $order->get_id() ) . '">';

		if ( $consignment_id ) {
			$waybill_url = wp_nonce_url(
				admin_url( 'admin-post.php?action=bsol_download_waybill&order_id=' . $order->get_id() ),
				'bsol_waybill_download'
			);
			printf(
				'<div class="bsol-consignment-info"><strong>%s:</strong> %s<br><span class="bsol-courier-status">%s</span> ' .
				'<a href="#" class="bsol-courier-track-btn" title="%s"><span class="dashicons dashicons-update"></span></a> ' .
				'<a href="#" class="bsol-courier-cancel-btn" title="%s"><span class="dashicons dashicons-no"></span></a> ' .
				'<a href="%s" target="_blank" title="%s"><span class="dashicons dashicons-printer"></span></a></div>',
				esc_html( strtoupper( $provider ) ),
				esc_html( $consignment_id ),
				esc_html( $status ? ucfirst( $status ) : '—' ),
				esc_attr__( 'Refresh status', 'bsol-connect' ),
				esc_attr__( 'Cancel booking', 'bsol-connect' ),
				esc_url( $waybill_url ),
				esc_attr__( 'Print waybill', 'bsol-connect' )
			);
		} else {
			printf(
				'<button class="button bsol-courier-book-btn" data-courier="steadfast">%s</button> ' .
				'<button class="button bsol-courier-book-btn" data-courier="paperfly">%s</button> ' .
				'<button class="button bsol-courier-book-btn" data-courier="pathao">%s</button> ' .
				'<button class="button bsol-courier-book-btn" data-courier="redx">%s</button> ' .
				'<button class="button bsol-courier-book-btn" data-courier="carrybee">%s</button>',
				esc_html__( 'Send via Steadfast', 'bsol-connect' ),
				esc_html__( 'Send via Paperfly', 'bsol-connect' ),
				esc_html__( 'Send via Pathao', 'bsol-connect' ),
				esc_html__( 'Send via RedX', 'bsol-connect' ),
				esc_html__( 'Send via CarryBee', 'bsol-connect' )
			);
		}

		echo '</div>';
	}

	public function ajax_book() {
		check_ajax_referer( 'bsol_courier_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_shop_orders' ) ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ) );
		}

		$order_id = isset( $_POST['order_id'] ) ? (int) $_POST['order_id'] : 0;
		$courier  = isset( $_POST['courier'] ) ? sanitize_text_field( wp_unslash( $_POST['courier'] ) ) : '';
		$order    = $order_id ? wc_get_order( $order_id ) : null;

		if ( ! $order ) {
			wp_send_json_error( array( 'message' => 'Order not found' ) );
		}

		$api      = new Bsol_Api();
		$response = $api->book_courier( $order->get_id(), $courier );

		if ( empty( $response['success'] ) ) {
			wp_send_json_error( array( 'message' => isset( $response['message'] ) ? $response['message'] : 'Booking failed.' ) );
		}

		$order->update_meta_data( self::META_CONSIGNMENT_ID, $response['consignment_id'] ?? '' );
		$order->update_meta_data( self::META_PROVIDER, $courier );
		$order->update_meta_data( self::META_STATUS, 'booked' );
		$order->save();

		wp_send_json_success( $response );
	}

	public function ajax_track() {
		check_ajax_referer( 'bsol_courier_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_shop_orders' ) ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ) );
		}

		$order_id = isset( $_POST['order_id'] ) ? (int) $_POST['order_id'] : 0;
		$order    = $order_id ? wc_get_order( $order_id ) : null;

		if ( ! $order ) {
			wp_send_json_error( array( 'message' => 'Order not found' ) );
		}

		$api      = new Bsol_Api();
		$response = $api->track_courier( $order->get_id() );

		if ( empty( $response['success'] ) ) {
			wp_send_json_error( array( 'message' => isset( $response['message'] ) ? $response['message'] : 'Tracking check failed.' ) );
		}

		$status = isset( $response['order']['courier_status'] ) ? $response['order']['courier_status'] : null;
		if ( $status ) {
			$order->update_meta_data( self::META_STATUS, $status );
			$order->save();
		}

		wp_send_json_success( array( 'status' => $status ) );
	}

	public function ajax_cancel() {
		check_ajax_referer( 'bsol_courier_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_shop_orders' ) ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ) );
		}

		$order_id = isset( $_POST['order_id'] ) ? (int) $_POST['order_id'] : 0;
		$order    = $order_id ? wc_get_order( $order_id ) : null;

		if ( ! $order ) {
			wp_send_json_error( array( 'message' => 'Order not found' ) );
		}

		$api      = new Bsol_Api();
		$response = $api->cancel_courier( $order->get_id() );

		if ( empty( $response['success'] ) ) {
			wp_send_json_error( array( 'message' => isset( $response['message'] ) ? $response['message'] : 'Cancellation not supported for this courier.' ) );
		}

		$order->update_meta_data( self::META_STATUS, 'cancelled' );
		$order->save();

		wp_send_json_success( array( 'status' => 'cancelled' ) );
	}

	/**
	 * Proxies the waybill PDF to the browser via a plain link + admin-post.php
	 * (the standard WP mechanism for an authenticated file download triggered
	 * by a link click) — the browser has no way to attach the plugin's
	 * X-API-KEY/X-Client-Domain headers itself, so this fetches the PDF
	 * server-side (where those headers are known) and streams it back.
	 */
	public function handle_waybill_download() {
		check_admin_referer( 'bsol_waybill_download' );

		if ( ! current_user_can( 'edit_shop_orders' ) ) {
			wp_die( esc_html__( 'Unauthorized', 'bsol-connect' ) );
		}

		$order_id = isset( $_GET['order_id'] ) ? (int) $_GET['order_id'] : 0;
		$order    = $order_id ? wc_get_order( $order_id ) : null;

		if ( ! $order ) {
			wp_die( esc_html__( 'Order not found.', 'bsol-connect' ) );
		}

		$api      = new Bsol_Api();
		$response = $api->get_waybill_pdf( $order->get_id() );

		if ( empty( $response['success'] ) ) {
			wp_die( esc_html( isset( $response['message'] ) ? $response['message'] : __( 'Waybill not available.', 'bsol-connect' ) ) );
		}

		nocache_headers();
		header( 'Content-Type: ' . ( $response['content_type'] ?: 'application/pdf' ) );
		header( 'Content-Disposition: inline; filename="waybill-order-' . $order->get_id() . '.pdf"' );
		header( 'Content-Length: ' . strlen( $response['body'] ) );
		echo $response['body']; // phpcs:ignore WordPress.Security.EscapeOutput -- raw PDF bytes, not HTML.
		exit;
	}
}
