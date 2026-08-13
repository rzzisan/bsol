<?php
/**
 * Syncs WooCommerce products (and variations) to BSOL (outbound), and
 * receives stock push-back FROM BSOL (inbound) — a unit sold through
 * another BSOL sales channel (Facebook, manual) needs to reduce the same
 * stock a WooCommerce customer sees. Adapts zayroo-connect's proven
 * trigger set (class-zayroo-product-sync.php) for the outbound half, and
 * its REST-receiver + remove_action/add_action loop-guard
 * (class-zayroo-master.php, class-zayroo-product-sync.php) for the
 * inbound half. Only instantiated by Bsol_Master when the site is
 * connected and WooCommerce is active — so the REST route below is only
 * ever registered on a connected site.
 *
 * A failed outbound sync is retried via WP-Cron (up to MAX_RETRIES, 2
 * minutes apart — faster than the order-sync retry, no customer waiting
 * on a product update). Trashing or permanently deleting a product also
 * syncs it as inactive, so BSOL doesn't keep offering a product that's gone.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Product_Sync {

	const META_RETRY_COUNT = '_bsol_sync_retry_count';
	const MAX_RETRIES       = 3;
	const RETRY_DELAY       = 2 * MINUTE_IN_SECONDS;

	public function __construct() {
		add_action( 'save_post_product', array( $this, 'handle_product_save' ), 10, 3 );
		add_action( 'woocommerce_product_quick_edit_save', array( $this, 'handle_quick_edit_save' ), 10, 1 );
		add_action( 'woocommerce_reduce_order_stock', array( $this, 'handle_order_stock_reduction' ), 10, 1 );
		add_action( 'bsol_retry_product_sync', array( $this, 'handle_retry' ), 10, 1 );
		add_action( 'trashed_post', array( $this, 'handle_trashed_or_deleted' ), 10, 1 );
		add_action( 'before_delete_post', array( $this, 'handle_trashed_or_deleted' ), 10, 1 );
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
	}

	public function handle_retry( $product_id ) {
		$product = wc_get_product( $product_id );
		if ( $product ) {
			$this->sync_product( $product );
		}
	}

	public function handle_trashed_or_deleted( $post_id ) {
		if ( 'product' !== get_post_type( $post_id ) ) {
			return;
		}
		$product = wc_get_product( $post_id );
		if ( $product ) {
			$this->sync_product( $product );
		}
	}

	public function handle_product_save( $post_id, $post, $update ) {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		if ( 'product' !== $post->post_type ) {
			return;
		}

		$product = wc_get_product( $post_id );
		if ( $product ) {
			$this->sync_product( $product );
		}
	}

	public function handle_quick_edit_save( $product ) {
		if ( is_a( $product, 'WC_Product' ) ) {
			$this->sync_product( $product );
		}
	}

	public function handle_order_stock_reduction( $order ) {
		foreach ( $order->get_items() as $item ) {
			$product = $item->get_product();
			if ( $product ) {
				$this->sync_product( $product );
			}
		}
	}

	public function sync_product( $product ) {
		// BSOL only models simple/variable products today — grouped,
		// external, and other WC product types are skipped rather than
		// sent to fail server-side validation.
		if ( ! in_array( $product->get_type(), array( 'simple', 'variable' ), true ) ) {
			return;
		}

		$payload = array(
			'wc_product_id'  => (string) $product->get_id(),
			'name'           => $product->get_name(),
			'sku'            => $this->resolve_sku( $product ),
			'description'    => wp_strip_all_tags( $product->get_description() ),
			'regular_price'  => (float) $product->get_regular_price(),
			'discount'       => $this->compute_discount_amount( $product ),
			'stock_quantity' => (int) $product->get_stock_quantity(),
			'manage_stock'   => (bool) $product->get_manage_stock(),
			'status'         => 'publish' === $product->get_status() ? 'active' : 'inactive',
			'image_url'      => wp_get_attachment_url( $product->get_image_id() ) ?: null,
			'type'           => $product->get_type(),
		);

		if ( $product->is_type( 'variable' ) ) {
			$payload['variants'] = $this->build_variants_payload( $product );
		}

		$api      = new Bsol_Api();
		$response = $api->sync_product( $payload );
		$this->handle_sync_result( $product, $response );
	}

	private function handle_sync_result( $product, $response ) {
		$product_id = $product->get_id();

		if ( ! empty( $response['success'] ) ) {
			delete_post_meta( $product_id, self::META_RETRY_COUNT );
			return;
		}

		$retry_count = (int) get_post_meta( $product_id, self::META_RETRY_COUNT, true );

		if ( $retry_count >= self::MAX_RETRIES ) {
			Bsol_Activity_Log::record(
				'products/sync',
				false,
				sprintf( 'Product #%d permanently failed to sync after %d attempts.', $product_id, self::MAX_RETRIES )
			);
			return;
		}

		update_post_meta( $product_id, self::META_RETRY_COUNT, $retry_count + 1 );
		wp_schedule_single_event( time() + self::RETRY_DELAY, 'bsol_retry_product_sync', array( $product_id ) );
	}

	private function build_variants_payload( $product ) {
		$variants = array();

		foreach ( $product->get_children() as $child_id ) {
			$variation = wc_get_product( $child_id );
			if ( ! $variation ) {
				continue;
			}

			$variants[] = array(
				'wc_variation_id' => (string) $variation->get_id(),
				'sku'             => $this->resolve_sku( $variation ),
				'regular_price'   => (float) $variation->get_regular_price(),
				'discount'        => $this->compute_discount_amount( $variation ),
				'stock_quantity'  => (int) $variation->get_stock_quantity(),
				'image_url'       => wp_get_attachment_url( $variation->get_image_id() ) ?: null,
			);
		}

		return $variants;
	}

	/**
	 * BSOL requires a SKU; WooCommerce doesn't. Falls back to a stable,
	 * unique synthetic SKU derived from the WC post ID.
	 */
	private function resolve_sku( $product ) {
		$sku = $product->get_sku();
		return $sku ? $sku : 'WC-' . $product->get_id();
	}

	/**
	 * Translates WooCommerce's regular/sale-price model into BSOL's
	 * amount-discount model — this WC->BSOL semantic mapping is the
	 * plugin's job, matching the status-map precedent (class-bsol-helpers.php).
	 */
	private function compute_discount_amount( $product ) {
		$regular = (float) $product->get_regular_price();
		$sale    = $product->get_sale_price();

		if ( '' === $sale || null === $sale ) {
			return 0.0;
		}

		$sale = (float) $sale;
		return $sale < $regular ? round( $regular - $sale, 2 ) : 0.0;
	}

	// ── Inbound: stock push-back FROM BSOL ──────────────────────────────────

	public function register_rest_routes() {
		register_rest_route(
			'bsol-connect/v1',
			'/stock-update',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle_stock_update_webhook' ),
				'permission_callback' => array( $this, 'verify_webhook_auth' ),
			)
		);
	}

	/**
	 * BSOL never persists this site's raw API key (only a one-way hash —
	 * see PlatformApiKey), so it can't send that back as proof of identity
	 * on this reverse-direction call. A separate webhook secret (received
	 * once, at connect time — see Bsol_Admin::handle_connection_request())
	 * is compared instead. Same hash_equals()-header pattern zayroo-connect
	 * used for its own REST receiver (class-zayroo-master.php).
	 */
	public function verify_webhook_auth( $request ) {
		$saved_secret = get_option( 'bsol_webhook_secret' );
		$sent_secret  = $request->get_header( 'X-BSOL-Webhook-Secret' );

		return ! empty( $saved_secret ) && ! empty( $sent_secret ) && hash_equals( $saved_secret, (string) $sent_secret );
	}

	/**
	 * wc_get_product() resolves either a simple/variable product's own
	 * post ID or a variation's post ID — no need to distinguish the two.
	 * Unhooks this class's own save hooks around the write, exactly like
	 * zayroo-connect's handle_api_sync() — otherwise this save would
	 * immediately re-trigger handle_product_save() and sync the same
	 * value straight back out to BSOL.
	 */
	public function handle_stock_update_webhook( $request ) {
		$params = $request->get_json_params();
		$wc_id  = isset( $params['wc_id'] ) ? sanitize_text_field( $params['wc_id'] ) : '';
		$stock  = isset( $params['stock_quantity'] ) ? $params['stock_quantity'] : null;

		if ( '' === $wc_id || ! is_numeric( $stock ) ) {
			return new WP_Error( 'invalid_params', 'wc_id and stock_quantity are required.', array( 'status' => 400 ) );
		}

		$product = wc_get_product( (int) $wc_id );
		if ( ! $product ) {
			return new WP_Error( 'not_found', 'Product or variation not found.', array( 'status' => 404 ) );
		}

		remove_action( 'save_post_product', array( $this, 'handle_product_save' ), 10 );
		remove_action( 'woocommerce_product_quick_edit_save', array( $this, 'handle_quick_edit_save' ), 10 );

		$product->set_manage_stock( true );
		$product->set_stock_quantity( (int) $stock );
		$product->save();

		add_action( 'save_post_product', array( $this, 'handle_product_save' ), 10, 3 );
		add_action( 'woocommerce_product_quick_edit_save', array( $this, 'handle_quick_edit_save' ), 10, 1 );

		return array( 'success' => true, 'message' => 'Stock updated.' );
	}
}
