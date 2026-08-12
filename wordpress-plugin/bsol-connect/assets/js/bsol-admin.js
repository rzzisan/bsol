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
} );
