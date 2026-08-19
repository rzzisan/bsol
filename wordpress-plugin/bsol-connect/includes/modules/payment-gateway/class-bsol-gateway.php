<?php
/**
 * A single BSOL-backed WooCommerce payment method — one instance per
 * enabled channel (bkash, sslcommerz, bkash_merchant, ...), all sharing
 * this one class. WooCommerce's woocommerce_payment_gateways filter
 * accepts pre-instantiated objects (not just class-name strings), so
 * multiple differently-configured instances of the same class register as
 * distinct payment methods just fine — no per-provider subclass needed.
 *
 * No credential fields here — configuration lives in the BSOL dashboard
 * only (Settings → Online Payment Channels), same as courier credentials
 * and the checkout-OTP toggle elsewhere in this plugin. This class's own
 * settings screen is just enable/title/description + a pointer to BSOL.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Gateway extends WC_Payment_Gateway {

	/** @var string 'wallet_manual' | 'gateway_auto' */
	private $channel_type;

	/** @var Bsol_Order_Sync */
	private $order_sync;

	public function __construct( $provider, $label, $channel_type, $order_sync ) {
		$this->id           = 'bsol_' . $provider;
		$this->channel_type = $channel_type;
		$this->order_sync   = $order_sync;
		$this->icon         = '';
		$this->has_fields   = false; // gateway_auto redirects off-site; wallet_manual's claim form lives on order-received, not the checkout payment box
		$this->method_title = 'BSOL: ' . $label;
		$this->method_description = sprintf(
			/* translators: %s: provider label, e.g. "SSLCommerz" */
			__( 'Accept payment via %s, powered by your BSOL account. Configure/enable this in your BSOL dashboard → Settings → Online Payment Channels, not here.', 'bsol-connect' ),
			$label
		);

		$this->init_form_fields();
		$this->init_settings();

		$this->title       = $this->get_option( 'title', $label );
		$this->description = $this->get_option( 'description', sprintf( __( 'Pay with %s.', 'bsol-connect' ), $label ) );
		$this->enabled      = $this->get_option( 'enabled', 'yes' );

		add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
	}

	public function init_form_fields() {
		$this->form_fields = array(
			'enabled'     => array(
				'title'   => __( 'Enable/Disable', 'bsol-connect' ),
				'type'    => 'checkbox',
				'label'   => __( 'Enable this payment method', 'bsol-connect' ),
				'default' => 'yes',
			),
			'title'       => array(
				'title'       => __( 'Title', 'bsol-connect' ),
				'type'        => 'text',
				'description' => __( 'Shown to the customer at checkout.', 'bsol-connect' ),
				'default'     => $this->method_title,
				'desc_tip'    => true,
			),
			'description' => array(
				'title' => __( 'Description', 'bsol-connect' ),
				'type'  => 'textarea',
				'default' => '',
			),
			'bsol_notice' => array(
				'title'       => __( 'Credentials', 'bsol-connect' ),
				'type'        => 'title',
				'description' => __( 'Credentials/enable-state for this channel are managed in your BSOL dashboard — go to BSOL → Settings → Online Payment Channels. Disabling a channel there removes it from checkout here too (may take up to 15 minutes to refresh).', 'bsol-connect' ),
			),
		);
	}

	public function process_payment( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			wc_add_notice( __( 'Order not found.', 'bsol-connect' ), 'error' );
			return array( 'result' => 'failure' );
		}

		// Ensure BSOL already has this order before asking it to initiate a
		// payment against it. woocommerce_new_order (which normally does
		// this sync) should always fire before process_payment() runs —
		// true for classic checkout — but WooCommerce Blocks' Store API
		// checkout creates/updates the draft order across earlier separate
		// requests, and that ordering guarantee is less firm there. This
		// call is idempotent (ConnectOrderController::sync() is a create-
		// or-update upsert, and doesn't redispatch OTP/CAPI on update — see
		// wordpress_connect_context.md), so calling it again here even when
		// the order was already synced is a safe, cheap no-op.
		if ( $this->order_sync ) {
			$this->order_sync->handle_new_order( $order_id );
		}

		$provider = substr( $this->id, strlen( 'bsol_' ) );

		if ( 'wallet_manual' === $this->channel_type ) {
			// Stays on-hold until the seller verifies the claim in BSOL
			// (or the customer skips it and the seller collects manually) —
			// the order-received page below shows the send-money-and-
			// submit-TrxID form.
			$order->update_status( 'on-hold', __( 'Awaiting BSOL online-wallet payment confirmation.', 'bsol-connect' ) );

			return array(
				'result'   => 'success',
				'redirect' => $order->get_checkout_order_received_url(),
			);
		}

		// gateway_auto — server-to-server initiate, then redirect the
		// browser straight to the gateway's own hosted checkout page.
		$api      = new Bsol_Api();
		$response = $api->initiate_gateway_payment( $order_id, $provider );

		if ( empty( $response['success'] ) || empty( $response['data']['redirect_url'] ) ) {
			wc_add_notice(
				isset( $response['message'] ) ? $response['message'] : __( 'Could not start the payment. Please try again.', 'bsol-connect' ),
				'error'
			);
			return array( 'result' => 'failure' );
		}

		$order->update_status( 'pending', __( 'Awaiting BSOL gateway payment confirmation.', 'bsol-connect' ) );

		return array(
			'result'   => 'success',
			'redirect' => $response['data']['redirect_url'],
		);
	}
}
