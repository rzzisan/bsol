<?php
/**
 * Syncs WooCommerce products (and variations) to BSOL, outbound only —
 * inbound stock push-back (BSOL -> WooCommerce) is a later phase. Adapts
 * zayroo-connect's proven trigger set (class-zayroo-product-sync.php).
 * Only instantiated by Bsol_Master when the site is connected and
 * WooCommerce is active.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Product_Sync {

	public function __construct() {
		add_action( 'save_post_product', array( $this, 'handle_product_save' ), 10, 3 );
		add_action( 'woocommerce_product_quick_edit_save', array( $this, 'handle_quick_edit_save' ), 10, 1 );
		add_action( 'woocommerce_reduce_order_stock', array( $this, 'handle_order_stock_reduction' ), 10, 1 );
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

		$api = new Bsol_Api();
		$api->sync_product( $payload );
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
}
