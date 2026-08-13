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
			<h1><?php esc_html_e( 'BSOL Connect', 'bsol-connect' ); ?></h1>
			<?php settings_errors( 'bsol_messages' ); ?>

			<?php if ( $is_connected ) : ?>
				<h2 class="nav-tab-wrapper">
					<a href="?page=bsol_connect&tab=dashboard" class="nav-tab <?php echo 'dashboard' === $active_tab ? 'nav-tab-active' : ''; ?>">
						<?php esc_html_e( 'Dashboard', 'bsol-connect' ); ?>
					</a>
					<a href="?page=bsol_connect&tab=log" class="nav-tab <?php echo 'log' === $active_tab ? 'nav-tab-active' : ''; ?>">
						<?php esc_html_e( 'Activity Log', 'bsol-connect' ); ?>
					</a>
					<a href="?page=bsol_connect&tab=settings" class="nav-tab <?php echo 'settings' === $active_tab ? 'nav-tab-active' : ''; ?>">
						<?php esc_html_e( 'Settings', 'bsol-connect' ); ?>
					</a>
				</h2>
			<?php endif; ?>

			<div class="bsol-card" style="margin-top:16px;max-width:<?php echo 'log' === $active_tab ? '900px' : '640px'; ?>;">
				<?php
				if ( ! $is_connected || 'settings' === $active_tab ) {
					$this->render_settings_tab();
				} elseif ( 'log' === $active_tab ) {
					$this->render_activity_log_tab();
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
			<p><strong><?php esc_html_e( 'Status:', 'bsol-connect' ); ?></strong>
				<span style="color:#1a7f37;"><?php esc_html_e( 'Connected', 'bsol-connect' ); ?></span>
				<?php echo esc_html( ' — ' . $domain ); ?>
			</p>
			<p><?php esc_html_e( 'This site is syncing orders and fraud checks with BSOL.', 'bsol-connect' ); ?></p>
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
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><?php esc_html_e( 'Shop', 'bsol-connect' ); ?></th>
				<td><?php echo esc_html( $shop_name ?: '—' ); ?></td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Domain', 'bsol-connect' ); ?></th>
				<td><?php echo esc_html( $domain ); ?></td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Connected since', 'bsol-connect' ); ?></th>
				<td><?php echo esc_html( $connected_at ?: '—' ); ?></td>
			</tr>
		</table>

		<hr />

		<h3><?php esc_html_e( 'Test Fraud Check', 'bsol-connect' ); ?></h3>
		<p class="description"><?php esc_html_e( 'Look up a phone number to confirm the connection is working — the same check runs automatically on your WooCommerce orders list.', 'bsol-connect' ); ?></p>
		<form method="post" action="?page=bsol_connect&tab=dashboard">
			<?php wp_nonce_field( 'bsol_fraud_check_action' ); ?>
			<input type="text" name="bsol_fraud_phone" placeholder="01XXXXXXXXX" class="regular-text" />
			<button type="submit" name="bsol_check_fraud" class="button"><?php esc_html_e( 'Check', 'bsol-connect' ); ?></button>
		</form>

		<?php if ( $fraud_result ) : ?>
			<?php if ( ! empty( $fraud_result['success'] ) ) : ?>
				<?php $data = $fraud_result['data']; ?>
				<p style="margin-top:12px;">
					<strong><?php esc_html_e( 'Risk level:', 'bsol-connect' ); ?></strong>
					<?php echo esc_html( ucfirst( $data['risk_level'] ) ); ?>
					(<?php echo esc_html( 'score ' . $data['fraud_score'] . '/100' ); ?>)
					<?php if ( ! empty( $data['is_blacklisted'] ) ) : ?>
						— <span style="color:#b32d2e;"><?php esc_html_e( 'Blacklisted', 'bsol-connect' ); ?></span>
					<?php endif; ?>
				</p>
			<?php else : ?>
				<p style="margin-top:12px;color:#b32d2e;"><?php echo esc_html( $fraud_result['message'] ?? __( 'Check failed.', 'bsol-connect' ) ); ?></p>
			<?php endif; ?>
		<?php endif; ?>

		<hr />

		<h3><?php esc_html_e( 'Steadfast Balance', 'bsol-connect' ); ?></h3>
		<form method="post" action="?page=bsol_connect&tab=dashboard">
			<?php wp_nonce_field( 'bsol_check_balance_action' ); ?>
			<button type="submit" name="bsol_check_balance" class="button"><?php esc_html_e( 'Check Balance', 'bsol-connect' ); ?></button>
		</form>

		<?php if ( $balance_result ) : ?>
			<?php if ( ! empty( $balance_result['success'] ) && isset( $balance_result['data']['current_balance'] ) ) : ?>
				<p style="margin-top:12px;"><strong><?php esc_html_e( 'Balance:', 'bsol-connect' ); ?></strong>
					<?php echo esc_html( number_format( (float) $balance_result['data']['current_balance'], 2 ) ); ?> &#2547;
				</p>
			<?php else : ?>
				<p style="margin-top:12px;color:#b32d2e;"><?php echo esc_html( $balance_result['message'] ?? __( 'Steadfast credentials are not configured on your BSOL dashboard.', 'bsol-connect' ) ); ?></p>
			<?php endif; ?>
		<?php endif; ?>
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
							<td><?php echo esc_html( $entry['type'] ); ?></td>
							<td>
								<?php if ( ! empty( $entry['success'] ) ) : ?>
									<span style="color:#1a7f37;">&#10003;</span>
								<?php else : ?>
									<span style="color:#b32d2e;">&#10007;</span>
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
