<?php
/**
 * Self-update notice — this plugin isn't on WordPress.org, so nothing
 * tells a seller a newer version exists except manually re-checking the
 * BSOL dashboard. Runs unconditionally (unlike every feature module,
 * which is gated behind is_connected() && WooCommerce active) — a
 * disconnected-but-installed site still needs to know about updates.
 *
 * Checks BSOL_PLUGIN_VERSION_CHECK_URL, cached in a transient so this is
 * one real remote call per CACHE_TTL, not one per admin page load.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Update_Checker {

	const TRANSIENT_KEY = 'bsol_update_check';
	const CACHE_TTL      = 12 * HOUR_IN_SECONDS;
	const MISS_CACHE_TTL = 1 * HOUR_IN_SECONDS;

	public function __construct() {
		add_action( 'admin_notices', array( $this, 'maybe_render_update_notice' ) );
	}

	public function maybe_render_update_notice() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$latest = $this->get_latest_version_info();
		if ( empty( $latest['version'] ) || empty( $latest['download_url'] ) ) {
			return;
		}

		if ( ! version_compare( $latest['version'], BSOL_PLUGIN_VERSION, '>' ) ) {
			return;
		}

		printf(
			'<div class="notice notice-warning is-dismissible"><p>%s <a href="%s" target="_blank">%s</a></p></div>',
			sprintf(
				/* translators: 1: currently installed version, 2: latest available version */
				esc_html__( 'BSOL Connect %1$s is installed; version %2$s is available.', 'bsol-connect' ),
				esc_html( BSOL_PLUGIN_VERSION ),
				esc_html( $latest['version'] )
			),
			esc_url( $latest['download_url'] ),
			esc_html__( 'Download the update', 'bsol-connect' )
		);
	}

	private function get_latest_version_info() {
		$cached = get_transient( self::TRANSIENT_KEY );
		if ( false !== $cached ) {
			return $cached;
		}

		$response = wp_remote_get( BSOL_PLUGIN_VERSION_CHECK_URL, array( 'timeout' => 10 ) );

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			// Cache the miss too (shorter TTL) — an unreachable/down BSOL
			// shouldn't mean a remote call on every single admin page load.
			set_transient( self::TRANSIENT_KEY, array(), self::MISS_CACHE_TTL );
			return array();
		}

		$decoded = json_decode( wp_remote_retrieve_body( $response ), true );
		$data    = ( is_array( $decoded ) && ! empty( $decoded['success'] ) && is_array( $decoded['data'] ?? null ) )
			? $decoded['data']
			: array();

		set_transient( self::TRANSIENT_KEY, $data, self::CACHE_TTL );

		return $data;
	}
}
