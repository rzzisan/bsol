/**
 * Storefront-side handler for the wallet-claim mini-form rendered by
 * class-bsol-payment-gateway.php on the WooCommerce order-received page.
 * Only loaded on that one page (see maybe_enqueue_assets()).
 */
jQuery( function ( $ ) {
	var $form = $( '.bsol-wallet-claim' );
	if ( ! $form.length ) {
		return;
	}

	var orderId = $form.data( 'order-id' );
	var provider = $form.data( 'provider' );
	var $message = $form.find( '.bsol-wallet-claim-message' );

	function showMessage( text, isError ) {
		$message.text( text ).css( 'color', isError ? '#b32d2e' : '#1a7f37' );
	}

	$form.find( '.bsol-wallet-claim-submit' ).on( 'click', function () {
		var sender = $.trim( $form.find( '.bsol-wallet-claim-sender' ).val() );
		var trxId = $.trim( $form.find( '.bsol-wallet-claim-trxid' ).val() );

		if ( ! sender || ! trxId ) {
			showMessage( bsol_payment_gateway.i18n.missing_fields, true );
			return;
		}

		var $btn = $( this ).prop( 'disabled', true );

		$.post( bsol_payment_gateway.ajax_url, {
			action: 'bsol_wallet_claim',
			nonce: bsol_payment_gateway.nonce,
			order_id: orderId,
			provider: provider,
			sender_number: sender,
			customer_trx_id: trxId
		} ).done( function ( response ) {
			if ( response.success ) {
				showMessage( bsol_payment_gateway.i18n.submitted, false );
				$form.find( '.bsol-wallet-claim-submit, .bsol-wallet-claim-sender, .bsol-wallet-claim-trxid' ).prop( 'disabled', true );
			} else {
				var data = response.data || {};
				showMessage( data.message || 'Submission failed.', true );
				$btn.prop( 'disabled', false );
			}
		} ).fail( function () {
			showMessage( bsol_payment_gateway.i18n.network_error, true );
			$btn.prop( 'disabled', false );
		} );
	} );
} );
