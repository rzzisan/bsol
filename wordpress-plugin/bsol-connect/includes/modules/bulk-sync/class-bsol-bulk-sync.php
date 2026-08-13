<?php
/**
 * Admin-triggered "Sync Data" tab — backfills products/orders that already
 * existed before this site connected to BSOL (the save_post_product/
 * woocommerce_new_order hooks only ever fire for *new* saves/orders going
 * forward). Adds zero new sync logic — every batch just calls the exact
 * same methods class-bsol-product-sync.php/class-bsol-order-sync.php
 * already use for a live save/order, via the instances Bsol_Master
 * injects here (never `new Bsol_Product_Sync()`/`new Bsol_Order_Sync()`
 * itself — that would double-register their constructors' hooks).
 *
 * Client-side batch loop (assets/js/bsol-admin.js) paces requests with a
 * 1s gap between batches to stay comfortably under the /connect/v1 group's
 * throttle:120,1 (each batch of BATCH_SIZE makes that many sequential
 * remote calls to BSOL).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Bulk_Sync {

	const BATCH_SIZE = 10;

	/** @var Bsol_Product_Sync */
	private $product_sync;

	/** @var Bsol_Order_Sync */
	private $order_sync;

	public function __construct( $product_sync, $order_sync ) {
		$this->product_sync = $product_sync;
		$this->order_sync   = $order_sync;

		add_action( 'admin_enqueue_scripts', array( $this, 'maybe_enqueue_assets' ) );
		add_action( 'wp_ajax_bsol_bulk_sync_products', array( $this, 'ajax_sync_products' ) );
		add_action( 'wp_ajax_bsol_bulk_sync_orders', array( $this, 'ajax_sync_orders' ) );
	}

	public function maybe_enqueue_assets() {
		$screen = get_current_screen();
		if ( ! $screen || strpos( $screen->id, 'bsol_connect' ) === false ) {
			return;
		}

		wp_enqueue_style( 'bsol-admin', BSOL_PLUGIN_URL . 'assets/css/bsol-admin.css', array(), BSOL_PLUGIN_VERSION );
		wp_enqueue_script( 'bsol-admin', BSOL_PLUGIN_URL . 'assets/js/bsol-admin.js', array( 'jquery' ), BSOL_PLUGIN_VERSION, true );
		wp_localize_script(
			'bsol-admin',
			'bsol_bulk_sync',
			array(
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'nonce'    => wp_create_nonce( 'bsol_bulk_sync_nonce' ),
			)
		);
	}

	public function ajax_sync_products() {
		check_ajax_referer( 'bsol_bulk_sync_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ) );
		}

		$page = isset( $_POST['page'] ) ? max( 1, (int) $_POST['page'] ) : 1;

		$result = wc_get_products(
			array(
				'limit'    => self::BATCH_SIZE,
				'page'     => $page,
				'status'   => array( 'publish', 'draft', 'private' ),
				'orderby'  => 'ID',
				'order'    => 'ASC',
				'paginate' => true,
			)
		);

		foreach ( $result->products as $product ) {
			$this->product_sync->sync_product( $product );
		}

		$processed = count( $result->products );
		$total     = (int) $result->total;

		wp_send_json_success(
			array(
				'processed' => $processed,
				'total'     => $total,
				'done'      => 0 === $processed || ( $page * self::BATCH_SIZE ) >= $total,
			)
		);
	}

	public function ajax_sync_orders() {
		check_ajax_referer( 'bsol_bulk_sync_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ) );
		}

		$page = isset( $_POST['page'] ) ? max( 1, (int) $_POST['page'] ) : 1;

		$result = wc_get_orders(
			array(
				'limit'    => self::BATCH_SIZE,
				'page'     => $page,
				'orderby'  => 'ID',
				'order'    => 'ASC',
				'paginate' => true,
			)
		);

		foreach ( $result->orders as $order ) {
			// true = historical: creates/updates the order without firing a
			// checkout-OTP SMS or a Facebook Purchase event for it (see
			// ConnectOrderController::sync()'s is_historical_sync gate).
			$this->order_sync->handle_new_order( $order->get_id(), true );
			// Backfill the order's *current* WC status too — otherwise it
			// would land in BSOL stuck at whatever a freshly-created order
			// defaults to, regardless of how far along it really is.
			$this->order_sync->handle_status_change( 0, '', $order->get_status(), $order );
		}

		$processed = count( $result->orders );
		$total     = (int) $result->total;

		wp_send_json_success(
			array(
				'processed' => $processed,
				'total'     => $total,
				'done'      => 0 === $processed || ( $page * self::BATCH_SIZE ) >= $total,
			)
		);
	}
}
