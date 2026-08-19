<?php
/**
 * WP Admin page: a single "BSOL Connect" menu with two tabs — Settings
 * (connect/disconnect) and Dashboard (status + a manual fraud-check
 * tester). Plain self-posting forms + nonces, no AJAX — matches the proven
 * pattern from zayroo-connect's admin class.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Admin {

	public function add_admin_menu() {
		add_menu_page(
			'BSOL Connect',
			'BSOL Connect',
			'manage_options',
			'bsol_connect',
			array( $this, 'display_plugin_page' ),
			'dashicons-cloud',
			56
		);
	}

	public function display_plugin_page() {
		$fraud_result = null;

		if ( isset( $_POST['bsol_submit_connect'] ) && check_admin_referer( 'bsol_save_settings' ) ) {
			$this->handle_connection_request();
		} elseif ( isset( $_POST['bsol_disconnect'] ) && check_admin_referer( 'bsol_disconnect_action' ) ) {
			$this->handle_disconnect_request();
		} elseif ( isset( $_POST['bsol_check_fraud'] ) && check_admin_referer( 'bsol_fraud_check_action' ) ) {
			$fraud_result = $this->handle_fraud_check_test();
		} elseif ( isset( $_POST['bsol_clear_log'] ) && check_admin_referer( 'bsol_clear_log_action' ) ) {
			Bsol_Activity_Log::clear();
			add_settings_error( 'bsol_messages', 'bsol_message', __( 'Activity log cleared.', 'bsol-connect' ), 'success' );
		} elseif ( isset( $_POST['bsol_save_repeat_block'] ) && check_admin_referer( 'bsol_repeat_block_settings_action' ) ) {
			$this->handle_repeat_block_settings_save();
		} elseif ( isset( $_POST['bsol_save_checkout_block'] ) && check_admin_referer( 'bsol_checkout_block_settings_action' ) ) {
			$this->handle_checkout_block_settings_save();
		} elseif ( isset( $_POST['bsol_refresh_payment_channels'] ) && check_admin_referer( 'bsol_refresh_payment_channels_action' ) ) {
			// Hardcoded transient keys rather than referencing
			// Bsol_Payment_Gateway::CHANNELS_TRANSIENT — that class's file
			// is only require_once'd on woocommerce_loaded (see
			// class-bsol-master.php's docblock for why), so it isn't
			// guaranteed loaded here even when WooCommerce is active.
			delete_transient( 'bsol_payment_channels' );
			delete_transient( 'bsol_update_check' );
			add_settings_error( 'bsol_messages', 'bsol_message', __( 'Cleared — the checkout page and update notice will pick up fresh data on next load.', 'bsol-connect' ), 'success' );
		}

		$balance_result = null;
		if ( isset( $_POST['bsol_check_balance'] ) && check_admin_referer( 'bsol_check_balance_action' ) ) {
			$api = new Bsol_Api();
			$balance_result = $api->steadfast_balance();
		}

		$is_connected = $this->is_connected();
		$active_tab   = $is_connected && isset( $_GET['tab'] ) ? sanitize_text_field( wp_unslash( $_GET['tab'] ) ) : 'dashboard';
		?>
		<div class="wrap bsol-wrap">
			<h1 class="bsol-page-title"><?php esc_html_e( 'BSOL Connect', 'bsol-connect' ); ?></h1>

			<div class="bsol-header">
				<div class="bsol-header-left">
					<span class="bsol-logo-mark" aria-hidden="true">B</span>
					<div>
						<p class="bsol-header-title"><?php esc_html_e( 'BSOL Connect', 'bsol-connect' ); ?></p>
						<p class="bsol-header-sub"><?php esc_html_e( 'Order sync, product sync, courier booking & fraud checks', 'bsol-connect' ); ?></p>
					</div>
				</div>
				<div class="bsol-header-right">
					<?php if ( $is_connected ) : ?>
						<span class="bsol-pill bsol-pill-connected"><span class="bsol-dot"></span><?php esc_html_e( 'Connected', 'bsol-connect' ); ?></span>
					<?php else : ?>
						<span class="bsol-pill bsol-pill-disconnected"><span class="bsol-dot"></span><?php esc_html_e( 'Not connected', 'bsol-connect' ); ?></span>
					<?php endif; ?>
				</div>
			</div>

			<?php settings_errors( 'bsol_messages' ); ?>

			<?php if ( $is_connected ) : ?>
				<div class="bsol-tabs">
					<a href="?page=bsol_connect&tab=dashboard" class="bsol-tab <?php echo 'dashboard' === $active_tab ? 'is-active' : ''; ?>">
						<?php esc_html_e( 'Dashboard', 'bsol-connect' ); ?>
					</a>
					<a href="?page=bsol_connect&tab=log" class="bsol-tab <?php echo 'log' === $active_tab ? 'is-active' : ''; ?>">
						<?php esc_html_e( 'Activity Log', 'bsol-connect' ); ?>
					</a>
					<a href="?page=bsol_connect&tab=sync" class="bsol-tab <?php echo 'sync' === $active_tab ? 'is-active' : ''; ?>">
						<?php esc_html_e( 'Sync Data', 'bsol-connect' ); ?>
					</a>
					<a href="?page=bsol_connect&tab=settings" class="bsol-tab <?php echo 'settings' === $active_tab ? 'is-active' : ''; ?>">
						<?php esc_html_e( 'Settings', 'bsol-connect' ); ?>
					</a>
				</div>
			<?php endif; ?>

			<div class="bsol-card" style="max-width:<?php echo in_array( $active_tab, array( 'log', 'sync' ), true ) ? '900px' : '680px'; ?>;">
				<?php
				if ( ! $is_connected || 'settings' === $active_tab ) {
					$this->render_settings_tab();
				} elseif ( 'log' === $active_tab ) {
					$this->render_activity_log_tab();
				} elseif ( 'sync' === $active_tab ) {
					$this->render_sync_data_tab();
				} else {
					$this->render_dashboard_tab( $fraud_result, $balance_result );
				}
				?>
			</div>
		</div>
		<?php
	}

	private function is_connected() {
		return (bool) get_option( 'bsol_api_key' ) && (bool) get_option( 'bsol_domain' );
	}

	// ── Settings tab ─────────────────────────────────────────────────────────

	private function render_settings_tab() {
		$api_key   = get_option( 'bsol_api_key', '' );
		$domain    = get_option( 'bsol_domain', '' );
		$connected = ! empty( $domain );
		?>
		<?php if ( $connected ) : ?>
			<div class="bsol-stat-grid">
				<div class="bsol-stat-card">
					<span class="bsol-stat-label"><?php esc_html_e( 'Status', 'bsol-connect' ); ?></span>
					<span class="bsol-stat-value" style="color:#1a7f37;"><?php esc_html_e( 'Connected', 'bsol-connect' ); ?></span>
				</div>
				<div class="bsol-stat-card">
					<span class="bsol-stat-label"><?php esc_html_e( 'Domain', 'bsol-connect' ); ?></span>
					<span class="bsol-stat-value"><?php echo esc_html( $domain ); ?></span>
				</div>
			</div>
			<p class="description"><?php esc_html_e( 'This site is syncing orders and fraud checks with BSOL.', 'bsol-connect' ); ?></p>

			<?php $this->render_repeat_block_settings(); ?>
			<?php $this->render_checkout_block_settings(); ?>
			<?php $this->render_payment_gateway_status(); ?>

			<form method="post" action="" onsubmit="return confirm('<?php echo esc_js( __( 'Disconnect this site from BSOL? New orders will stop syncing until you reconnect.', 'bsol-connect' ) ); ?>');">
				<?php wp_nonce_field( 'bsol_disconnect_action' ); ?>
				<button type="submit" name="bsol_disconnect" class="button button-secondary">
					<?php esc_html_e( 'Disconnect', 'bsol-connect' ); ?>
				</button>
			</form>
		<?php else : ?>
			<p><strong><?php esc_html_e( 'Status:', 'bsol-connect' ); ?></strong>
				<span style="color:#b32d2e;"><?php esc_html_e( 'Not connected', 'bsol-connect' ); ?></span>
			</p>
			<form method="post" action="">
				<?php wp_nonce_field( 'bsol_save_settings' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="bsol_api_key"><?php esc_html_e( 'API Key', 'bsol-connect' ); ?></label></th>
						<td>
							<input type="password" name="bsol_api_key" id="bsol_api_key"
								value="<?php echo esc_attr( $api_key ); ?>" class="regular-text" autocomplete="off" />
							<p class="description">
								<?php esc_html_e( 'Generate this key from your BSOL dashboard: Settings → WordPress Connect. The key is bound to this site\'s domain.', 'bsol-connect' ); ?>
							</p>
						</td>
					</tr>
				</table>
				<button type="submit" name="bsol_submit_connect" class="button button-primary">
					<?php esc_html_e( 'Save & Connect', 'bsol-connect' ); ?>
				</button>
			</form>
		<?php endif; ?>
		<?php
	}

	private function handle_connection_request() {
		$api_key = isset( $_POST['bsol_api_key'] ) ? sanitize_text_field( wp_unslash( $_POST['bsol_api_key'] ) ) : '';
		update_option( 'bsol_api_key', $api_key );

		$api      = new Bsol_Api();
		$response = $api->connect();

		if ( ! empty( $response['success'] ) ) {
			update_option( 'bsol_domain', isset( $response['data']['domain'] ) ? $response['data']['domain'] : Bsol_Helpers::site_domain() );
			update_option( 'bsol_shop_name', isset( $response['data']['shop_name'] ) ? $response['data']['shop_name'] : '' );
			update_option( 'bsol_connected_at', current_time( 'mysql' ) );
			// Used to verify inbound stock-push-back calls FROM BSOL —
			// see Bsol_Product_Sync::verify_webhook_auth(). Shown once,
			// same as the API key itself.
			update_option( 'bsol_webhook_secret', isset( $response['data']['webhook_secret'] ) ? $response['data']['webhook_secret'] : '' );
			add_settings_error( 'bsol_messages', 'bsol_message', __( 'Connected successfully!', 'bsol-connect' ), 'success' );
		} else {
			update_option( 'bsol_api_key', '' );
			$message = isset( $response['message'] ) ? $response['message'] : __( 'Connection failed. Please check your API key.', 'bsol-connect' );
			add_settings_error( 'bsol_messages', 'bsol_message', 'Connection failed: ' . $message, 'error' );
		}
	}

	/**
	 * Fully WP-local — see class-bsol-repeat-order-block.php's docblock for
	 * why these settings live here instead of on the BSOL dashboard.
	 */
	private function render_repeat_block_settings() {
		$enabled = get_option( 'bsol_repeat_block_enabled', '0' );
		$hours   = get_option( 'bsol_repeat_block_hours', '24' );
		$message = get_option( 'bsol_repeat_block_message', Bsol_Repeat_Order_Block::DEFAULT_MESSAGE );
		?>
		<div class="bsol-section">
			<h3 class="bsol-section-title"><?php esc_html_e( 'Repeat Order Block', 'bsol-connect' ); ?></h3>
			<p class="description">
				<?php esc_html_e( 'Stop the same phone number from placing a second order within a set number of hours. Checked instantly against this site\'s own order history — no BSOL connection required for the check itself.', 'bsol-connect' ); ?>
			</p>
			<form method="post" action="">
				<?php wp_nonce_field( 'bsol_repeat_block_settings_action' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Enable', 'bsol-connect' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="bsol_repeat_block_enabled" value="1" <?php checked( $enabled, '1' ); ?> />
								<?php esc_html_e( 'Block repeat orders from the same phone number', 'bsol-connect' ); ?>
							</label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="bsol_repeat_block_hours"><?php esc_html_e( 'Block window (hours)', 'bsol-connect' ); ?></label></th>
						<td>
							<input type="number" min="1" name="bsol_repeat_block_hours" id="bsol_repeat_block_hours"
								value="<?php echo esc_attr( $hours ); ?>" class="small-text" />
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="bsol_repeat_block_message"><?php esc_html_e( 'Error message', 'bsol-connect' ); ?></label></th>
						<td>
							<input type="text" name="bsol_repeat_block_message" id="bsol_repeat_block_message"
								value="<?php echo esc_attr( $message ); ?>" class="large-text" />
							<p class="description"><?php esc_html_e( 'Use %d to show the number of hours left before they can order again.', 'bsol-connect' ); ?></p>
						</td>
					</tr>
				</table>
				<button type="submit" name="bsol_save_repeat_block" class="button button-primary">
					<?php esc_html_e( 'Save', 'bsol-connect' ); ?>
				</button>
			</form>
		</div>
		<?php
	}

	private function handle_repeat_block_settings_save() {
		update_option( 'bsol_repeat_block_enabled', isset( $_POST['bsol_repeat_block_enabled'] ) ? '1' : '0' );

		$hours = isset( $_POST['bsol_repeat_block_hours'] ) ? (int) $_POST['bsol_repeat_block_hours'] : 24;
		update_option( 'bsol_repeat_block_hours', max( 1, $hours ) );

		$message = isset( $_POST['bsol_repeat_block_message'] ) ? sanitize_text_field( wp_unslash( $_POST['bsol_repeat_block_message'] ) ) : '';
		update_option( 'bsol_repeat_block_message', $message ?: Bsol_Repeat_Order_Block::DEFAULT_MESSAGE );

		add_settings_error( 'bsol_messages', 'bsol_message', __( 'Repeat order block settings saved.', 'bsol-connect' ), 'success' );
	}

	/**
	 * Needs a live BSOL call per checkout (the blacklist lives on BSOL, not
	 * locally) — unlike Repeat Order Block, so this can't be purely
	 * WP-local, but the settings still live here rather than on the BSOL
	 * dashboard for consistency with that section's UX.
	 */
	private function render_checkout_block_settings() {
		$enabled = get_option( 'bsol_checkout_block_enabled', '0' );
		$message = get_option( 'bsol_checkout_block_message', Bsol_Checkout_Block::DEFAULT_MESSAGE );
		?>
		<div class="bsol-section">
			<h3 class="bsol-section-title"><?php esc_html_e( 'Checkout Blacklist Block', 'bsol-connect' ); ?></h3>
			<p class="description">
				<?php esc_html_e( 'Stop checkout for a phone number you have blacklisted on your BSOL dashboard (Orders → Blacklist). Checked against BSOL at checkout time.', 'bsol-connect' ); ?>
			</p>
			<form method="post" action="">
				<?php wp_nonce_field( 'bsol_checkout_block_settings_action' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Enable', 'bsol-connect' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="bsol_checkout_block_enabled" value="1" <?php checked( $enabled, '1' ); ?> />
								<?php esc_html_e( 'Block checkout for blacklisted phone numbers', 'bsol-connect' ); ?>
							</label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="bsol_checkout_block_message"><?php esc_html_e( 'Error message', 'bsol-connect' ); ?></label></th>
						<td>
							<input type="text" name="bsol_checkout_block_message" id="bsol_checkout_block_message"
								value="<?php echo esc_attr( $message ); ?>" class="large-text" />
						</td>
					</tr>
				</table>
				<button type="submit" name="bsol_save_checkout_block" class="button button-primary">
					<?php esc_html_e( 'Save', 'bsol-connect' ); ?>
				</button>
			</form>
		</div>
		<?php
	}

	/**
	 * Diagnostic status panel, not a config form — actual provider
	 * enable/credentials always live on the BSOL dashboard (Settings →
	 * Online Payment Channels), same as courier credentials and the
	 * checkout-OTP toggle. This just answers, live, "does this site
	 * currently see any channel, and which checkout type is it using" —
	 * exactly the two questions that took a live-test round-trip to answer
	 * before this existed. Calls BSOL directly (bypasses the 15-min
	 * transient the checkout-time registration uses) since this is a
	 * low-traffic admin page, not checkout — always show current truth.
	 */
	private function render_payment_gateway_status() {
		$api      = new Bsol_Api();
		$response = $api->get_payment_channels();
		?>
		<div class="bsol-section">
			<h3 class="bsol-section-title"><?php esc_html_e( 'Payment Gateways', 'bsol-connect' ); ?></h3>
			<p class="description">
				<?php esc_html_e( 'Enable and configure providers on your BSOL dashboard → Settings → Online Payment Channels — this panel just shows what this site currently sees from here, live.', 'bsol-connect' ); ?>
			</p>

			<?php if ( empty( $response['success'] ) ) : ?>
				<div class="bsol-result bsol-result-error">
					<?php echo esc_html( isset( $response['message'] ) ? $response['message'] : __( 'Could not reach BSOL.', 'bsol-connect' ) ); ?>
				</div>
			<?php else :
				$wallet_channels  = isset( $response['data']['wallet_channels'] ) ? $response['data']['wallet_channels'] : array();
				$gateway_channels = isset( $response['data']['gateway_channels'] ) ? $response['data']['gateway_channels'] : array();
				$providers        = array_merge(
					wp_list_pluck( $wallet_channels, 'provider' ),
					wp_list_pluck( $gateway_channels, 'provider' )
				);
				?>
				<?php if ( empty( $providers ) ) : ?>
					<div class="bsol-result bsol-result-error">
						<?php esc_html_e( 'No payment channel is enabled on your BSOL account yet. Go to BSOL dashboard → Settings → Online Payment Channels, enable at least one, then click Refresh below.', 'bsol-connect' ); ?>
					</div>
				<?php else : ?>
					<div class="bsol-result bsol-result-ok">
						<strong><?php esc_html_e( 'Currently enabled:', 'bsol-connect' ); ?></strong>
						<?php echo esc_html( implode( ', ', $providers ) ); ?>
					</div>
				<?php endif; ?>
			<?php endif; ?>

			<p class="description">
				<?php
				printf(
					/* translators: %s: detected checkout type, e.g. "block-based Checkout" */
					esc_html__( "This site's Checkout page appears to use: %s", 'bsol-connect' ),
					'<strong>' . esc_html( $this->detect_checkout_type() ) . '</strong>'
				);
				?>
			</p>

			<form method="post" action="?page=bsol_connect&tab=settings">
				<?php wp_nonce_field( 'bsol_refresh_payment_channels_action' ); ?>
				<button type="submit" name="bsol_refresh_payment_channels" class="button">
					<?php esc_html_e( 'Refresh now', 'bsol-connect' ); ?>
				</button>
				<p class="description"><?php esc_html_e( 'Clears the cached channel list (checkout page normally refreshes it every 15 minutes on its own) and the update-notice cache.', 'bsol-connect' ); ?></p>
			</form>
		</div>
		<?php
	}

	private function detect_checkout_type() {
		if ( ! function_exists( 'wc_get_page_id' ) ) {
			return __( 'unknown', 'bsol-connect' );
		}

		$checkout_page_id = wc_get_page_id( 'checkout' );
		$page              = $checkout_page_id > 0 ? get_post( $checkout_page_id ) : null;

		if ( ! $page ) {
			return __( 'unknown (no Checkout page set)', 'bsol-connect' );
		}

		if ( function_exists( 'has_block' ) && has_block( 'woocommerce/checkout', $page ) ) {
			return __( 'block-based Checkout', 'bsol-connect' );
		}

		if ( has_shortcode( (string) $page->post_content, 'woocommerce_checkout' ) ) {
			return __( 'classic (shortcode) Checkout', 'bsol-connect' );
		}

		return __( 'unrecognized', 'bsol-connect' );
	}

	private function handle_checkout_block_settings_save() {
		update_option( 'bsol_checkout_block_enabled', isset( $_POST['bsol_checkout_block_enabled'] ) ? '1' : '0' );

		$message = isset( $_POST['bsol_checkout_block_message'] ) ? sanitize_text_field( wp_unslash( $_POST['bsol_checkout_block_message'] ) ) : '';
		update_option( 'bsol_checkout_block_message', $message ?: Bsol_Checkout_Block::DEFAULT_MESSAGE );

		add_settings_error( 'bsol_messages', 'bsol_message', __( 'Checkout block settings saved.', 'bsol-connect' ), 'success' );
	}

	private function handle_disconnect_request() {
		// Best-effort — clear local options even if BSOL is briefly
		// unreachable, so this site never gets stuck "connected" locally.
		$api = new Bsol_Api();
		$api->disconnect();

		delete_option( 'bsol_api_key' );
		delete_option( 'bsol_domain' );
		delete_option( 'bsol_shop_name' );
		delete_option( 'bsol_connected_at' );
		delete_option( 'bsol_webhook_secret' );

		add_settings_error( 'bsol_messages', 'bsol_message', __( 'Disconnected.', 'bsol-connect' ), 'success' );
	}

	// ── Dashboard tab ────────────────────────────────────────────────────────

	private function render_dashboard_tab( $fraud_result, $balance_result = null ) {
		$shop_name     = get_option( 'bsol_shop_name', '' );
		$domain        = get_option( 'bsol_domain', '' );
		$connected_at  = get_option( 'bsol_connected_at', '' );
		?>
		<div class="bsol-stat-grid">
			<div class="bsol-stat-card">
				<span class="bsol-stat-label"><?php esc_html_e( 'Shop', 'bsol-connect' ); ?></span>
				<span class="bsol-stat-value"><?php echo esc_html( $shop_name ?: '—' ); ?></span>
			</div>
			<div class="bsol-stat-card">
				<span class="bsol-stat-label"><?php esc_html_e( 'Domain', 'bsol-connect' ); ?></span>
				<span class="bsol-stat-value"><?php echo esc_html( $domain ); ?></span>
			</div>
			<div class="bsol-stat-card">
				<span class="bsol-stat-label"><?php esc_html_e( 'Connected since', 'bsol-connect' ); ?></span>
				<span class="bsol-stat-value"><?php echo esc_html( $connected_at ?: '—' ); ?></span>
			</div>
		</div>

		<div class="bsol-section">
			<h3 class="bsol-section-title"><?php esc_html_e( 'Test Fraud Check', 'bsol-connect' ); ?></h3>
			<p class="description"><?php esc_html_e( 'Look up a phone number to confirm the connection is working — the same check runs automatically on your WooCommerce orders list.', 'bsol-connect' ); ?></p>
			<form method="post" action="?page=bsol_connect&tab=dashboard" class="bsol-inline-form">
				<?php wp_nonce_field( 'bsol_fraud_check_action' ); ?>
				<input type="text" name="bsol_fraud_phone" placeholder="01XXXXXXXXX" class="regular-text" />
				<button type="submit" name="bsol_check_fraud" class="button"><?php esc_html_e( 'Check', 'bsol-connect' ); ?></button>
			</form>

			<?php if ( $fraud_result ) : ?>
				<?php if ( ! empty( $fraud_result['success'] ) ) : ?>
					<?php $data = $fraud_result['data']; ?>
					<div class="bsol-result bsol-result-ok">
						<strong><?php esc_html_e( 'Risk level:', 'bsol-connect' ); ?></strong>
						<?php echo esc_html( ucfirst( $data['risk_level'] ) ); ?>
						(<?php echo esc_html( 'score ' . $data['fraud_score'] . '/100' ); ?>)
						<?php if ( ! empty( $data['is_blacklisted'] ) ) : ?>
							— <strong><?php esc_html_e( 'Blacklisted', 'bsol-connect' ); ?></strong>
						<?php endif; ?>
					</div>
				<?php else : ?>
					<div class="bsol-result bsol-result-error"><?php echo esc_html( $fraud_result['message'] ?? __( 'Check failed.', 'bsol-connect' ) ); ?></div>
				<?php endif; ?>
			<?php endif; ?>
		</div>

		<div class="bsol-section">
			<h3 class="bsol-section-title"><?php esc_html_e( 'Steadfast Balance', 'bsol-connect' ); ?></h3>
			<form method="post" action="?page=bsol_connect&tab=dashboard" class="bsol-inline-form">
				<?php wp_nonce_field( 'bsol_check_balance_action' ); ?>
				<button type="submit" name="bsol_check_balance" class="button"><?php esc_html_e( 'Check Balance', 'bsol-connect' ); ?></button>
			</form>

			<?php if ( $balance_result ) : ?>
				<?php if ( ! empty( $balance_result['success'] ) && isset( $balance_result['data']['current_balance'] ) ) : ?>
					<div class="bsol-result bsol-result-ok">
						<strong><?php esc_html_e( 'Balance:', 'bsol-connect' ); ?></strong>
						<?php echo esc_html( number_format( (float) $balance_result['data']['current_balance'], 2 ) ); ?> &#2547;
					</div>
				<?php else : ?>
					<div class="bsol-result bsol-result-error"><?php echo esc_html( $balance_result['message'] ?? __( 'Steadfast credentials are not configured on your BSOL dashboard.', 'bsol-connect' ) ); ?></div>
				<?php endif; ?>
			<?php endif; ?>
		</div>
		<?php
	}

	// ── Activity Log tab ─────────────────────────────────────────────────────

	private function render_activity_log_tab() {
		$entries = Bsol_Activity_Log::get_recent();
		?>
		<p class="description">
			<?php esc_html_e( 'The last 50 calls this site made to BSOL — use this to see why an order or product sync didn\'t go through.', 'bsol-connect' ); ?>
		</p>

		<?php if ( empty( $entries ) ) : ?>
			<p><?php esc_html_e( 'No activity yet.', 'bsol-connect' ); ?></p>
		<?php else : ?>
			<table class="widefat striped" style="margin-top:8px;">
				<thead>
					<tr>
						<th style="width:160px;"><?php esc_html_e( 'Time', 'bsol-connect' ); ?></th>
						<th style="width:160px;"><?php esc_html_e( 'Event', 'bsol-connect' ); ?></th>
						<th style="width:60px;"><?php esc_html_e( 'Status', 'bsol-connect' ); ?></th>
						<th><?php esc_html_e( 'Message', 'bsol-connect' ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( $entries as $entry ) : ?>
						<tr>
							<td><?php echo esc_html( $entry['time'] ); ?></td>
							<td><span class="bsol-log-type"><?php echo esc_html( $entry['type'] ); ?></span></td>
							<td>
								<?php if ( ! empty( $entry['success'] ) ) : ?>
									<span class="bsol-log-status-ok">&#10003;</span>
								<?php else : ?>
									<span class="bsol-log-status-fail">&#10007;</span>
								<?php endif; ?>
							</td>
							<td><?php echo esc_html( mb_strimwidth( (string) $entry['message'], 0, 120, '…' ) ); ?></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>

			<form method="post" action="?page=bsol_connect&tab=log" style="margin-top:12px;" onsubmit="return confirm('<?php echo esc_js( __( 'Clear the activity log?', 'bsol-connect' ) ); ?>');">
				<?php wp_nonce_field( 'bsol_clear_log_action' ); ?>
				<button type="submit" name="bsol_clear_log" class="button button-secondary">
					<?php esc_html_e( 'Clear Log', 'bsol-connect' ); ?>
				</button>
			</form>
		<?php endif; ?>
		<?php
	}

	// ── Sync Data tab ────────────────────────────────────────────────────────

	/**
	 * Plain markup only — the actual batching happens client-side
	 * (assets/js/bsol-admin.js) against the AJAX handlers in
	 * class-bsol-bulk-sync.php. For products/orders that already existed
	 * before this site connected — new ones already sync automatically.
	 */
	private function render_sync_data_tab() {
		?>
		<div class="bsol-section">
			<h3 class="bsol-section-title"><?php esc_html_e( 'Sync existing products', 'bsol-connect' ); ?></h3>
			<p class="description">
				<?php esc_html_e( 'Push every existing WooCommerce product into BSOL. New products already sync automatically as you save them — this is only for products that existed before connecting.', 'bsol-connect' ); ?>
			</p>
			<button type="button" class="button button-primary" id="bsol-bulk-sync-products-btn">
				<?php esc_html_e( 'Sync All Products', 'bsol-connect' ); ?>
			</button>
			<div class="bsol-bulk-sync-progress" id="bsol-bulk-sync-products-progress" style="display:none;">
				<div class="bsol-progress-bar-outer"><div class="bsol-progress-bar-inner"></div></div>
				<p class="bsol-progress-status"></p>
			</div>
		</div>

		<div class="bsol-section">
			<h3 class="bsol-section-title"><?php esc_html_e( 'Sync existing orders', 'bsol-connect' ); ?></h3>
			<p class="description">
				<?php esc_html_e( 'Push every existing WooCommerce order into BSOL, with its current status. Backfilled orders do not trigger a checkout-OTP SMS or a Facebook Purchase event.', 'bsol-connect' ); ?>
			</p>
			<button type="button" class="button button-primary" id="bsol-bulk-sync-orders-btn">
				<?php esc_html_e( 'Sync All Orders', 'bsol-connect' ); ?>
			</button>
			<div class="bsol-bulk-sync-progress" id="bsol-bulk-sync-orders-progress" style="display:none;">
				<div class="bsol-progress-bar-outer"><div class="bsol-progress-bar-inner"></div></div>
				<p class="bsol-progress-status"></p>
			</div>
		</div>
		<?php
	}

	private function handle_fraud_check_test() {
		$phone = isset( $_POST['bsol_fraud_phone'] ) ? sanitize_text_field( wp_unslash( $_POST['bsol_fraud_phone'] ) ) : '';
		$phone = Bsol_Helpers::clean_bd_phone_number( $phone );

		if ( ! $phone ) {
			return array(
				'success' => false,
				'message' => __( 'Enter a valid Bangladeshi phone number (01XXXXXXXXX).', 'bsol-connect' ),
			);
		}

		$api = new Bsol_Api();
		return $api->check_fraud( $phone );
	}
}
