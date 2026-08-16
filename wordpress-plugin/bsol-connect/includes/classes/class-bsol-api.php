<?php
/**
 * Thin HTTP client for BSOL's /api/connect/v1/* surface. No business logic
 * lives here or anywhere else in this plugin beyond WooCommerce-side data
 * collection — fraud scoring, order validation, etc. all happen server-side
 * on BSOL. See bsol_history_and_new_context.md §5 ("Thin Client").
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Api {

	public function get_api_key() {
		return get_option( 'bsol_api_key', '' );
	}

	/**
	 * Blocking POST to BSOL_API_URL . $endpoint. Sends the API key and this
	 * site's domain as headers only (X-API-KEY / X-Client-Domain) — BSOL's
	 * AuthenticatePlatformApiKey middleware reads headers first, so unlike
	 * some legacy integrations there's no need to also duplicate these
	 * inside the JSON body.
	 *
	 * @param string $endpoint e.g. 'connect', 'orders/sync'
	 * @param array  $body
	 * @return array{success:bool,message?:string,error_code?:string,data?:mixed}
	 */
	private function remote_post( $endpoint, $body = array() ) {
		$url = BSOL_API_URL . $endpoint;

		$args = array(
			'body'        => wp_json_encode( $body ),
			'headers'     => array(
				'Content-Type'   => 'application/json',
				'X-API-KEY'      => $this->get_api_key(),
				'X-Client-Domain'=> Bsol_Helpers::site_domain(),
			),
			'timeout'     => 15,
			'data_format' => 'body',
		);

		$response = wp_remote_post( $url, $args );

		if ( is_wp_error( $response ) ) {
			$result = array(
				'success'    => false,
				'message'    => $response->get_error_message(),
				'error_code' => 'network_error',
			);
			Bsol_Activity_Log::record( $endpoint, false, $result['message'] );
			return $result;
		}

		$response_body = wp_remote_retrieve_body( $response );
		$decoded       = json_decode( $response_body, true );

		if ( json_last_error() !== JSON_ERROR_NONE || ! is_array( $decoded ) ) {
			$result = array(
				'success'    => false,
				'message'    => 'Unexpected server response: ' . substr( $response_body, 0, 150 ),
				'error_code' => 'invalid_response',
			);
			Bsol_Activity_Log::record( $endpoint, false, $result['message'] );
			return $result;
		}

		Bsol_Activity_Log::record(
			$endpoint,
			! empty( $decoded['success'] ),
			! empty( $decoded['success'] ) ? 'OK' : ( isset( $decoded['message'] ) ? $decoded['message'] : 'Failed' )
		);

		return $decoded;
	}

	public function connect() {
		return $this->remote_post( 'connect' );
	}

	public function disconnect() {
		return $this->remote_post( 'disconnect' );
	}

	public function sync_order( $order_data ) {
		return $this->remote_post( 'orders/sync', $order_data );
	}

	public function sync_product( $product_data ) {
		return $this->remote_post( 'products/sync', $product_data );
	}

	public function sync_order_status( $wc_order_id, $status, $note = null ) {
		return $this->remote_post(
			'orders/sync-status',
			array(
				'wc_order_id' => (string) $wc_order_id,
				'status'      => $status,
				'note'        => $note,
			)
		);
	}

	public function check_fraud( $phone ) {
		return $this->remote_post( 'fraud/check-phone', array( 'phone_number' => $phone ) );
	}

	/**
	 * Per-courier delivery-history breakdown (delivered/cancelled/success_rate
	 * per courier + an aggregate) — same data BSOL's own dashboard "Courier
	 * Delivery History" panel shows. Used by the Customer Health column
	 * instead of check_fraud()'s generic score, which is 0 for any phone
	 * with no prior BSOL order history (true for most WooCommerce customers).
	 */
	public function check_courier_health( $phone ) {
		return $this->remote_post( 'fraud/courier-health', array( 'phone_number' => $phone ) );
	}

	/**
	 * Checkout-in-progress capture (Phase 17) — best-effort marketing
	 * signal, not a transactional payload. $data already has session_token
	 * + whatever customer fields/items were resolved server-side from
	 * WC()->cart at capture time.
	 */
	public function sync_abandoned_checkout( $data ) {
		return $this->remote_post( 'checkout/abandoned', $data );
	}

	/**
	 * @param array $events Up to 50 event objects — Bsol_Tracking batches
	 *                       what one page load produced into a single call.
	 */
	public function send_tracking_events( $events ) {
		return $this->remote_post( 'tracking/events', array( 'events' => $events ) );
	}

	/**
	 * Which pixel to load and whether tracking is on at all for this site —
	 * cached by the caller (Bsol_Tracking), not called on every page load.
	 * A plain wp_remote_get() like steadfast_balance(), not remote_post():
	 * this is a read, and logging every cache refresh to the Activity Log
	 * would just be noise next to real sync/booking actions.
	 */
	public function get_tracking_config() {
		$response = wp_remote_get(
			BSOL_API_URL . 'tracking/config',
			array(
				'headers' => array(
					'X-API-KEY'       => $this->get_api_key(),
					'X-Client-Domain' => Bsol_Helpers::site_domain(),
				),
				'timeout' => 10,
			)
		);

		if ( is_wp_error( $response ) ) {
			return array( 'success' => false, 'message' => $response->get_error_message() );
		}

		$decoded = json_decode( wp_remote_retrieve_body( $response ), true );
		return is_array( $decoded ) ? $decoded : array( 'success' => false, 'message' => 'Unexpected server response.' );
	}

	public function verify_otp( $wc_order_id, $otp_code ) {
		return $this->remote_post(
			'orders/verify-otp',
			array(
				'wc_order_id' => (string) $wc_order_id,
				'otp_code'    => $otp_code,
			)
		);
	}

	public function resend_otp( $wc_order_id ) {
		return $this->remote_post( 'orders/resend-otp', array( 'wc_order_id' => (string) $wc_order_id ) );
	}

	/**
	 * Ad-hoc SMS to any phone number — not tied to a specific order.
	 * Gateway selection, credit balance/deduction, and history logging all
	 * happen server-side, same as BSOL dashboard's own Send SMS page.
	 */
	public function send_sms( $phone, $message ) {
		return $this->remote_post(
			'sms/send',
			array(
				'phone_number' => $phone,
				'message'      => $message,
			)
		);
	}

	/**
	 * $courier: 'steadfast' | 'paperfly' | 'manual' | 'pathao' | 'redx' |
	 * 'carrybee'. For the last three, BSOL derives the location IDs a
	 * WooCommerce order can't supply on a best-effort basis — see
	 * CourierLocationResolverService server-side. A booking can still fail
	 * with a clean 'location_unresolved' error if it can't do so
	 * confidently.
	 */
	public function book_courier( $wc_order_id, $courier, $tracking_id = null ) {
		return $this->remote_post(
			'courier/book',
			array(
				'wc_order_id' => (string) $wc_order_id,
				'courier'     => $courier,
				'tracking_id' => $tracking_id,
			)
		);
	}

	public function track_courier( $wc_order_id ) {
		return $this->remote_post( 'courier/track', array( 'wc_order_id' => (string) $wc_order_id ) );
	}

	public function cancel_courier( $wc_order_id ) {
		return $this->remote_post( 'courier/cancel', array( 'wc_order_id' => (string) $wc_order_id ) );
	}

	public function steadfast_balance() {
		$url = BSOL_API_URL . 'courier/balance';

		$response = wp_remote_get(
			$url,
			array(
				'headers' => array(
					'X-API-KEY'       => $this->get_api_key(),
					'X-Client-Domain' => Bsol_Helpers::site_domain(),
				),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			return array( 'success' => false, 'message' => $response->get_error_message() );
		}

		$decoded = json_decode( wp_remote_retrieve_body( $response ), true );
		return is_array( $decoded ) ? $decoded : array( 'success' => false, 'message' => 'Unexpected server response.' );
	}

	/**
	 * Returns the raw waybill PDF bytes (not JSON) — a browser needs to
	 * open this, and the plugin's API key never reaches the browser, so
	 * class-bsol-courier.php proxies it through an admin-post handler
	 * rather than linking straight to BSOL.
	 *
	 * @return array{success:bool,body?:string,content_type?:string,message?:string}
	 */
	public function get_waybill_pdf( $wc_order_id, $size = null ) {
		$url = BSOL_API_URL . 'courier/waybill?wc_order_id=' . rawurlencode( (string) $wc_order_id );
		if ( $size ) {
			$url .= '&size=' . rawurlencode( (string) $size );
		}

		$response = wp_remote_get(
			$url,
			array(
				'headers' => array(
					'X-API-KEY'       => $this->get_api_key(),
					'X-Client-Domain' => Bsol_Helpers::site_domain(),
				),
				'timeout' => 20,
			)
		);

		if ( is_wp_error( $response ) ) {
			return array( 'success' => false, 'message' => $response->get_error_message() );
		}

		$status = wp_remote_retrieve_response_code( $response );
		$body   = wp_remote_retrieve_body( $response );

		if ( $status !== 200 ) {
			$decoded = json_decode( $body, true );
			return array(
				'success' => false,
				'message' => is_array( $decoded ) && isset( $decoded['message'] ) ? $decoded['message'] : 'Waybill not available yet — book a courier first.',
			);
		}

		return array(
			'success'      => true,
			'body'         => $body,
			'content_type' => wp_remote_retrieve_header( $response, 'content-type' ) ?: 'application/pdf',
		);
	}

	/**
	 * Seller->customer sales invoice PDF — distinct from get_waybill_pdf()
	 * (courier sticker label). No booking precondition, works for any
	 * synced order. Same direct wp_remote_get() shape (not the JSON-only
	 * remote_post() helper) since this returns raw PDF bytes, not JSON.
	 *
	 * @return array{success:bool,body?:string,content_type?:string,message?:string}
	 */
	public function get_invoice_pdf( $wc_order_id ) {
		$url = BSOL_API_URL . 'orders/invoice?wc_order_id=' . rawurlencode( (string) $wc_order_id );

		$response = wp_remote_get(
			$url,
			array(
				'headers' => array(
					'X-API-KEY'       => $this->get_api_key(),
					'X-Client-Domain' => Bsol_Helpers::site_domain(),
				),
				'timeout' => 20,
			)
		);

		if ( is_wp_error( $response ) ) {
			return array( 'success' => false, 'message' => $response->get_error_message() );
		}

		$status = wp_remote_retrieve_response_code( $response );
		$body   = wp_remote_retrieve_body( $response );

		if ( $status !== 200 ) {
			$decoded = json_decode( $body, true );
			return array(
				'success' => false,
				'message' => is_array( $decoded ) && isset( $decoded['message'] ) ? $decoded['message'] : 'Invoice not available.',
			);
		}

		return array(
			'success'      => true,
			'body'         => $body,
			'content_type' => wp_remote_retrieve_header( $response, 'content-type' ) ?: 'application/pdf',
		);
	}
}
