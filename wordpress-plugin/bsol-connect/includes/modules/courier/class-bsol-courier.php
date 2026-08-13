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
 *
 * UI: a single "Book to Courier" pill button opens a small dropdown listing
 * the 5 couriers, instead of 5 separate buttons crowding the column (each
 * courier used to get its own always-visible button). The booked/unbooked
 * markup is built by render_unbooked_markup()/render_booked_markup() and
 * reused as-is by the AJAX book handler so the column updates to the exact
 * same HTML the next page load would render — no separate JS template.
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

		echo '<div class="bsol-courier-column" data-order-id="' . esc_attr( $order->get_id() ) . '">';
		echo $order->get_meta( self::META_CONSIGNMENT_ID ) // phpcs:ignore WordPress.Security.EscapeOutput -- both render_* methods already escape their own output.
			? $this->render_booked_markup( $order )
			: $this->render_unbooked_markup();
		echo '</div>';
	}

	/** The 5 couriers offered in the "Book to Courier" dropdown, value => label. */
	private function courier_options() {
		return array(
			'steadfast' => __( 'Steadfast', 'bsol-connect' ),
			'paperfly'  => __( 'Paperfly', 'bsol-connect' ),
			'pathao'    => __( 'Pathao', 'bsol-connect' ),
			'redx'      => __( 'RedX', 'bsol-connect' ),
			'carrybee'  => __( 'CarryBee', 'bsol-connect' ),
		);
	}

	/** Not-yet-booked state: one toggle button + a dropdown of couriers. */
	private function render_unbooked_markup() {
		ob_start();
		?>
		<div class="bsol-courier-picker">
			<button type="button" class="bsol-courier-book-toggle">
				<span class="dashicons dashicons-car"></span>
				<?php esc_html_e( 'Book to Courier', 'bsol-connect' ); ?>
				<span class="bsol-courier-caret">&#9662;</span>
			</button>
			<div class="bsol-courier-dropdown" hidden>
				<div class="bsol-courier-dropdown-label"><?php esc_html_e( 'Select courier', 'bsol-connect' ); ?></div>
				<?php foreach ( $this->courier_options() as $value => $label ) : ?>
					<button type="button" class="bsol-courier-option" data-courier="<?php echo esc_attr( $value ); ?>"><?php echo esc_html( $label ); ?></button>
				<?php endforeach; ?>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Already-booked state — consignment card with a status badge and
	 * refresh/cancel/print icon buttons. Shared by render_courier_column()
	 * (page load) and ajax_book() (booked just now, no reload needed).
	 */
	private function render_booked_markup( $order ) {
		$consignment_id = $order->get_meta( self::META_CONSIGNMENT_ID );
		$provider       = $order->get_meta( self::META_PROVIDER );
		$status         = $order->get_meta( self::META_STATUS );
		$status_slug    = $status ? sanitize_html_class( strtolower( $status ) ) : 'pending';

		$waybill_url = wp_nonce_url(
			admin_url( 'admin-post.php?action=bsol_download_waybill&order_id=' . $order->get_id() ),
			'bsol_waybill_download'
		);
		ob_start();
		?>
		<div class="bsol-consignment-card">
			<div class="bsol-consignment-head">
				<span class="bsol-provider-badge"><?php echo esc_html( strtoupper( $provider ) ); ?></span>
				<span class="bsol-status-badge bsol-courier-status bsol-status-<?php echo esc_attr( $status_slug ); ?>">
					<?php echo esc_html( $status ? ucfirst( $status ) : '—' ); ?>
				</span>
			</div>
			<div class="bsol-consignment-id"><?php echo esc_html( $consignment_id ); ?></div>
			<div class="bsol-consignment-actions">
				<a href="#" class="bsol-icon-btn bsol-courier-track-btn" title="<?php esc_attr_e( 'Refresh status', 'bsol-connect' ); ?>"><span class="dashicons dashicons-update"></span></a>
				<a href="#" class="bsol-icon-btn bsol-courier-cancel-btn" title="<?php esc_attr_e( 'Cancel booking', 'bsol-connect' ); ?>"><span class="dashicons dashicons-no"></span></a>
				<a href="<?php echo esc_url( $waybill_url ); ?>" target="_blank" class="bsol-icon-btn" title="<?php esc_attr_e( 'Print waybill', 'bsol-connect' ); ?>"><span class="dashicons dashicons-printer"></span></a>
			</div>
		</div>
		<?php
		return ob_get_clean();
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

		// Return the exact HTML a page reload would render, so the column
		// updates in place (waybill link, track/cancel icons, badge) instead
		// of the JS hand-assembling a partial substitute.
		wp_send_json_success( array_merge( $response, array( 'html' => $this->render_booked_markup( $order ) ) ) );
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
