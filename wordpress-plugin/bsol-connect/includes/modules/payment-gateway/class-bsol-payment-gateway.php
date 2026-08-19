<?php
/**
 * Registers BSOL's payment channels as WooCommerce payment methods, and
 * handles the two directions BSOL's gateway confirmation needs that
 * WooCommerce's own request cycle never sees:
 *
 * 1. /wp-json/bsol-connect/v1/payment-status (inbound, BSOL → here) — the
 *    gateway/IPN callback that actually confirms a payment lands on BSOL
 *    directly (bKash/SSLCommerz/etc. never talk to WordPress), so
 *    WooCommerce has no other way to learn "this order got paid". Same
 *    X-BSOL-Webhook-Secret auth as the existing /stock-update route
 *    (class-bsol-product-sync.php).
 * 2. /wp-json/bsol-connect/v1/payment-return (browser bridge) — after a
 *    gateway_auto payment finishes, BSOL redirects the customer's browser
 *    here rather than guessing WooCommerce's order-received URL itself
 *    (BSOL has no wc_get_order() to build the correct URL — including the
 *    order `key` needed for guest checkout — so it routes through this
 *    thin bridge, which does).
 *
 * See wordpress_connect_context.md.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Payment_Gateway {

	const CHANNELS_TRANSIENT = 'bsol_payment_channels';
	const CHANNELS_TTL       = 15 * MINUTE_IN_SECONDS;

	const WALLET_LABELS = array(
		'bkash'  => 'bKash (Personal)',
		'nagad'  => 'Nagad (Personal)',
		'rocket' => 'Rocket (Personal)',
	);

	const GATEWAY_LABELS = array(
		'sslcommerz'     => 'SSLCommerz',
		'aamarpay'       => 'AamarPay',
		'zinipay'        => 'ZiniPay',
		'shurjopay'      => 'ShurjoPay',
		'eps'            => 'EPS',
		'bkash_merchant' => 'bKash',
		'nagad_merchant' => 'Nagad',
	);

	/** @var Bsol_Order_Sync */
	private $order_sync;

	public function __construct( $order_sync ) {
		$this->order_sync = $order_sync;
		add_filter( 'woocommerce_payment_gateways', array( $this, 'register_gateways' ) );
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		add_action( 'woocommerce_before_thankyou', array( $this, 'maybe_render_wallet_claim_form' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue_assets' ) );
		add_action( 'wp_ajax_bsol_wallet_claim', array( $this, 'ajax_wallet_claim' ) );
		add_action( 'wp_ajax_nopriv_bsol_wallet_claim', array( $this, 'ajax_wallet_claim' ) );
		$this->maybe_register_blocks_support();
	}

	/**
	 * Registers each BSOL gateway with the WooCommerce Blocks (Cart &
	 * Checkout block) Store API — without this, a plain WC_Payment_Gateway
	 * is invisible on the block-based checkout (WooCommerce's default on
	 * new/updated sites since 8.3), with no error, it just never shows.
	 * Guarded behind class_exists() — older WooCommerce/Blocks versions
	 * simply skip this and fall back to classic-checkout-only support.
	 */
	private function maybe_register_blocks_support() {
		if ( ! class_exists( '\Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType' ) ) {
			return;
		}
		require_once BSOL_PLUGIN_PATH . 'includes/modules/payment-gateway/class-bsol-gateway-blocks-support.php';

		add_action(
			'woocommerce_blocks_payment_method_type_registration',
			array( $this, 'register_blocks_payment_methods' )
		);
	}

	public function register_blocks_payment_methods( $registry ) {
		$channels = $this->get_channels();
		$ids      = array();

		foreach ( array_merge( $channels['wallet_channels'], $channels['gateway_channels'] ) as $channel ) {
			$ids[] = 'bsol_' . $channel['provider'];
		}

		if ( empty( $ids ) ) {
			return;
		}

		// Throwaway lookup purely to read each gateway's title/description/
		// enabled state via the normal WC_Payment_Gateway API — the actual
		// process_payment() call always goes through WooCommerce's own
		// payment_gateways() registry (register_gateways() above), never
		// through anything built here.
		$all_gateways = WC()->payment_gateways()->payment_gateways();

		foreach ( $ids as $gateway_id ) {
			if ( isset( $all_gateways[ $gateway_id ] ) ) {
				$registry->register( new Bsol_Gateway_Blocks_Support( $all_gateways[ $gateway_id ] ) );
			}
		}

		wp_register_script(
			'bsol-gateway-blocks',
			BSOL_PLUGIN_URL . 'assets/js/bsol-gateway-blocks.js',
			array( 'wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities' ),
			BSOL_PLUGIN_VERSION,
			true
		);
		wp_add_inline_script(
			'bsol-gateway-blocks',
			'window.bsol_gateway_blocks_ids = ' . wp_json_encode( $ids ) . ';',
			'before'
		);
	}

	public function register_gateways( $gateways ) {
		$channels = $this->get_channels();

		foreach ( $channels['wallet_channels'] as $channel ) {
			$provider  = $channel['provider'];
			$gateways[] = new Bsol_Gateway( $provider, $this->label( self::WALLET_LABELS, $provider ), 'wallet_manual', $this->order_sync );
		}

		foreach ( $channels['gateway_channels'] as $channel ) {
			$provider  = $channel['provider'];
			$gateways[] = new Bsol_Gateway( $provider, $this->label( self::GATEWAY_LABELS, $provider ), 'gateway_auto', $this->order_sync );
		}

		return $gateways;
	}

	private function label( $map, $provider ) {
		return isset( $map[ $provider ] ) ? $map[ $provider ] : ucfirst( str_replace( '_', ' ', $provider ) );
	}

	/**
	 * @return array{wallet_channels:array,gateway_channels:array}
	 */
	private function get_channels() {
		$cached = get_transient( self::CHANNELS_TRANSIENT );
		if ( false !== $cached ) {
			return $cached;
		}

		$api      = new Bsol_Api();
		$response = $api->get_payment_channels();

		$data = array(
			'wallet_channels'  => ( ! empty( $response['success'] ) && ! empty( $response['data']['wallet_channels'] ) ) ? $response['data']['wallet_channels'] : array(),
			'gateway_channels' => ( ! empty( $response['success'] ) && ! empty( $response['data']['gateway_channels'] ) ) ? $response['data']['gateway_channels'] : array(),
		);

		// Cache the miss too (shorter TTL implicit via the same TTL here is
		// fine — unlike the update-checker, a stale "no channels" isn't
		// harmful, just means payment methods take up to 15 min to appear
		// after first being enabled in BSOL).
		set_transient( self::CHANNELS_TRANSIENT, $data, self::CHANNELS_TTL );

		return $data;
	}

	public function register_rest_routes() {
		register_rest_route(
			'bsol-connect/v1',
			'/payment-status',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle_payment_status_webhook' ),
				'permission_callback' => array( $this, 'verify_webhook_auth' ),
			)
		);

		register_rest_route(
			'bsol-connect/v1',
			'/payment-return',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle_payment_return' ),
				// No secret needed — this route only looks up an order and
				// 302s to WooCommerce's own order-received URL (which
				// WooCommerce itself decides how much to reveal based on
				// the order key/login state). Same public-but-harmless
				// trust level as the plugin-zip download.
				'permission_callback' => '__return_true',
			)
		);
	}

	/** Same pattern as class-bsol-product-sync.php's /stock-update route. */
	public function verify_webhook_auth( $request ) {
		$saved_secret = get_option( 'bsol_webhook_secret' );
		$sent_secret  = $request->get_header( 'X-BSOL-Webhook-Secret' );

		return ! empty( $saved_secret ) && ! empty( $sent_secret ) && hash_equals( $saved_secret, (string) $sent_secret );
	}

	public function handle_payment_status_webhook( $request ) {
		$wc_order_id = $request->get_param( 'wc_order_id' );
		$order       = $wc_order_id ? wc_get_order( $wc_order_id ) : false;

		if ( ! $order ) {
			return new WP_REST_Response( array( 'success' => false, 'message' => 'Order not found.' ), 404 );
		}

		if ( 'paid' === $request->get_param( 'status' ) && ! $order->is_paid() ) {
			$trx_id = $request->get_param( 'trx_id' );
			$order->payment_complete( $trx_id ? $trx_id : '' );
			$order->add_order_note(
				sprintf(
					/* translators: 1: payment method/provider, 2: transaction id */
					__( 'BSOL confirmed payment via %1$s (TrxID: %2$s).', 'bsol-connect' ),
					(string) $request->get_param( 'method' ),
					$trx_id ? $trx_id : 'N/A'
				)
			);
		}

		return new WP_REST_Response( array( 'success' => true ), 200 );
	}

	public function handle_payment_return( $request ) {
		$wc_order_id = $request->get_param( 'wc_order_id' );
		$result      = $request->get_param( 'payment_result' );
		$order       = $wc_order_id ? wc_get_order( $wc_order_id ) : false;

		$target = $order ? $order->get_checkout_order_received_url() : wc_get_page_permalink( 'shop' );
		$target = add_query_arg( 'bsol_payment_result', $result ? sanitize_text_field( (string) $result ) : 'unknown', $target );

		wp_safe_redirect( $target );
		exit;
	}

	// ── Wallet-claim mini-form (order-received page) ─────────────────────

	private function needs_wallet_claim_form( $order ) {
		$method = $order->get_payment_method();
		if ( 0 !== strpos( $method, 'bsol_' ) ) {
			return false;
		}
		$provider = substr( $method, strlen( 'bsol_' ) );
		if ( ! array_key_exists( $provider, self::WALLET_LABELS ) ) {
			return false; // gateway_auto orders were already redirected off-site
		}
		return ! $order->is_paid();
	}

	public function maybe_render_wallet_claim_form( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$result = isset( $_GET['bsol_payment_result'] ) ? sanitize_text_field( wp_unslash( $_GET['bsol_payment_result'] ) ) : '';
		if ( 'success' === $result ) {
			echo '<div class="bsol-payment-banner bsol-payment-success">' . esc_html__( 'Payment successful! Your order is confirmed.', 'bsol-connect' ) . '</div>';
			return;
		}
		if ( 'failed' === $result ) {
			echo '<div class="bsol-payment-banner bsol-payment-failed">' . esc_html__( 'Payment failed or was cancelled. Please try again from your account, or contact us.', 'bsol-connect' ) . '</div>';
			return;
		}

		if ( ! $this->needs_wallet_claim_form( $order ) ) {
			return;
		}

		$provider = substr( $order->get_payment_method(), strlen( 'bsol_' ) );
		$number   = $this->receiving_number_for( $provider );
		if ( ! $number ) {
			return; // channel got disabled between checkout and now — nothing to show
		}
		?>
		<div class="bsol-wallet-claim" data-order-id="<?php echo esc_attr( $order->get_id() ); ?>" data-provider="<?php echo esc_attr( $provider ); ?>">
			<h2><?php echo esc_html( sprintf(
				/* translators: %s: provider label, e.g. "bKash" */
				__( 'Pay via %s', 'bsol-connect' ),
				$this->label( self::WALLET_LABELS, $provider )
			) ); ?></h2>
			<p>
				<?php echo esc_html( sprintf(
					/* translators: 1: wallet number, 2: order total */
					__( 'Send %2$s to this %1$s number, then submit the Transaction ID below.', 'bsol-connect' ),
					$this->label( self::WALLET_LABELS, $provider ),
					wp_strip_all_tags( wc_price( $order->get_total() ) )
				) ); ?>
			</p>
			<p class="bsol-wallet-claim-number"><?php echo esc_html( $number ); ?></p>
			<p>
				<label>
					<?php esc_html_e( 'Your number (sent from)', 'bsol-connect' ); ?>
					<input type="text" class="bsol-wallet-claim-sender" inputmode="tel" />
				</label>
			</p>
			<p>
				<label>
					<?php esc_html_e( 'Transaction ID', 'bsol-connect' ); ?>
					<input type="text" class="bsol-wallet-claim-trxid" />
				</label>
			</p>
			<button type="button" class="button bsol-wallet-claim-submit"><?php esc_html_e( 'Submit payment info', 'bsol-connect' ); ?></button>
			<p class="bsol-wallet-claim-message" role="status"></p>
		</div>
		<?php
	}

	private function receiving_number_for( $provider ) {
		$channels = $this->get_channels();
		foreach ( $channels['wallet_channels'] as $channel ) {
			if ( $channel['provider'] === $provider && ! empty( $channel['number'] ) ) {
				return $channel['number'];
			}
		}
		return null;
	}

	public function maybe_enqueue_assets() {
		if ( ! function_exists( 'is_order_received_page' ) || ! is_order_received_page() ) {
			return;
		}

		wp_enqueue_style( 'bsol-payment-gateway', BSOL_PLUGIN_URL . 'assets/css/bsol-payment-gateway.css', array(), BSOL_PLUGIN_VERSION );
		wp_enqueue_script( 'bsol-payment-gateway', BSOL_PLUGIN_URL . 'assets/js/bsol-payment-gateway.js', array( 'jquery' ), BSOL_PLUGIN_VERSION, true );
		wp_localize_script(
			'bsol-payment-gateway',
			'bsol_payment_gateway',
			array(
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'nonce'    => wp_create_nonce( 'bsol_wallet_claim_nonce' ),
				'i18n'     => array(
					'network_error'  => __( 'Network error. Please try again.', 'bsol-connect' ),
					'missing_fields' => __( 'Please fill in both fields.', 'bsol-connect' ),
					'submitted'      => __( 'Thanks! We\'ll confirm your payment shortly.', 'bsol-connect' ),
				),
			)
		);
	}

	/** No current_user_can() gate — order-received is normally anonymous;
	 *  the order_id + nonce pair is the only credential here, same as
	 *  Bsol_Checkout_Otp::ajax_verify(). */
	public function ajax_wallet_claim() {
		check_ajax_referer( 'bsol_wallet_claim_nonce', 'nonce' );

		$order_id     = isset( $_POST['order_id'] ) ? (int) $_POST['order_id'] : 0;
		$provider     = isset( $_POST['provider'] ) ? sanitize_text_field( wp_unslash( $_POST['provider'] ) ) : '';
		$sender       = isset( $_POST['sender_number'] ) ? sanitize_text_field( wp_unslash( $_POST['sender_number'] ) ) : '';
		$trx_id       = isset( $_POST['customer_trx_id'] ) ? sanitize_text_field( wp_unslash( $_POST['customer_trx_id'] ) ) : '';
		$order        = $order_id ? wc_get_order( $order_id ) : null;

		if ( ! $order || '' === $sender || '' === $trx_id || ! array_key_exists( $provider, self::WALLET_LABELS ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid request.', 'bsol-connect' ) ) );
		}

		$api      = new Bsol_Api();
		$response = $api->submit_wallet_claim( $order->get_id(), $provider, $sender, $trx_id );

		if ( empty( $response['success'] ) ) {
			wp_send_json_error( array( 'message' => isset( $response['message'] ) ? $response['message'] : __( 'Could not submit — please try again.', 'bsol-connect' ) ) );
		}

		wp_send_json_success();
	}
}
