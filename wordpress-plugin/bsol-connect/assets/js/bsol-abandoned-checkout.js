/**
 * Checkout-in-progress capture (Phase 17). Trigger shape proven by the
 * legacy zayroo-connect plugin's zayroo-iot-checkout.js — sessionStorage
 * session key, 1.5s-debounced save on any checkout field
 * input/change/blur + WooCommerce's own `updated_checkout` event + cart
 * qty/remove clicks. Unlike that version, product data is NOT scraped from
 * the rendered checkout DOM (fragile, theme-dependent selectors) — the
 * PHP AJAX handler reads WC()->cart directly instead, so this file only
 * ever sends the customer-entered field values.
 */
jQuery( function ( $ ) {
	'use strict';

	if ( typeof bsol_abandoned_checkout === 'undefined' ) {
		return;
	}

	function getSessionToken() {
		try {
			var key = sessionStorage.getItem( 'bsol_iot_session_key' );
			if ( ! key ) {
				key = 'bsol_' + Date.now() + '_' + Math.floor( Math.random() * 1000000 );
				sessionStorage.setItem( 'bsol_iot_session_key', key );
			}
			return key;
		} catch ( e ) {
			return 'bsol_' + Date.now() + '_' + Math.floor( Math.random() * 1000000 );
		}
	}

	function collectFields() {
		var $email = $( "input[name='billing_email'], input#billing_email, input[type='email']" ).first();
		var firstName = $( "input[name='billing_first_name'], input#billing_first_name" ).first().val() || '';
		var lastName = $( "input[name='billing_last_name'], input#billing_last_name" ).first().val() || '';
		var $phone = $( "input[name='billing_phone'], input#billing_phone, input[type='tel']" ).first();
		var addr1 = $( "input[name='billing_address_1']" ).first().val() || '';
		var city = $( "input[name='billing_city']" ).first().val() || '';

		return {
			session_token: getSessionToken(),
			name: ( firstName + ' ' + lastName ).trim(),
			phone: $phone.length ? String( $phone.val() || '' ).trim() : '',
			email: $email.length ? String( $email.val() || '' ).trim() : '',
			address: ( addr1 + ' ' + city ).trim()
		};
	}

	var currentXhr = null;

	function sendData() {
		if ( currentXhr && currentXhr.readyState !== 4 ) {
			currentXhr.abort();
		}

		var data = collectFields();
		if ( ! data.name && ! data.phone && ! data.email ) {
			return; // nothing identifying yet — not worth a request
		}

		currentXhr = $.post( bsol_abandoned_checkout.ajax_url, {
			action: 'bsol_save_abandoned_checkout',
			nonce: bsol_abandoned_checkout.nonce,
			session_token: data.session_token,
			name: data.name,
			phone: data.phone,
			email: data.email,
			address: data.address
		} ).always( function () {
			currentXhr = null;
		} );
	}

	var debounceTimer = null;
	function debouncedSend() {
		if ( debounceTimer ) {
			clearTimeout( debounceTimer );
		}
		debounceTimer = setTimeout( sendData, 1500 );
	}

	setTimeout( debouncedSend, 2000 );

	$( document ).on( 'input change blur', 'form.checkout input, form.checkout textarea, form.checkout select', debouncedSend );
	$( document.body ).on( 'updated_checkout', debouncedSend );
	$( document ).on( 'click', '.quantity .plus, .quantity .minus, .remove, .remove-from-cart, .wc-remove-item, .cart_item .remove', debouncedSend );
} );
