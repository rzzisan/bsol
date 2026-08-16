<?php
/**
 * Meta Pixel base code + funnel event capture for a connected WooCommerce
 * storefront (T4, tracking_capi_context.md §7) — the WooCommerce
 * counterpart of the Next.js landing page's useBsolTracking() (T6).
 *
 * Order-flow events (Confirmed/Shipped/Delivered/Returned/Canceled) are
 * deliberately NOT sent from here — BSOL is their authoritative source
 * (OrderStatusService::transition(), T5); WooCommerce's own status lags
 * the real courier outcome BSOL already knows. Purchase likewise already
 * fires server-side at sync time (ConnectOrderController, T2's dispatch);
 * the browser-side copy fired by bsol-tracking.js on the order-received
 * page is purely for fbp/fbc match-quality enrichment and the client-side
 * Pixel script itself — BSOL's own dedup
 * (tracking_events.unique(user_id,event_name,event_id)) makes the repeat
 * order_{id} submission a free no-op, never a double count.
 *
 * Every event is relayed through admin-ajax.php, not a direct
 * browser->BSOL call — same trust model as every other module (the API
 * key never reaches the browser), and same-origin from the browser's own
 * point of view either way, so nothing is lost against ad blockers/Safari
 * ITP (§3.1's same-origin reasoning holds just as well here).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bsol_Tracking {

	const CONFIG_TRANSIENT = 'bsol_tracking_config';
	const CONFIG_CACHE_TTL = 1 * HOUR_IN_SECONDS;
	const CONFIG_MISS_TTL  = 5 * MINUTE_IN_SECONDS;
	const META_ORDER_ID    = '_bsol_order_id'; // written by class-bsol-order-sync.php

	public function __construct() {
		add_action( 'wp_head', array( $this, 'maybe_render_pixel_base_code' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_action( 'wp_ajax_bsol_track_event', array( $this, 'ajax_track' ) );
		add_action( 'wp_ajax_nopriv_bsol_track_event', array( $this, 'ajax_track' ) );
	}

	/** Cached read — wp_head/wp_enqueue_scripts run on every single page load, a live call each time would be one more remote round-trip per visitor. */
	private function get_config() {
		$cached = get_transient( self::CONFIG_TRANSIENT );
		if ( false !== $cached ) {
			return $cached;
		}

		$response = ( new Bsol_Api() )->get_tracking_config();
		$data     = ( ! empty( $response['success'] ) && is_array( $response['data'] ?? null ) )
			? $response['data']
			: array(
				'enabled'  => false,
				'pixel_id' => null,
			);

		// A miss (BSOL unreachable, or genuinely not configured) is cached
		// too but for much less time — long enough that a temporarily-down
		// BSOL doesn't mean a remote call on every page load, short enough
		// that a seller who just added a Pixel sees it live again quickly.
		set_transient( self::CONFIG_TRANSIENT, $data, empty( $data['enabled'] ) ? self::CONFIG_MISS_TTL : self::CONFIG_CACHE_TTL );

		return $data;
	}

	public function maybe_render_pixel_base_code() {
		$config = $this->get_config();
		if ( empty( $config['enabled'] ) || empty( $config['pixel_id'] ) ) {
			return;
		}
		?>
		<!-- BSOL Connect: Meta Pixel -->
		<script>
		!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
		n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
		n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
		t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
		document,'script','https://connect.facebook.net/en_US/fbevents.js');
		fbq('init', '<?php echo esc_js( $config['pixel_id'] ); ?>');
		</script>
		<?php
		// No fbq('track', 'PageView') here — bsol-tracking.js sends it with
		// an eventID once the page has fully identified itself, so it can
		// dedupe against the server-side copy (§3.2).
	}

	public function enqueue_assets() {
		$config = $this->get_config();
		if ( empty( $config['enabled'] ) ) {
			return;
		}

		wp_enqueue_script( 'bsol-tracking', BSOL_PLUGIN_URL . 'assets/js/bsol-tracking.js', array( 'jquery' ), BSOL_PLUGIN_VERSION, true );

		$context = array(
			'ajax_url'     => admin_url( 'admin-ajax.php' ),
			'nonce'        => wp_create_nonce( 'bsol_track_event_nonce' ),
			'do_not_track' => $this->visitor_sent_dnt(),
			'page_type'    => $this->current_page_type(),
			'currency'     => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'BDT',
		);

		if ( function_exists( 'is_product' ) && is_product() ) {
			global $product;
			if ( $product instanceof WC_Product ) {
				$context['product'] = array(
					'id'    => $product->get_id(),
					'price' => (float) $product->get_price(),
				);
			}
		}

		if ( function_exists( 'is_order_received_page' ) && is_order_received_page() ) {
			$order_id = absint( get_query_var( 'order-received' ) );
			$order    = $order_id ? wc_get_order( $order_id ) : null;
			$bsol_id  = $order ? $order->get_meta( self::META_ORDER_ID ) : null;

			if ( $order && $bsol_id ) {
				$context['purchase'] = array(
					'bsol_order_id' => (int) $bsol_id,
					'value'         => (float) $order->get_total(),
					'currency'      => $order->get_currency(),
				);
			}
		}

		wp_localize_script( 'bsol-tracking', 'bsol_tracking', $context );
	}

	private function current_page_type() {
		if ( function_exists( 'is_order_received_page' ) && is_order_received_page() ) {
			return 'order-received';
		}
		if ( function_exists( 'is_checkout' ) && is_checkout() ) {
			return 'checkout';
		}
		if ( function_exists( 'is_product' ) && is_product() ) {
			return 'product';
		}
		return 'other';
	}

	/** DNT: 1 is always honoured (§7 item 7) — the JS reads this and sends nothing at all when true. */
	private function visitor_sent_dnt() {
		return isset( $_SERVER['HTTP_DNT'] ) && '1' === $_SERVER['HTTP_DNT'];
	}

	/**
	 * Relays a batch of events the browser already built (event_name/id,
	 * custom_data) — this only adds what the browser can't supply itself:
	 * the real client IP/UA and the fbp/fbc cookies, which are first-party
	 * on this exact WooCommerce domain and unreadable from anywhere else.
	 *
	 * No current_user_can() gate — a storefront visitor is normally
	 * anonymous; the nonce is the only credential, same as every other
	 * storefront AJAX handler in this plugin (Bsol_Checkout_Otp,
	 * Bsol_Abandoned_Checkout).
	 */
	public function ajax_track() {
		check_ajax_referer( 'bsol_track_event_nonce', 'nonce' );

		$raw    = isset( $_POST['events'] ) ? wp_unslash( $_POST['events'] ) : '';
		$events = json_decode( is_string( $raw ) ? $raw : '', true );

		if ( ! is_array( $events ) || empty( $events ) ) {
			wp_send_json_error( array( 'message' => 'No events.' ) );
		}

		$fbp = isset( $_COOKIE['_fbp'] ) ? sanitize_text_field( wp_unslash( $_COOKIE['_fbp'] ) ) : null;
		$fbc = isset( $_COOKIE['_fbc'] ) ? sanitize_text_field( wp_unslash( $_COOKIE['_fbc'] ) ) : null;
		$ip  = Bsol_Helpers::client_ip();
		$ua  = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : null;

		$enriched = array();
		foreach ( array_slice( $events, 0, 50 ) as $event ) {
			if ( empty( $event['event_name'] ) || empty( $event['event_id'] ) ) {
				continue;
			}

			$user_data = is_array( $event['user_data'] ?? null ) ? $event['user_data'] : array();
			// The browser's own copy wins if it already resolved an _fbc
			// (e.g. via fbclid on this exact page load); the cookie is the
			// fallback, not the override.
			$user_data['fbc']               = ! empty( $user_data['fbc'] ) ? $user_data['fbc'] : $fbc;
			$user_data['fbp']               = $fbp;
			$user_data['client_ip_address'] = $ip;
			$user_data['client_user_agent'] = $ua;

			$enriched[] = array(
				'event_name'       => sanitize_text_field( $event['event_name'] ),
				'event_id'         => sanitize_text_field( $event['event_id'] ),
				'event_source_url' => ! empty( $event['event_source_url'] ) ? esc_url_raw( $event['event_source_url'] ) : null,
				'custom_data'      => is_array( $event['custom_data'] ?? null ) ? $event['custom_data'] : null,
				'user_data'        => array_filter(
					$user_data,
					function ( $value ) {
						return null !== $value && '' !== $value;
					}
				),
			);
		}

		if ( empty( $enriched ) ) {
			wp_send_json_error( array( 'message' => 'No valid events.' ) );
		}

		( new Bsol_Api() )->send_tracking_events( $enriched );

		wp_send_json_success();
	}
}
