jQuery( function ( $ ) {
	'use strict';

	if ( typeof bsol_ajax === 'undefined' ) {
		return;
	}

	$( '.bsol-health-bar[data-order-id]' ).each( function () {
		var $bar = $( this );
		var orderId = $bar.data( 'order-id' );

		$.post( bsol_ajax.ajax_url, {
			action: 'bsol_get_health',
			nonce: bsol_ajax.nonce,
			order_id: orderId
		} ).done( function ( response ) {
			if ( ! response || ! response.success ) {
				$bar.addClass( 'bsol-health-error' );
				$bar.find( '.bsol-health-text' ).text(
					( response && response.data && response.data.message ) || '—'
				);
				return;
			}

			var data = response.data;
			$bar.addClass( 'bsol-health-' + data.risk_level );
			var label = data.fraud_score + '/100';
			if ( data.is_blacklisted ) {
				label += ' ⛔';
			}
			$bar.find( '.bsol-health-text' ).text( label );
		} ).fail( function () {
			$bar.addClass( 'bsol-health-error' );
			$bar.find( '.bsol-health-text' ).text( '—' );
		} );
	} );

	// ── Courier book / track / cancel (event-delegated — the column re-renders
	// its own HTML on each action, so buttons are bound to the list body, not
	// individual elements). ──────────────────────────────────────────────────
	if ( ! bsol_ajax.courier_nonce ) {
		return;
	}

	function bsolCourierColumn( $btn ) {
		return $btn.closest( '.bsol-courier-column' );
	}

	function bsolCourierOrderId( $btn ) {
		return bsolCourierColumn( $btn ).data( 'order-id' );
	}

	$( document ).on( 'click', '.bsol-courier-book-btn', function ( e ) {
		e.preventDefault();
		var $btn = $( this );
		var $column = bsolCourierColumn( $btn );
		$column.find( 'button' ).prop( 'disabled', true );

		$.post( bsol_ajax.ajax_url, {
			action: 'bsol_courier_book',
			nonce: bsol_ajax.courier_nonce,
			order_id: bsolCourierOrderId( $btn ),
			courier: $btn.data( 'courier' )
		} ).done( function ( response ) {
			if ( response && response.success ) {
				var data = response.data || {};
				$column.html(
					'<div class="bsol-consignment-info"><strong>' +
					String( $btn.data( 'courier' ) ).toUpperCase() +
					':</strong> ' + ( data.consignment_id || '' ) + '</div>'
				);
			} else {
				window.alert( ( response && response.data && response.data.message ) || 'Booking failed.' );
				$column.find( 'button' ).prop( 'disabled', false );
			}
		} ).fail( function () {
			window.alert( 'Booking failed — please try again.' );
			$column.find( 'button' ).prop( 'disabled', false );
		} );
	} );

	$( document ).on( 'click', '.bsol-courier-track-btn', function ( e ) {
		e.preventDefault();
		var $btn = $( this );
		var $status = bsolCourierColumn( $btn ).find( '.bsol-courier-status' );
		$status.text( '…' );

		$.post( bsol_ajax.ajax_url, {
			action: 'bsol_courier_track',
			nonce: bsol_ajax.courier_nonce,
			order_id: bsolCourierOrderId( $btn )
		} ).done( function ( response ) {
			if ( response && response.success && response.data && response.data.status ) {
				$status.text(
					response.data.status.charAt( 0 ).toUpperCase() + response.data.status.slice( 1 )
				);
			} else {
				$status.text( '—' );
			}
		} ).fail( function () {
			$status.text( '—' );
		} );
	} );

	$( document ).on( 'click', '.bsol-courier-cancel-btn', function ( e ) {
		e.preventDefault();
		if ( ! window.confirm( 'Cancel this courier booking?' ) ) {
			return;
		}
		var $btn = $( this );
		var $status = bsolCourierColumn( $btn ).find( '.bsol-courier-status' );

		$.post( bsol_ajax.ajax_url, {
			action: 'bsol_courier_cancel',
			nonce: bsol_ajax.courier_nonce,
			order_id: bsolCourierOrderId( $btn )
		} ).done( function ( response ) {
			if ( response && response.success ) {
				$status.text( 'Cancelled' );
			} else {
				window.alert( ( response && response.data && response.data.message ) || 'This courier does not support cancellation via API.' );
			}
		} ).fail( function () {
			window.alert( 'Cancellation failed — please try again.' );
		} );
	} );
} );

// ── Bulk/historical sync (Sync Data tab) ────────────────────────────────────
// Separate top-level block, not folded into the one above — that one exits
// early when `bsol_ajax` isn't localized (only true on the WooCommerce
// orders screen), but this runs on the plugin's own settings page, which
// localizes its own `bsol_bulk_sync` object instead (class-bsol-bulk-sync.php).
jQuery( function ( $ ) {
	'use strict';

	if ( typeof bsol_bulk_sync === 'undefined' ) {
		return;
	}

	var BATCH_DELAY_MS = 1000; // paces batches under the /connect/v1 throttle.

	function runBulkSync( action, $button, $progress ) {
		var $bar = $progress.find( '.bsol-progress-bar-inner' );
		var $status = $progress.find( '.bsol-progress-status' );
		var page = 1;
		var totalProcessed = 0;

		$button.prop( 'disabled', true );
		$progress.show();
		$bar.css( 'width', '0%' );
		$status.text( '…' );

		function nextBatch() {
			$.post( bsol_bulk_sync.ajax_url, {
				action: action,
				nonce: bsol_bulk_sync.nonce,
				page: page
			} ).done( function ( response ) {
				if ( ! response || ! response.success ) {
					$status.text( ( response && response.data && response.data.message ) || 'Sync failed.' );
					$button.prop( 'disabled', false );
					return;
				}

				var data = response.data;
				totalProcessed += data.processed;
				var pct = data.total > 0 ? Math.round( ( totalProcessed / data.total ) * 100 ) : 100;
				$bar.css( 'width', pct + '%' );
				$status.text( totalProcessed + ' / ' + data.total );

				if ( data.done ) {
					$status.text( 'Done — ' + totalProcessed + ' synced.' );
					$button.prop( 'disabled', false );
					return;
				}

				page++;
				setTimeout( nextBatch, BATCH_DELAY_MS );
			} ).fail( function () {
				$status.text( 'Network error — stopped at ' + totalProcessed + ' synced.' );
				$button.prop( 'disabled', false );
			} );
		}

		nextBatch();
	}

	$( '#bsol-bulk-sync-products-btn' ).on( 'click', function () {
		runBulkSync( 'bsol_bulk_sync_products', $( this ), $( '#bsol-bulk-sync-products-progress' ) );
	} );

	$( '#bsol-bulk-sync-orders-btn' ).on( 'click', function () {
		runBulkSync( 'bsol_bulk_sync_orders', $( this ), $( '#bsol-bulk-sync-orders-progress' ) );
	} );
} );
