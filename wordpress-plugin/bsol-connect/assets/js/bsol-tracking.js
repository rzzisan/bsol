/**
 * Storefront funnel tracking — the browser half of Bsol_Tracking
 * (class-bsol-tracking.php). Every event goes through admin-ajax.php
 * (bsol_track_event), never straight to BSOL, so the plugin never needs
 * its own copy of the API key in the browser.
 */
jQuery( function ( $ ) {
	'use strict';

	if ( typeof bsol_tracking === 'undefined' || bsol_tracking.do_not_track ) {
		return;
	}

	function randomId() {
		if ( window.crypto && window.crypto.randomUUID ) {
			return window.crypto.randomUUID();
		}
		return 'id_' + Date.now().toString( 36 ) + '_' + Math.random().toString( 36 ).slice( 2 );
	}

	/**
	 * event_id for a funnel step that should dedupe repeats within a
	 * window (ViewContent/AddToCart/InitiateCheckout/Lead — §3.2's "১
	 * ঘণ্টা bucket" rule), unlike PageView which is fresh every load.
	 */
	function bucketedId( key ) {
		var cookieName = 'bsol_eid_' + key;
		var existing = getCookie( cookieName );
		if ( existing ) {
			return existing;
		}
		var id = randomId();
		setCookie( cookieName, id, 3600 );
		return id;
	}

	function getCookie( name ) {
		var match = document.cookie.match( new RegExp( '(?:^|; )' + name + '=([^;]*)' ) );
		return match ? decodeURIComponent( match[ 1 ] ) : null;
	}

	function setCookie( name, value, maxAgeSeconds ) {
		// Exact-host only, no domain= attribute — custom_domain_context.md
		// §2's hard constraint, same rule the Next.js side follows.
		document.cookie = name + '=' + encodeURIComponent( value ) + '; path=/; max-age=' + maxAgeSeconds + '; SameSite=Lax';
	}

	function getFbc() {
		return getCookie( '_fbc' );
	}

	function fbclidFromUrl() {
		var params = new URLSearchParams( window.location.search );
		return params.get( 'fbclid' );
	}

	var buffer = [];
	var flushTimer = null;

	function queueEvent( eventName, eventId, customData ) {
		customData = customData || {};

		if ( window.fbq ) {
			window.fbq( 'track', eventName, customData, { eventID: eventId } );
		}

		var fbc = getFbc();
		buffer.push( {
			event_name: eventName,
			event_id: eventId,
			event_source_url: window.location.href,
			custom_data: customData,
			user_data: {
				fbc: fbc,
				fbclid: fbc ? undefined : fbclidFromUrl()
			}
		} );

		// PageView + ViewContent both queue on page load in the same tick —
		// batching them into one AJAX call instead of two. Any event queued
		// later (AddToCart, a delayed Lead) flushes on its own shortly
		// after, since nothing else is likely to follow within a few ms.
		if ( flushTimer ) {
			clearTimeout( flushTimer );
		}
		flushTimer = setTimeout( flush, 50 );
	}

	function flush() {
		if ( ! buffer.length ) {
			return;
		}
		var events = buffer;
		buffer = [];

		$.post( bsol_tracking.ajax_url, {
			action: 'bsol_track_event',
			nonce: bsol_tracking.nonce,
			events: JSON.stringify( events )
		} );
	}

	// -- PageView / ViewContent --------------------------------------------

	if ( 'order-received' !== bsol_tracking.page_type ) {
		queueEvent( 'PageView', randomId() );
	}

	if ( 'product' === bsol_tracking.page_type && bsol_tracking.product ) {
		queueEvent( 'ViewContent', bucketedId( 'vc_' + bsol_tracking.product.id ), {
			content_ids: [ bsol_tracking.product.id ],
			content_type: 'product',
			value: bsol_tracking.product.price,
			currency: bsol_tracking.currency
		} );
	}

	// -- InitiateCheckout ----------------------------------------------------

	if ( 'checkout' === bsol_tracking.page_type ) {
		queueEvent( 'InitiateCheckout', bucketedId( 'ic' ) );
	}

	// -- Lead — first checkout field to become a valid phone or email --------

	var leadFired = false;
	$( document.body ).on( 'blur change', '#billing_phone, #billing_email', function () {
		if ( leadFired ) {
			return;
		}
		var value = $.trim( $( this ).val() );
		var isPhone = this.id === 'billing_phone' && /^01[3-9]\d{8}$/.test( value.replace( /\D/g, '' ) );
		var isEmail = this.id === 'billing_email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( value );

		if ( isPhone || isEmail ) {
			leadFired = true;
			queueEvent( 'Lead', bucketedId( 'lead' ) );
		}
	} );

	// -- AddToCart — classic single-product form + WooCommerce's own AJAX event --

	$( document.body ).on( 'submit', 'form.cart', function () {
		var $form = $( this );
		var productId = $form.find( 'input[name="add-to-cart"]' ).val() || $form.data( 'product_id' );
		if ( productId ) {
			queueEvent( 'AddToCart', randomId(), { content_ids: [ Number( productId ) ], content_type: 'product', currency: bsol_tracking.currency } );
		}
	} );

	$( document.body ).on( 'added_to_cart', function ( event, fragments, cartHash, $button ) {
		var productId = $button && $button.data ? $button.data( 'product_id' ) : null;
		if ( productId ) {
			queueEvent( 'AddToCart', randomId(), { content_ids: [ Number( productId ) ], content_type: 'product', currency: bsol_tracking.currency } );
		}
	} );

	// -- Purchase — order-received page, browser-side copy for match-quality enrichment --

	if ( bsol_tracking.purchase ) {
		queueEvent( 'Purchase', 'order_' + bsol_tracking.purchase.bsol_order_id, {
			value: bsol_tracking.purchase.value,
			currency: bsol_tracking.purchase.currency
		} );
	}

	// Send whatever queued synchronously above without waiting for the
	// trailing debounce on a page that has nothing further to fire.
	$( window ).on( 'pagehide', flush );
} );
