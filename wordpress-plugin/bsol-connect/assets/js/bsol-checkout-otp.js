/**
 * Storefront-side handler for the checkout OTP gate rendered by
 * class-bsol-checkout-otp.php on the WooCommerce order-received page.
 * Only loaded on that one page (see maybe_enqueue_assets()).
 */
jQuery( function ( $ ) {
	var $gate = $( '.bsol-otp-gate' );
	if ( ! $gate.length ) {
		return;
	}

	var orderId = $gate.data( 'order-id' );
	var $message = $gate.find( '.bsol-otp-message' );
	var resendCooldownUntil = 0;

	function showMessage( text, isError ) {
		$message.text( text ).css( 'color', isError ? '#b32d2e' : '#1a7f37' );
	}

	$gate.find( '.bsol-otp-verify-btn' ).on( 'click', function () {
		var otp = $.trim( $gate.find( '.bsol-otp-input' ).val() );
		if ( ! otp ) {
			return;
		}

		var $btn = $( this ).prop( 'disabled', true );

		$.post( bsol_checkout_otp.ajax_url, {
			action: 'bsol_verify_otp',
			nonce: bsol_checkout_otp.nonce,
			order_id: orderId,
			otp_code: otp
		} ).done( function ( response ) {
			if ( response.success ) {
				$gate.fadeOut();
			} else {
				var data = response.data || {};
				showMessage( data.message || 'Verification failed.', true );
			}
		} ).fail( function () {
			showMessage( bsol_checkout_otp.i18n.network_error, true );
		} ).always( function () {
			$btn.prop( 'disabled', false );
		} );
	} );

	$gate.find( '.bsol-otp-resend-btn' ).on( 'click', function () {
		if ( Date.now() < resendCooldownUntil ) {
			return;
		}

		var $btn = $( this ).prop( 'disabled', true );

		$.post( bsol_checkout_otp.ajax_url, {
			action: 'bsol_resend_otp',
			nonce: bsol_checkout_otp.nonce,
			order_id: orderId
		} ).done( function ( response ) {
			if ( response.success ) {
				showMessage( bsol_checkout_otp.i18n.resent, false );
				resendCooldownUntil = Date.now() + 60000;
			} else {
				var data = response.data || {};
				showMessage( data.message || 'Could not resend the code.', true );
				if ( data.retry_after_seconds ) {
					resendCooldownUntil = Date.now() + ( data.retry_after_seconds * 1000 );
				}
			}
		} ).fail( function () {
			showMessage( bsol_checkout_otp.i18n.network_error, true );
		} ).always( function () {
			$btn.prop( 'disabled', false );
		} );
	} );
} );
