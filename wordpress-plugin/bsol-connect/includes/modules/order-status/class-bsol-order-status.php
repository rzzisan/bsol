<?php
/**
 * Registers two WooCommerce order statuses for BSOL vocabulary that has no
 * native WooCommerce equivalent: "Confirmed" and "Shipped". A seller working
 * directly in wp-admin can then pick the right status by name, instead of
 * remembering that BSOL's "Confirmed" maps onto WooCommerce's "Processing".
 *
 * Deliberately narrower than legacy zayroo-connect, which registered 5
 * custom statuses that *replaced* the seller's use of native WC statuses
 * (processing/completed/cancelled/refunded) — flagged in
 * wordpress_connect_context.md §7.1 item 5 as a real risk (hijacking a
 * native status's meaning can break other plugins/reports that key off it).
 * This only ADDS two genuinely new statuses that coexist with WooCommerce's
 * own — "Processing" and "Completed" keep meaning exactly what they already
 * mean; nothing native is touched.
 *
 * Purely outbound-direction convenience: BSOL never pushes an order-status
 * change back to WordPress (no such inbound channel exists, unlike stock
 * push-back — Phase 7). Selecting "BSOL: Confirmed"/"BSOL: Shipped" in
 * WooCommerce is just an easier way for a seller to trigger the *same*
 * `woocommerce_order_status_changed` sync hook (class-bsol-order-sync.php)
 * that already exists — Bsol_Helpers::status_map() just needs 1:1 entries
 * for the two new slugs, no new sync logic.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Order_Status {

	const STATUSES = array(
		'bsol-confirmed' => 'BSOL: Confirmed',
		'bsol-shipped'   => 'BSOL: Shipped',
	);

	public function __construct() {
		add_action( 'init', array( $this, 'register_post_statuses' ) );
		add_filter( 'wc_order_statuses', array( $this, 'add_to_order_statuses' ) );

		add_filter( 'bulk_actions-edit-shop_order', array( $this, 'add_bulk_actions' ) );
		add_filter( 'handle_bulk_actions-edit-shop_order', array( $this, 'handle_bulk_actions' ), 10, 3 );

		// HPOS equivalents.
		add_filter( 'bulk_actions-woocommerce_page_wc-orders', array( $this, 'add_bulk_actions' ) );
		add_filter( 'handle_bulk_actions-woocommerce_page_wc-orders', array( $this, 'handle_bulk_actions' ), 10, 3 );
	}

	public function register_post_statuses() {
		foreach ( self::STATUSES as $slug => $label ) {
			register_post_status(
				'wc-' . $slug,
				array(
					'label'                     => $label,
					'public'                    => true,
					'exclude_from_search'       => false,
					'show_in_admin_all_list'    => true,
					'show_in_admin_status_list' => true,
					/* translators: %s: number of orders */
					'label_count'               => _n_noop( $label . ' <span class="count">(%s)</span>', $label . ' <span class="count">(%s)</span>', 'bsol-connect' ),
				)
			);
		}
	}

	/**
	 * Inserted right after Processing (Confirmed) and after that (Shipped) —
	 * roughly matching pipeline order: Pending -> Processing ->
	 * [BSOL: Confirmed] -> [BSOL: Shipped] -> Completed.
	 */
	public function add_to_order_statuses( $order_statuses ) {
		$new_statuses = array();
		foreach ( $order_statuses as $key => $label ) {
			$new_statuses[ $key ] = $label;
			if ( 'wc-processing' === $key ) {
				foreach ( self::STATUSES as $slug => $bsol_label ) {
					$new_statuses[ 'wc-' . $slug ] = $bsol_label;
				}
			}
		}
		// Fallback: if this store has no "processing" status for some
		// reason, still make sure the two statuses are selectable.
		foreach ( self::STATUSES as $slug => $bsol_label ) {
			if ( ! isset( $new_statuses[ 'wc-' . $slug ] ) ) {
				$new_statuses[ 'wc-' . $slug ] = $bsol_label;
			}
		}
		return $new_statuses;
	}

	public function add_bulk_actions( $actions ) {
		foreach ( self::STATUSES as $slug => $label ) {
			$actions[ 'mark_' . str_replace( '-', '_', $slug ) ] = sprintf(
				/* translators: %s: status label, e.g. "BSOL: Confirmed" */
				__( 'Change status to %s', 'bsol-connect' ),
				$label
			);
		}
		return $actions;
	}

	public function handle_bulk_actions( $redirect_to, $action, $order_ids ) {
		$matched_slug = null;
		foreach ( self::STATUSES as $slug => $label ) {
			if ( 'mark_' . str_replace( '-', '_', $slug ) === $action ) {
				$matched_slug = $slug;
				break;
			}
		}
		if ( ! $matched_slug ) {
			return $redirect_to;
		}

		$changed = 0;
		foreach ( $order_ids as $order_id ) {
			$order = wc_get_order( $order_id );
			if ( ! $order ) {
				continue;
			}
			$order->update_status( $matched_slug, '', true );
			++$changed;
		}

		return add_query_arg( 'bsol_status_changed', $changed, $redirect_to );
	}
}
