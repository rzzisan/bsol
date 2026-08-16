<?php
/**
 * Syncs WooCommerce orders to BSOL — creation on woocommerce_new_order, and
 * status transitions (translated through Bsol_Helpers::status_map()) on
 * woocommerce_order_status_changed. Only instantiated by Bsol_Master when
 * the site is connected and WooCommerce is active.
 *
 * A failed order-creation sync (BSOL momentarily down, network blip) is
 * retried via WP-Cron rather than silently lost — up to MAX_RETRIES times,
 * 5 minutes apart, tracked in the order's own meta so a restart/redeploy
 * doesn't lose the count.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Order_Sync {

	const META_RETRY_COUNT  = '_bsol_sync_retry_count';
	const META_OTP_REQUIRED = '_bsol_otp_required';
	const META_ORDER_ID     = '_bsol_order_id';
	const MAX_RETRIES       = 3;
	const RETRY_DELAY       = 5 * MINUTE_IN_SECONDS;

	public function __construct() {
		add_action( 'woocommerce_new_order', array( $this, 'handle_new_order' ), 10, 1 );
		add_action( 'woocommerce_order_status_changed', array( $this, 'handle_status_change' ), 10, 4 );
		add_action( 'bsol_retry_order_sync', array( $this, 'handle_new_order' ), 10, 2 );
	}

	/**
	 * $is_historical_sync: true when called from the bulk/historical sync
	 * tab (Bsol_Bulk_Sync) rather than the live woocommerce_new_order hook
	 * — tells BSOL to skip checkout-OTP SMS and the Facebook CAPI Purchase
	 * event for this order, both of which would be wrong for a backfilled
	 * order that was actually placed in the past. Threaded through the
	 * retry reschedule too, so a retried historical sync doesn't lose the
	 * flag and fire those side effects on retry.
	 */
	public function handle_new_order( $order_id, $is_historical_sync = false ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$api      = new Bsol_Api();
		$response = $api->sync_order( $this->build_order_payload( $order, $is_historical_sync ) );

		if ( ! empty( $response['success'] ) ) {
			$order->delete_meta_data( self::META_RETRY_COUNT );
			if ( ! empty( $response['data']['otp_required'] ) ) {
				$order->update_meta_data( self::META_OTP_REQUIRED, true );
			}
			// Bsol_Tracking's thank-you page hook needs this to build the
			// same order_{id} eventID the server-side Purchase CAPI event
			// already uses (SendFacebookCapiPurchaseEventJob), so the
			// browser and server copies of that one event dedupe.
			if ( ! empty( $response['data']['id'] ) ) {
				$order->update_meta_data( self::META_ORDER_ID, (int) $response['data']['id'] );
			}
			$order->save();
			return;
		}

		$retry_count = (int) $order->get_meta( self::META_RETRY_COUNT );

		if ( $retry_count >= self::MAX_RETRIES ) {
			Bsol_Activity_Log::record(
				'orders/sync',
				false,
				sprintf( 'Order #%d permanently failed to sync after %d attempts.', $order->get_id(), self::MAX_RETRIES )
			);
			return;
		}

		$order->update_meta_data( self::META_RETRY_COUNT, $retry_count + 1 );
		$order->save();
		wp_schedule_single_event( time() + self::RETRY_DELAY, 'bsol_retry_order_sync', array( $order_id, $is_historical_sync ) );
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

	private function build_order_payload( $order, $is_historical_sync = false ) {
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
			// Facebook CAPI match-quality data — WooCommerce captures these
			// itself at checkout (WC_Checkout::process_checkout()), so this
			// is just forwarding what's already on the order, not tracking
			// anything new. BSOL uses these to fire a Purchase event server
			// -side; see ConnectOrderController::sync() and Phase 10 in
			// wordpress_connect_context.md.
			'client_ip'          => $order->get_customer_ip_address(),
			'user_agent'         => $order->get_customer_user_agent(),
			'event_source_url'   => wc_get_checkout_url(),
			'is_historical_sync' => (bool) $is_historical_sync,
			// Set by Bsol_Abandoned_Checkout's AJAX capture into WC()->session
			// (Phase 17) when this checkout was previously tracked as
			// in-progress — lets BSOL flip that row to "converted" instead of
			// it sitting abandoned forever. Null for a historical/bulk-sync
			// backfill (no live WC session exists for an old order).
			'session_token'      => ( ! $is_historical_sync && function_exists( 'WC' ) && WC()->session )
				? WC()->session->get( Bsol_Abandoned_Checkout::SESSION_KEY )
				: null,
		);
	}
}
