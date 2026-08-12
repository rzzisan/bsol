<?php
/**
 * Syncs WooCommerce orders to BSOL — creation on woocommerce_new_order, and
 * status transitions (translated through Bsol_Helpers::status_map()) on
 * woocommerce_order_status_changed. Only instantiated by Bsol_Master when
 * the site is connected and WooCommerce is active.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Order_Sync {

	public function __construct() {
		add_action( 'woocommerce_new_order', array( $this, 'handle_new_order' ), 10, 1 );
		add_action( 'woocommerce_order_status_changed', array( $this, 'handle_status_change' ), 10, 4 );
	}

	public function handle_new_order( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$api = new Bsol_Api();
		$api->sync_order( $this->build_order_payload( $order ) );
	}

	/**
	 * Fires on every status transition. Statuses without a mapped BSOL
	 * equivalent (pending, on-hold, draft, trash) are intentionally
	 * skipped — see Bsol_Helpers::status_map().
	 */
	public function handle_status_change( $order_id, $old_status, $new_status, $order ) {
		$mapped = Bsol_Helpers::status_map();

		if ( ! isset( $mapped[ $new_status ] ) ) {
			return;
		}

		$api = new Bsol_Api();
		$api->sync_order_status(
			$order->get_id(),
			$mapped[ $new_status ],
			sprintf( 'WooCommerce status: %s', $new_status )
		);
	}

	private function build_order_payload( $order ) {
		$line_items = array();

		foreach ( $order->get_items() as $item ) {
			$product = $item->get_product();
			$line_items[] = array(
				'name'     => $item->get_name(),
				'quantity' => (int) $item->get_quantity(),
				'total'    => (float) $item->get_total(),
				'sku'      => $product ? $product->get_sku() : null,
			);
		}

		$phone = Bsol_Helpers::clean_bd_phone_number( $order->get_billing_phone() );

		return array(
			'wc_order_id'      => (string) $order->get_id(),
			'customer_name'    => $order->get_formatted_billing_full_name(),
			'customer_phone'   => $phone ?: $order->get_billing_phone(),
			'customer_email'   => $order->get_billing_email(),
			'customer_address' => $order->get_formatted_billing_address(),
			'payment_method'   => 'cod' === $order->get_payment_method() ? 'cod' : 'online',
			'is_paid'          => $order->is_paid(),
			'shipping_charge'  => (float) $order->get_shipping_total(),
			'discount'         => (float) $order->get_discount_total(),
			'notes'            => $order->get_customer_note(),
			'line_items'       => $line_items,
		);
	}
}
