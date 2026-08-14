<?php
/**
 * Fires only on full plugin deletion (Plugins → Delete), never on plain
 * deactivation. Revokes the API key on BSOL's side (best-effort — the
 * site may already be offline) and removes every option/transient this
 * plugin leaves behind, so nothing lingers in wp_options after removal.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$bsol_plugin_dir = __DIR__;

require_once $bsol_plugin_dir . '/includes/classes/class-bsol-helpers.php';
require_once $bsol_plugin_dir . '/includes/classes/class-bsol-activity-log.php';
require_once $bsol_plugin_dir . '/includes/classes/class-bsol-api.php';

if ( get_option( 'bsol_api_key' ) ) {
	$bsol_api = new Bsol_Api();
	$bsol_api->disconnect();
}

delete_option( 'bsol_api_key' );
delete_option( 'bsol_domain' );
delete_option( 'bsol_shop_name' );
delete_option( 'bsol_connected_at' );
delete_option( 'bsol_activity_log' );
delete_option( 'bsol_webhook_secret' );
delete_option( 'bsol_repeat_block_enabled' );
delete_option( 'bsol_repeat_block_hours' );
delete_option( 'bsol_repeat_block_message' );
delete_option( 'bsol_checkout_block_enabled' );
delete_option( 'bsol_checkout_block_message' );

global $wpdb;
$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( '_transient_bsol_health_' ) . '%' ) );
$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( '_transient_timeout_bsol_health_' ) . '%' ) );
