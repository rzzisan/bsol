<?php
/**
 * Plugin Name:       BSOL Connect
 * Description:       Connects your WooCommerce store to BSOL for order sync, product sync, courier booking + waybill printing, phone fraud checking, and marketing tools.
 * Version:           1.3.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Requires Plugins:  woocommerce
 * Author:            ZyrotechBD
 * Text Domain:       bsol-connect
 * License:           GPL v2 or later
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) {
	die;
}

define( 'BSOL_PLUGIN_PATH', plugin_dir_path( __FILE__ ) );
define( 'BSOL_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'BSOL_PLUGIN_VERSION', '1.3.0' );
define( 'BSOL_API_URL', 'https://bsol.zyrotechbd.com/api/connect/v1/' );

/**
 * The code that runs during plugin activation.
 * This action is documented in includes/class-bsol-activator.php
 */
function activate_bsol_connect() {
	require_once BSOL_PLUGIN_PATH . 'includes/class-bsol-activator.php';
	Bsol_Activator::activate();
}
register_activation_hook( __FILE__, 'activate_bsol_connect' );

/**
 * The core plugin class that loads dependencies and registers all hooks.
 */
require_once BSOL_PLUGIN_PATH . 'includes/class-bsol-master.php';

/**
 * Begins execution of the plugin. Since everything is registered via hooks,
 * kicking off the plugin here does not affect the page life cycle.
 */
function run_bsol_connect() {
	$plugin = new Bsol_Master();
	$plugin->run();
}
add_action( 'plugins_loaded', 'run_bsol_connect' );
