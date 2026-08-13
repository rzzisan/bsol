<?php
/**
 * Lightweight sync activity log — every call BSOL_Api::remote_post() makes
 * (connect, order/product/status sync, fraud check, courier book/track/
 * cancel) records a success/failure entry here, so a seller can see *why*
 * an order silently never showed up in BSOL instead of guessing. Stored in
 * a single capped option (last 50 entries), not a custom table — matches
 * this plugin's existing "options + transients only" storage convention.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Activity_Log {

	const OPTION_KEY = 'bsol_activity_log';
	const MAX_ENTRIES = 50;

	public static function record( $type, $success, $message ) {
		$entries = self::get_recent( self::MAX_ENTRIES );

		array_unshift(
			$entries,
			array(
				'time'    => current_time( 'mysql' ),
				'type'    => $type,
				'success' => (bool) $success,
				'message' => is_string( $message ) ? $message : wp_json_encode( $message ),
			)
		);

		$entries = array_slice( $entries, 0, self::MAX_ENTRIES );

		update_option( self::OPTION_KEY, $entries, false );
	}

	public static function get_recent( $limit = 50 ) {
		$entries = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $entries ) ) {
			return array();
		}
		return array_slice( $entries, 0, $limit );
	}

	public static function clear() {
		delete_option( self::OPTION_KEY );
	}
}
