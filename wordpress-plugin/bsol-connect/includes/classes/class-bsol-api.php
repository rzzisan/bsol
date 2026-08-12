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
			return array(
				'success'    => false,
				'message'    => $response->get_error_message(),
				'error_code' => 'network_error',
			);
		}

		$response_body = wp_remote_retrieve_body( $response );
		$decoded       = json_decode( $response_body, true );

		if ( json_last_error() !== JSON_ERROR_NONE || ! is_array( $decoded ) ) {
			return array(
				'success'    => false,
				'message'    => 'Unexpected server response: ' . substr( $response_body, 0, 150 ),
				'error_code' => 'invalid_response',
			);
		}

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
}
