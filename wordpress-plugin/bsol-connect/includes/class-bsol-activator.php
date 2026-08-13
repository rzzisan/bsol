<?php
/**
 * Fired during plugin activation. Seeds the WP options this plugin reads
 * throughout — all default to '' (not connected) until the seller submits
 * their API key on the Settings tab.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Activator {

	public static function activate() {
		add_option( 'bsol_api_key', '' );
		add_option( 'bsol_domain', '' );
		add_option( 'bsol_shop_name', '' );
		add_option( 'bsol_connected_at', '' );
		add_option( 'bsol_webhook_secret', '' );
	}
}
