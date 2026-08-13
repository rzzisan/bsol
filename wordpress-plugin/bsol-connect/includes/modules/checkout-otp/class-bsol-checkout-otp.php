<?php
/**
 * Customer-facing checkout OTP gate on WooCommerce's order-received page —
 * the first storefront (not wp-admin) surface in this plugin. Only renders
 * when BSOL flagged the order as OTP-required during sync (see
 * class-bsol-order-sync.php's _bsol_otp_required meta) and it hasn't been
 * verified yet — toggled per-connection on the BSOL dashboard (WordPress
 * Connect settings page), off by default.
 *
 * The shopper's browser has no BSOL API key, so verification is relayed
 * server-side through WP AJAX — nopriv, since checkout is normally
 * anonymous — the same server-relay shape every other interactive feature
 * in this plugin already uses for wp-admin actions, just triggered from
 * the storefront instead.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Checkout_Otp {

	const META_OTP_REQUIRED = '_bsol_otp_required';
	const META_OTP_VERIFIED = '_bsol_otp_verified';

	public function __construct() {
		add_action( 'woocommerce_before_thankyou', array( $this, 'maybe_render_otp_gate' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue_assets' ) );

		add_action( 'wp_ajax_bsol_verify_otp', array( $this, 'ajax_verify' ) );
		add_action( 'wp_ajax_nopriv_bsol_verify_otp', array( $this, 'ajax_verify' ) );
		add_action( 'wp_ajax_bsol_resend_otp', array( $this, 'ajax_resend' ) );
		add_action( 'wp_ajax_nopriv_bsol_resend_otp', array( $this, 'ajax_resend' ) );
	}

	private function needs_gate( $order ) {
		return $order->get_meta( self::META_OTP_REQUIRED ) && ! $order->get_meta( self::META_OTP_VERIFIED );
	}

	public function maybe_render_otp_gate( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order || ! $this->needs_gate( $order ) ) {
			return;
		}
		?>
		<div class="bsol-otp-gate" data-order-id="<?php echo esc_attr( $order->get_id() ); ?>">
			<h2><?php esc_html_e( 'Verify your phone number', 'bsol-connect' ); ?></h2>
			<p><?php esc_html_e( 'Enter the code sent to your phone to confirm this order.', 'bsol-connect' ); ?></p>
			<div class="bsol-otp-controls">
				<input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" class="bsol-otp-input" placeholder="1234" />
				<button type="button" class="button bsol-otp-verify-btn"><?php esc_html_e( 'Verify', 'bsol-connect' ); ?></button>
				<button type="button" class="bsol-otp-resend-btn"><?php esc_html_e( 'Resend code', 'bsol-connect' ); ?></button>
			</div>
			<p class="bsol-otp-message" role="status"></p>
		</div>
		<?php
	}

	public function maybe_enqueue_assets() {
		if ( ! function_exists( 'is_order_received_page' ) || ! is_order_received_page() ) {
			return;
		}

		wp_enqueue_style( 'bsol-checkout-otp', BSOL_PLUGIN_URL . 'assets/css/bsol-checkout-otp.css', array(), BSOL_PLUGIN_VERSION );
		wp_enqueue_script( 'bsol-checkout-otp', BSOL_PLUGIN_URL . 'assets/js/bsol-checkout-otp.js', array( 'jquery' ), BSOL_PLUGIN_VERSION, true );
		wp_localize_script(
			'bsol-checkout-otp',
			'bsol_checkout_otp',
			array(
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'nonce'    => wp_create_nonce( 'bsol_checkout_otp_nonce' ),
				'i18n'     => array(
					'network_error' => __( 'Network error. Please try again.', 'bsol-connect' ),
					'resent'        => __( 'A new code has been sent.', 'bsol-connect' ),
				),
			)
		);
	}

	/** No current_user_can() gate — checkout is normally anonymous; the order_id + nonce pair is the only credential here. */
	public function ajax_verify() {
		check_ajax_referer( 'bsol_checkout_otp_nonce', 'nonce' );

		$order_id = isset( $_POST['order_id'] ) ? (int) $_POST['order_id'] : 0;
		$otp_code = isset( $_POST['otp_code'] ) ? sanitize_text_field( wp_unslash( $_POST['otp_code'] ) ) : '';
		$order    = $order_id ? wc_get_order( $order_id ) : null;

		if ( ! $order || '' === $otp_code ) {
			wp_send_json_error( array( 'message' => __( 'Invalid request.', 'bsol-connect' ) ) );
		}

		$api      = new Bsol_Api();
		$response = $api->verify_otp( $order->get_id(), $otp_code );

		if ( empty( $response['success'] ) ) {
			wp_send_json_error(
				array(
					'message'            => isset( $response['message'] ) ? $response['message'] : __( 'Verification failed.', 'bsol-connect' ),
					'remaining_attempts' => isset( $response['remaining_attempts'] ) ? $response['remaining_attempts'] : null,
				)
			);
		}

		$order->update_meta_data( self::META_OTP_VERIFIED, true );
		$order->save();

		wp_send_json_success();
	}

	public function ajax_resend() {
		check_ajax_referer( 'bsol_checkout_otp_nonce', 'nonce' );

		$order_id = isset( $_POST['order_id'] ) ? (int) $_POST['order_id'] : 0;
		$order    = $order_id ? wc_get_order( $order_id ) : null;

		if ( ! $order ) {
			wp_send_json_error( array( 'message' => __( 'Invalid request.', 'bsol-connect' ) ) );
		}

		$api      = new Bsol_Api();
		$response = $api->resend_otp( $order->get_id() );

		if ( empty( $response['success'] ) ) {
			wp_send_json_error(
				array(
					'message'             => isset( $response['message'] ) ? $response['message'] : __( 'Could not resend the code.', 'bsol-connect' ),
					'retry_after_seconds' => isset( $response['retry_after_seconds'] ) ? $response['retry_after_seconds'] : null,
				)
			);
		}

		wp_send_json_success();
	}
}
