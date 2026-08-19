/**
 * Registers every BSOL payment method with the WooCommerce Blocks (Cart &
 * Checkout block) Store API registry — see
 * class-bsol-gateway-blocks-support.php for why this is needed at all
 * (a plain WC_Payment_Gateway alone is invisible on block checkout).
 *
 * window.bsol_gateway_blocks_ids is a plain array of gateway ids
 * (e.g. ["bsol_sslcommerz", "bsol_bkash"]), inlined by
 * Bsol_Payment_Gateway::register_blocks_support(). No build step/JSX —
 * wp.element.createElement() is used directly, matching how lightweight
 * (non-bundled) WooCommerce Blocks payment method plugins are written.
 */
( function ( wp, wc ) {
	if ( ! wp || ! wp.element || ! wc || ! wc.wcBlocksRegistry || ! wc.wcSettings ) {
		return;
	}

	var el = wp.element.createElement;
	var decodeEntities = ( wp.htmlEntities && wp.htmlEntities.decodeEntities ) ? wp.htmlEntities.decodeEntities : function ( s ) { return s; };
	var ids = window.bsol_gateway_blocks_ids || [];

	ids.forEach( function ( id ) {
		var settings = wc.wcSettings.getSetting( id + '_data', {} );
		var label = settings.title ? decodeEntities( settings.title ) : id;
		var description = settings.description || '';

		var Content = function () {
			return el( 'div', { className: 'bsol-blocks-payment-description' }, description );
		};

		wc.wcBlocksRegistry.registerPaymentMethod( {
			name: id,
			label: label,
			content: el( Content ),
			edit: el( Content ),
			canMakePayment: function () {
				return true;
			},
			ariaLabel: label,
			supports: {
				features: settings.supports || [ 'products' ]
			}
		} );
	} );
} )( window.wp, window.wc );
