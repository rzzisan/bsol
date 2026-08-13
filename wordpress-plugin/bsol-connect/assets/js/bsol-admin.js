jQuery( function ( $ ) {
	'use strict';

	if ( typeof bsol_ajax === 'undefined' ) {
		return;
	}

	// ── Customer Health: delivered-vs-not progress bar + click-for-details ──

	var BSOL_COURIER_COLORS = {
		pathao: '#dc2626',
		steadfast: '#0d9488',
		redx: '#be123c',
		carrybee: '#f59e0b',
		paperfly: '#2563eb'
	};
	var BSOL_COURIER_LABELS = {
		pathao: 'Pathao',
		steadfast: 'Steadfast',
		redx: 'RedX',
		carrybee: 'CarryBee',
		paperfly: 'Paperfly'
	};

	function bsolHumanize( slug ) {
		return String( slug ).replace( /_/g, ' ' ).replace( /\b\w/g, function ( c ) {
			return c.toUpperCase();
		} );
	}

	function bsolHealthCourierValue( card ) {
		if ( 'not_configured' === card.status ) {
			return { text: 'Not set up', muted: true };
		}
		if ( 'error' === card.status ) {
			return { text: 'Check failed', muted: true };
		}
		if ( 'rating' === card.data_type && card.rating ) {
			return { text: bsolHumanize( card.rating ), muted: false };
		}
		if ( 0 === card.total ) {
			return { text: 'No history', muted: true };
		}
		return { text: card.success + '/' + card.total + ' (' + card.success_rate + '%)', muted: false };
	}

	function bsolRenderHealthBar( $bar, data ) {
		var overall = data.overall || { total: 0, success: 0, success_rate: 0 };
		var pct = Math.round( overall.success_rate || 0 );
		var html;

		if ( overall.total > 0 ) {
			html = '<div class="bsol-health-progress">' +
				'<div class="bsol-health-track"><div class="bsol-health-fill" style="width:' + pct + '%"></div></div>' +
				'<span class="bsol-health-pct">' + pct + '%</span>' +
			'</div>';
		} else {
			html = '<div class="bsol-health-progress bsol-health-progress-empty">' +
				'<div class="bsol-health-track"></div>' +
				'<span class="bsol-health-pct">No data</span>' +
			'</div>';
		}

		$bar.html( html );
		$bar.data( 'health', data );
	}

	function bsolRenderHealthPopover( data ) {
		var overall = data.overall || { total: 0, success: 0, success_rate: 0 };
		var rows = ( data.couriers || [] ).map( function ( card ) {
			var val = bsolHealthCourierValue( card );
			var color = BSOL_COURIER_COLORS[ card.name ] || '#8c8f94';
			var label = BSOL_COURIER_LABELS[ card.name ] || card.name;
			return '<div class="bsol-health-row">' +
				'<span class="bsol-health-dot" style="background:' + color + '"></span>' +
				'<span class="bsol-health-row-name">' + label + '</span>' +
				'<span class="bsol-health-row-val' + ( val.muted ? ' is-muted' : '' ) + '">' + val.text + '</span>' +
			'</div>';
		} ).join( '' );

		var summary = overall.total > 0
			? '<strong>' + overall.success + '/' + overall.total + '</strong> parcels delivered across all couriers'
			: 'No delivery history found for this number yet';

		return '<div class="bsol-health-popover">' +
			'<div class="bsol-health-popover-summary">' + summary + '</div>' +
			rows +
		'</div>';
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
				$bar.find( '.bsol-health-loading' ).text(
					( response && response.data && response.data.message ) || '—'
				);
				return;
			}
			bsolRenderHealthBar( $bar, response.data );
		} ).fail( function () {
			$bar.find( '.bsol-health-loading' ).text( '—' );
		} );
	} );

	$( document ).on( 'click', '.bsol-health-bar', function ( e ) {
		var $bar = $( this );
		var data = $bar.data( 'health' );
		if ( ! data ) {
			return; // still loading, or the check failed — nothing to show
		}
		e.preventDefault();
		e.stopPropagation();

		var wasOpen = $bar.hasClass( 'is-open' );
		$( '.bsol-health-bar.is-open' ).removeClass( 'is-open' ).find( '.bsol-health-popover' ).remove();

		if ( ! wasOpen ) {
			$bar.addClass( 'is-open' ).append( bsolRenderHealthPopover( data ) );
		}
	} );

	$( document ).on( 'click', function ( e ) {
		if ( ! $( e.target ).closest( '.bsol-health-bar' ).length ) {
			$( '.bsol-health-bar.is-open' ).removeClass( 'is-open' ).find( '.bsol-health-popover' ).remove();
		}
	} );

	$( document ).on( 'keyup', function ( e ) {
		if ( 'Escape' === e.key ) {
			$( '.bsol-health-bar.is-open' ).removeClass( 'is-open' ).find( '.bsol-health-popover' ).remove();
		}
	} );

	// ── Courier book / track / cancel (event-delegated — the column re-renders
	// its own HTML on each action, so buttons are bound to the list body, not
	// individual elements). ──────────────────────────────────────────────────
	if ( ! bsol_ajax.courier_nonce ) {
		return;
	}

	function bsolCourierColumn( $el ) {
		return $el.closest( '.bsol-courier-column' );
	}

	function bsolCourierOrderId( $el ) {
		return bsolCourierColumn( $el ).data( 'order-id' );
	}

	function bsolSetStatusBadge( $badge, slug, label ) {
		$badge.attr( 'class', 'bsol-status-badge bsol-courier-status bsol-status-' + slug );
		$badge.text( label );
	}

	// ── "Book to Courier" dropdown (one toggle button, not 5 separate ones) ──

	function bsolCloseCourierDropdowns( $except ) {
		var $open = $( '.bsol-courier-picker.is-open' );
		if ( $except && $except.length ) {
			$open = $open.not( $except );
		}
		$open.removeClass( 'is-open' ).find( '.bsol-courier-dropdown' ).attr( 'hidden', true );
	}

	$( document ).on( 'click', '.bsol-courier-book-toggle', function ( e ) {
		e.preventDefault();
		e.stopPropagation();
		var $picker = $( this ).closest( '.bsol-courier-picker' );
		if ( $picker.hasClass( 'is-booking' ) ) {
			return;
		}
		var willOpen = ! $picker.hasClass( 'is-open' );
		bsolCloseCourierDropdowns();
		if ( willOpen ) {
			$picker.addClass( 'is-open' ).find( '.bsol-courier-dropdown' ).attr( 'hidden', false );
		}
	} );

	$( document ).on( 'click', function ( e ) {
		if ( ! $( e.target ).closest( '.bsol-courier-picker' ).length ) {
			bsolCloseCourierDropdowns();
		}
	} );

	$( document ).on( 'keyup', function ( e ) {
		if ( 'Escape' === e.key ) {
			bsolCloseCourierDropdowns();
		}
	} );

	$( document ).on( 'click', '.bsol-courier-option', function ( e ) {
		e.preventDefault();
		var $option = $( this );
		var $picker = $option.closest( '.bsol-courier-picker' );
		var $column = bsolCourierColumn( $option );

		bsolCloseCourierDropdowns();
		$picker.addClass( 'is-booking' );

		$.post( bsol_ajax.ajax_url, {
			action: 'bsol_courier_book',
			nonce: bsol_ajax.courier_nonce,
			order_id: bsolCourierOrderId( $option ),
			courier: $option.data( 'courier' )
		} ).done( function ( response ) {
			if ( response && response.success && response.data && response.data.html ) {
				$column.html( response.data.html );
			} else {
				window.alert( ( response && response.data && response.data.message ) || 'Booking failed.' );
				$picker.removeClass( 'is-booking' );
			}
		} ).fail( function () {
			window.alert( 'Booking failed — please try again.' );
			$picker.removeClass( 'is-booking' );
		} );
	} );

	// ── Already-booked state: refresh / cancel ───────────────────────────────

	$( document ).on( 'click', '.bsol-courier-track-btn', function ( e ) {
		e.preventDefault();
		var $btn = $( this );
		var $badge = bsolCourierColumn( $btn ).find( '.bsol-courier-status' );
		$badge.text( '…' );

		$.post( bsol_ajax.ajax_url, {
			action: 'bsol_courier_track',
			nonce: bsol_ajax.courier_nonce,
			order_id: bsolCourierOrderId( $btn )
		} ).done( function ( response ) {
			if ( response && response.success && response.data && response.data.status ) {
				var status = response.data.status;
				bsolSetStatusBadge( $badge, status, status.charAt( 0 ).toUpperCase() + status.slice( 1 ) );
			} else {
				bsolSetStatusBadge( $badge, 'pending', '—' );
			}
		} ).fail( function () {
			bsolSetStatusBadge( $badge, 'pending', '—' );
		} );
	} );

	$( document ).on( 'click', '.bsol-courier-cancel-btn', function ( e ) {
		e.preventDefault();
		if ( ! window.confirm( 'Cancel this courier booking?' ) ) {
			return;
		}
		var $btn = $( this );
		var $badge = bsolCourierColumn( $btn ).find( '.bsol-courier-status' );

		$.post( bsol_ajax.ajax_url, {
			action: 'bsol_courier_cancel',
			nonce: bsol_ajax.courier_nonce,
			order_id: bsolCourierOrderId( $btn )
		} ).done( function ( response ) {
			if ( response && response.success ) {
				bsolSetStatusBadge( $badge, 'cancelled', 'Cancelled' );
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
