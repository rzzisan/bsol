<?php

use App\Http\Controllers\AdminAddonPackageController;
use App\Http\Controllers\AdminAddonPurchaseController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AdminSmsCreditController;
use App\Http\Controllers\AdminSmsGatewayController;
use App\Http\Controllers\AdminSubscriptionController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailOtpController;
use App\Http\Controllers\OtpController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\Api\EmailConfigurationController;
use App\Http\Controllers\Api\NotificationDispatchController;
use App\Http\Controllers\Api\NotificationTemplateController;
use App\Http\Controllers\Api\NotificationUseCaseBindingController;
use App\Http\Controllers\Api\AbandonedCheckoutController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\CheckoutOtpController;
use App\Http\Controllers\Api\Connect\ConnectAbandonedCheckoutController;
use App\Http\Controllers\Api\Connect\ConnectAuthController;
use App\Http\Controllers\Api\Connect\ConnectCheckoutOtpController;
use App\Http\Controllers\Api\Connect\ConnectCourierController;
use App\Http\Controllers\Api\Connect\ConnectFraudController;
use App\Http\Controllers\Api\Connect\ConnectOrderController;
use App\Http\Controllers\Api\Connect\ConnectPaymentController;
use App\Http\Controllers\Api\Connect\ConnectProductController;
use App\Http\Controllers\Api\Connect\ConnectSmsController;
use App\Http\Controllers\Api\Connect\ConnectTrackingController;
use App\Http\Controllers\Api\CourierController;
use App\Http\Controllers\Api\CourierFraudCheckController;
use App\Http\Controllers\Api\HelpArticleController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DigitalDeliveryController;
use App\Http\Controllers\Api\DigitalProductFileController;
use App\Http\Controllers\Api\Admin\DigitalProductSettingsController;
use App\Http\Controllers\Api\SmsCreditAutoRechargeController;
use App\Http\Controllers\Api\OrderCreditPurchaseController;
use App\Http\Controllers\Api\SmsCreditPurchaseController;
use App\Http\Controllers\Api\StorefrontAddonPurchaseController;
use App\Http\Controllers\Api\FacebookConnectController;
use App\Http\Controllers\Api\FacebookLeadController;
use App\Http\Controllers\Api\FacebookPixelSettingController;
use App\Http\Controllers\Api\FacebookReplyTemplateController;
use App\Http\Controllers\Api\FacebookWebhookController;
use App\Http\Controllers\Api\WhatsappAutomationController;
use App\Http\Controllers\Api\WhatsappConnectionController;
use App\Http\Controllers\Api\WhatsappMessageController;
use App\Http\Controllers\Api\FraudController;
use App\Http\Controllers\Api\LandingPageController;
use App\Http\Controllers\Api\LandingMediaLibraryController;
use App\Http\Controllers\Api\LandingTemplateController;
use App\Http\Controllers\Api\SmsAutomationController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\SupportController;
use App\Http\Controllers\Api\SupportTicketController;
use App\Http\Controllers\Api\TrackingDestinationController;
use App\Http\Controllers\Api\TrackingEventController;
use App\Http\Controllers\Api\TrackingUsageController;
use App\Http\Controllers\Api\CollectionHistoryController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\Admin\AdminSupportController;
use App\Http\Controllers\Api\Admin\AdminSupportTicketController;
use App\Http\Controllers\Api\Admin\AiKnowledgeBaseArticleController;
use App\Http\Controllers\Api\Admin\AiProviderCredentialController;
use App\Http\Controllers\Api\Admin\PlatformAiSupportSettingController;
use App\Http\Controllers\Api\Admin\ProductMediaSettingsController;
use App\Http\Controllers\Api\Admin\ImpersonationController;
use App\Http\Controllers\Api\Admin\PlatformFacebookSettingsController;
use App\Http\Controllers\Api\Admin\PlatformMarketingEventController;
use App\Http\Controllers\Api\Admin\ReservedSubdomainController;
use App\Http\Controllers\Api\Admin\PlatformSettingsController;
use App\Http\Controllers\Api\Admin\LandingTemplateController as AdminLandingTemplateController;
use App\Http\Controllers\Api\Admin\LandingPageAdminController;
use App\Http\Controllers\Api\Admin\CourierCacheController;
use App\Http\Controllers\Api\Admin\AdminTrackingController;
use App\Http\Controllers\Api\Admin\TwoFactorController;
use App\Http\Controllers\Api\Admin\AdminAuditLogController;
use App\Http\Controllers\Api\Admin\GlobalBlacklistController;
use App\Http\Controllers\Api\PublicMarketingPixelController;
use App\Http\Controllers\Api\PublicPlatformSettingsController;
use App\Http\Controllers\Api\PublicMarketingTrackController;
use App\Http\Controllers\Api\PublicTrackingController;
use App\Http\Controllers\Api\OnlinePaymentController;
use App\Http\Controllers\Api\OrderBulkImportController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\OrderPaymentController;
use App\Http\Controllers\Api\PaymentGatewayCredentialController;
use App\Http\Controllers\Api\PaymentGatewaySettingController;
use App\Http\Controllers\Api\PlatformGatewayPaymentController;
use App\Http\Controllers\Api\Admin\PlatformPaymentGatewayController;
use App\Http\Controllers\Api\ProductMediaController;
use App\Http\Controllers\Api\ProductCategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductVariantController;
use App\Http\Controllers\Api\ShopProfileController;
use App\Http\Controllers\Api\StorefrontCatalogController;
use App\Http\Controllers\Api\StorefrontCheckoutController;
use App\Http\Controllers\Api\StorefrontPaymentController;
use App\Http\Controllers\Api\StorefrontReviewController;
use App\Http\Controllers\Api\ProductReviewController;
use App\Http\Controllers\Api\DashboardGettingStartedController;
use App\Http\Controllers\Api\StorefrontSettingController;
use App\Http\Controllers\Api\StickerTemplateController;
use App\Http\Controllers\Api\WordpressApiKeyController;
use App\Http\Controllers\LandingPageAnalyticsController;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => config('app.name'),
        'environment' => app()->environment(),
        'timestamp' => now()->toIso8601String(),
    ]);
});

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Second half of the 2FA login flow (security_hardening_context.md §2).
// Public because the caller has no token yet — login() withheld it and
// handed back a challenge_token instead. Throttled + a per-challenge
// 5-attempt cap (TwoFactorChallengeService) together bound how many guesses
// a 6-digit code can be brute-forced with.
Route::post('/2fa/challenge', [AuthController::class, 'verifyTwoFactorChallenge'])
    ->middleware('throttle:10,1');

// Second half of the per-seller subdomain login handoff
// (custom_domain_context.md §6). Public because the caller has no token yet;
// the code is single-use, 60s, and bound to the host presenting it.
Route::post('/auth/handoff/exchange', [AuthController::class, 'exchangeHandoff'])
    ->middleware('throttle:20,1');

// Move an already-signed-in session to the seller's own address — used right
// after they claim a subdomain during onboarding, when their token still
// belongs to the platform origin.
Route::post('/auth/handoff/start', [AuthController::class, 'startHandoff'])
    ->middleware(['auth:sanctum', 'throttle:20,1']);

// Phone OTP for registration
Route::post('/otp/register', [OtpController::class, 'sendRegistrationOtp']);
Route::post('/otp/verify-registration', [OtpController::class, 'verifyRegistrationOtp']);
Route::post('/otp/resend', [OtpController::class, 'resendOtp']);

// Email verification link (public access)
Route::get('/email/verify-link', [EmailOtpController::class, 'verifyEmailLink'])->name('email.verify-link');

// Password reset (public, no auth required)
Route::post('/password/find-account', [PasswordResetController::class, 'findAccount']);
Route::post('/password/send-otp',     [PasswordResetController::class, 'sendOtp']);
Route::post('/password/resend-otp',   [PasswordResetController::class, 'resendOtp']);
Route::post('/password/verify-otp',   [PasswordResetController::class, 'verifyOtp']);
Route::post('/password/reset',        [PasswordResetController::class, 'resetPassword']);

// SaaS attribution footer + /terms page content — platform-wide, not per-merchant.
Route::get('/public/platform-settings', [PublicPlatformSettingsController::class, 'show']);
Route::get('/public/marketing-pixel', [PublicMarketingPixelController::class, 'show']);

// BSOL Connect plugin zip — no secrets in it, safe as a plain public download link.
Route::get('/wordpress/plugin-download', [WordpressApiKeyController::class, 'downloadPlugin'])
    ->middleware('throttle:20,1');
Route::get('/wordpress/plugin-version', [WordpressApiKeyController::class, 'pluginVersion'])
    ->middleware('throttle:60,1');

// Host resolver for per-seller subdomains — the Next.js middleware calls
// this to decide whether {label}.{apex} belongs to a real shop before
// rendering anything (custom_domain_context.md §4.1). Branding only, no ids.
Route::get('/public/shop-by-subdomain/{label}', [ShopProfileController::class, 'publicResolveSubdomain'])
    ->where('label', '[a-zA-Z0-9-]{1,63}')
    ->middleware('throttle:120,1');

Route::get('/public/landing-pages/{slug}', [LandingPageController::class, 'publicShow'])
    ->middleware(['track_landing_page_visit', 'throttle:60,1']);

// Landing-page browser tracking ingest — host-resolved, not slug-based
// (slug is per-shop, not global, so it can't identify a seller on its own —
// tracking_capi_context.md §8.0/§8.8). No API key: the seller's own
// subdomain is same-origin to the browser already.
Route::post('/public/track', [PublicTrackingController::class, 'ingest'])
    ->middleware('throttle:300,1');
// Same-origin relay for BSOL's own homepage engagement events — reaches
// Meta even when the browser blocks connect.facebook.net directly
// (platform_marketing_tracking_context.md).
Route::post('/public/marketing-track', [PublicMarketingTrackController::class, 'ingest'])
    ->middleware('throttle:300,1');
Route::post('/public/landing-pages/{slug}/order', [LandingPageController::class, 'publicSubmitOrder'])
    ->middleware(['track_landing_page_visit', 'throttle:15,1']);
// Thank-you page order lookup — token-guarded, deliberately not tracked as a landing visit.
Route::get('/public/landing-pages/{slug}/orders/{orderId}', [LandingPageController::class, 'publicShowOrder'])
    ->where('orderId', '[0-9]+')
    ->middleware('throttle:30,1');

// Checkout OTP verification — token-guarded like the order lookup above.
Route::post('/public/landing-pages/{slug}/orders/{orderId}/verify-otp', [CheckoutOtpController::class, 'verify'])
    ->where('orderId', '[0-9]+')
    ->middleware('throttle:10,1');
Route::post('/public/landing-pages/{slug}/orders/{orderId}/resend-otp', [CheckoutOtpController::class, 'resend'])
    ->where('orderId', '[0-9]+')
    ->middleware('throttle:10,1');

// Online payment — channel list for the checkout selector, the token-
// guarded wallet-claim submit (Phase A), and the gateway-session initiate
// (Phase B/C). See online_payment_context.md.
Route::get('/public/landing-pages/{slug}/payment-channels', [OnlinePaymentController::class, 'publicChannels'])
    ->middleware('throttle:60,1');
Route::post('/public/landing-pages/{slug}/orders/{orderId}/online-payment/wallet-claim', [OnlinePaymentController::class, 'submitWalletClaim'])
    ->where('orderId', '[0-9]+')
    ->middleware('throttle:10,1');
Route::post('/public/landing-pages/{slug}/orders/{orderId}/online-payment/gateway/initiate', [OnlinePaymentController::class, 'initiateGateway'])
    ->where('orderId', '[0-9]+')
    ->middleware('throttle:10,1');

// Gateway callback (browser redirect) + IPN (server-to-server) — top-level,
// not slug-scoped, since the provider only knows the URL we gave it, not
// our slug. The callback redirects the browser back to the seller's own
// thank-you page; the IPN returns a plain JSON ack.
Route::match(['get', 'post'], '/online-payment/{provider}/callback/{id}', [OnlinePaymentController::class, 'gatewayCallback'])
    ->where('id', '[0-9]+')
    ->middleware('throttle:30,1');
Route::post('/online-payment/{provider}/ipn', [OnlinePaymentController::class, 'gatewayIpn'])
    ->middleware('throttle:30,1');

// Abandoned checkout capture — progressive save while the customer is still
// filling the form, and a token-guarded resume lookup. Deliberately not
// tracked as a landing visit (that's already handled by the page-load hit).
Route::post('/public/landing-pages/{slug}/abandoned-checkout', [AbandonedCheckoutController::class, 'save'])
    ->middleware('throttle:30,1');
Route::get('/public/landing-pages/{slug}/abandoned-checkout/resume', [AbandonedCheckoutController::class, 'resumeShow'])
    ->middleware('throttle:30,1');

// Inline variant picker on the public checkout — only ever exposes a product
// that's actually attached to this published page (see publicAttachedProduct()).
Route::get('/public/landing-pages/{slug}/products/{productId}/options', [LandingPageController::class, 'publicProductOptions'])
    ->where('productId', '[0-9]+')
    ->middleware('throttle:60,1');
Route::post('/public/landing-pages/{slug}/products/{productId}/variants/resolve', [LandingPageController::class, 'publicResolveVariant'])
    ->where('productId', '[0-9]+')
    ->middleware('throttle:60,1');

// Digital product download — token-in-URL, no auth (the customer only ever
// has the link from email/SMS/order-status page). hosted_file downloads are
// additionally OTP-gated — see digital_product_context.md §7.
Route::prefix('public/digital-deliveries/{token}')->middleware('throttle:30,1')->group(function () {
    Route::get('/', [DigitalDeliveryController::class, 'show']);
    Route::post('/send-otp', [DigitalDeliveryController::class, 'sendOtp']);
    Route::post('/verify-otp', [DigitalDeliveryController::class, 'verifyOtp']);
    Route::get('/download', [DigitalDeliveryController::class, 'download']);
});

// Public storefront catalog — host-resolved (LandingPageResolver), same
// pattern as /public/landing-pages/{slug}. seller_storefront_context.md §12
// (S1). throttle:60,1 matches the browsing-page traffic shape (higher than
// the write-heavy digital-delivery group above).
Route::prefix('public/storefront')->middleware('throttle:60,1')->group(function () {
    Route::get('/home', [StorefrontCatalogController::class, 'home']);
    Route::get('/categories', [StorefrontCatalogController::class, 'categories']);
    Route::get('/products', [StorefrontCatalogController::class, 'products']);
    Route::get('/products/{slug}', [StorefrontCatalogController::class, 'show']);
    Route::get('/orders/{token}', [StorefrontCheckoutController::class, 'showOrder']);
    Route::get('/payment-channels', [StorefrontPaymentController::class, 'channels']);
    Route::get('/sitemap-data', [StorefrontCatalogController::class, 'sitemapData']);
});

// Review submission (S7) — its own throttle, tighter than browsing but
// looser than checkout (open submission, no order-verification — see
// StorefrontReviewController).
Route::post('/public/storefront/products/{slug}/reviews', [StorefrontReviewController::class, 'store'])
    ->middleware('throttle:10,1');

// Cart checkout submission — tighter throttle than the read-only catalog
// group above, matches /public/landing-pages/{slug}/order's own 15/min.
// seller_storefront_context.md §6/§12 (S3, S3b).
Route::post('/public/storefront/orders', [StorefrontCheckoutController::class, 'submitOrder'])
    ->middleware('throttle:15,1');

// Online payment (S3b) — same throttle as the order-submit route above.
Route::prefix('public/storefront/orders/{token}')->middleware('throttle:15,1')->group(function () {
    Route::post('/gateway/initiate', [StorefrontPaymentController::class, 'initiateGateway']);
    Route::post('/wallet-claim', [StorefrontPaymentController::class, 'submitWalletClaim']);
});

// Meta webhook — called directly by Facebook, not by our frontend. Auth
// boundary is the verify-token handshake (GET) / X-Hub-Signature-256 HMAC
// (POST) inside the controller, not Sanctum. See §16.3 for Meta App setup.
Route::get('/facebook/webhook', [FacebookWebhookController::class, 'verify'])
    ->middleware('throttle:120,1');
Route::post('/facebook/webhook', [FacebookWebhookController::class, 'receive'])
    ->middleware('throttle:120,1');

// Facebook OAuth callback — Meta redirects the seller's browser here directly
// (full-page navigation), so it can't carry a Sanctum bearer token. Identity
// is instead proven by the signed `state` param minted in the authenticated
// /facebook/connect/redirect step. See FacebookConnectController::callback().
Route::get('/facebook/connect/callback', [FacebookConnectController::class, 'callback'])
    ->middleware('throttle:20,1');

// Same rationale again — the bKash Agreement consent flow's browser
// redirect, no Sanctum token. See SmsCreditAutoRechargeController,
// auto_top_up_context.md.
Route::get('/sms/credit/auto-recharge/agreement/callback', [SmsCreditAutoRechargeController::class, 'callback'])
    ->middleware('throttle:20,1');

// Platform gateway payments (seller→platform: subscription, SMS credit,
// order-credit add-on, storefront add-on) — same rationale as the bKash
// callbacks above, no Sanctum token on the browser-redirect leg. See
// online_payment_context.md §12, PlatformGatewayPaymentController.
Route::get('/platform-gateway-payments/{purpose}/{provider}/callback/{id}', [PlatformGatewayPaymentController::class, 'callback'])
    ->where('purpose', 'subscription|sms_credit|order_credit|storefront_addon')
    ->middleware('throttle:20,1');
// Server-to-server IPN — no path param, resolves the claim from the
// payload's own fields (see PlatformGatewayPaymentController::ipn()).
Route::post('/platform-gateway-payments/{provider}/ipn', [PlatformGatewayPaymentController::class, 'ipn'])
    ->middleware('throttle:60,1');

// ── WordPress/WooCommerce Connector (plugin-facing) ─────────────────────────
// A different trust boundary from the auth:sanctum group below — authenticated
// by a domain-bound PlatformApiKey (X-API-KEY + X-Client-Domain), not a
// Sanctum session. See bsol_history_and_new_context.md §5.
Route::prefix('connect/v1')->middleware('connect_api_key')->group(function () {
    Route::post('/connect', [ConnectAuthController::class, 'connect'])
        ->middleware('throttle:30,1');
    Route::post('/disconnect', [ConnectAuthController::class, 'disconnect'])
        ->middleware('throttle:30,1');

    Route::middleware(['active_subscription', 'throttle:120,1'])->group(function () {
        Route::post('/orders/sync', [ConnectOrderController::class, 'sync']);
        Route::post('/orders/sync-status', [ConnectOrderController::class, 'syncStatus']);
        Route::get('/orders/invoice', [ConnectOrderController::class, 'invoicePdf']);
        Route::post('/products/sync', [ConnectProductController::class, 'sync']);
        Route::post('/checkout/abandoned', [ConnectAbandonedCheckoutController::class, 'save']);
        Route::post('/courier/book', [ConnectCourierController::class, 'book']);
        Route::post('/courier/track', [ConnectCourierController::class, 'track']);
        Route::post('/courier/cancel', [ConnectCourierController::class, 'cancel']);
        Route::get('/courier/balance', [ConnectCourierController::class, 'balance']);
        Route::get('/courier/waybill', [ConnectCourierController::class, 'waybill']);
        Route::post('/fraud/check-phone', [ConnectFraudController::class, 'checkPhone'])
            ->middleware('throttle:60,1');
        Route::post('/fraud/courier-health', [ConnectFraudController::class, 'courierHealth'])
            ->middleware('throttle:60,1');
        Route::post('/orders/verify-otp', [ConnectCheckoutOtpController::class, 'verify'])
            ->middleware('throttle:20,1');
        Route::post('/orders/resend-otp', [ConnectCheckoutOtpController::class, 'resend'])
            ->middleware('throttle:20,1');
        Route::post('/sms/send', [ConnectSmsController::class, 'send'])
            ->middleware('throttle:20,1');
        // Online payment — mirrors landing-page checkout's endpoints,
        // delegates entirely to OnlinePaymentService. See
        // wordpress_connect_context.md.
        Route::get('/payment/channels', [ConnectPaymentController::class, 'channels']);
        Route::post('/payment/gateway/initiate', [ConnectPaymentController::class, 'initiateGateway']);
        Route::post('/payment/wallet-claim', [ConnectPaymentController::class, 'walletClaim']);
        Route::post('/tracking/events', [ConnectTrackingController::class, 'ingest'])
            ->middleware('throttle:600,1');
        Route::get('/tracking/config', [ConnectTrackingController::class, 'config'])
            ->middleware('throttle:60,1');
    });
});

Route::middleware(['auth:sanctum', 'force_password_change'])->group(function () {
    // Email OTP for verification (authenticated)
    Route::post('/email/send-verification', [EmailOtpController::class, 'sendVerificationEmail']);
    Route::post('/email/verify', [EmailOtpController::class, 'verifyEmailOtp']);
    Route::post('/email/resend', [EmailOtpController::class, 'resendVerificationEmail']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    // "Return" from admin impersonation — reachable here (not under
    // is_admin) because by the time this fires, the acting identity IS the
    // impersonated seller (domain_security_audit.md §L-2). Revokes the
    // impersonation token server-side instead of leaving it valid for the
    // rest of its 60-minute TTL after the admin's tab thinks it's "returned".
    Route::post('/impersonate/end', [ImpersonationController::class, 'end']);

    // Phase 1 core module — staff/team sub-account role, staff_team_role_context.md §4
    Route::middleware('staff_permission:sms')->group(function () {
        Route::get('/sms/gateways', [AdminSmsGatewayController::class, 'myGateways']);
        Route::post('/sms/preview', [AdminSmsGatewayController::class, 'preview']);
        Route::post('/sms/send', [AdminSmsGatewayController::class, 'send']);
        Route::get('/sms/history', [AdminSmsGatewayController::class, 'myHistory']);
        Route::get('/sms/automation/rules', [SmsAutomationController::class, 'index']);
        Route::post('/sms/automation/rules', [SmsAutomationController::class, 'store']);
        Route::put('/sms/automation/rules/{id}', [SmsAutomationController::class, 'update']);
        Route::delete('/sms/automation/rules/{id}', [SmsAutomationController::class, 'destroy']);
        Route::get('/sms/automation/logs', [SmsAutomationController::class, 'logs']);
    });

    // ── SMS credit self-service purchase — subscription_billing_context.md §3 ──
    // Owner-only (Pattern B, staff_team_role_context.md §3.3): this is billing/wallet
    // management, not an operational "send SMS" action — staff never purchases credit.
    Route::middleware('owner_only')->group(function () {
        Route::get('/sms/credit/rate', [SmsCreditPurchaseController::class, 'rate']);
        Route::get('/sms/credit/purchases', [SmsCreditPurchaseController::class, 'myPurchases']);
        Route::get('/sms/credit/purchases/{purchase}/invoice', [SmsCreditPurchaseController::class, 'invoicePdf']);

        // Auto-recharge (auto_top_up_context.md) — same owner-only gate,
        // same reasoning: a saved recurring-charge authorization is
        // credential-equivalent, never staff-delegable.
        Route::get('/sms/credit/auto-recharge/settings', [SmsCreditAutoRechargeController::class, 'status']);
        Route::put('/sms/credit/auto-recharge/settings', [SmsCreditAutoRechargeController::class, 'updateSettings']);
        Route::post('/sms/credit/auto-recharge/agreement/create', [SmsCreditAutoRechargeController::class, 'createAgreement']);
        Route::delete('/sms/credit/auto-recharge/agreement', [SmsCreditAutoRechargeController::class, 'disconnect']);
    });

    // ── Order-credit add-on self-service purchase — subscription_billing_context.md
    // §9.2-B / §9.6 step 3 ── Owner-only (Pattern B), same reasoning as SMS
    // credit above: billing/wallet management, not an operational action.
    Route::middleware('owner_only')->group(function () {
        Route::get('/order-credits/packages', [OrderCreditPurchaseController::class, 'packages']);
        Route::get('/order-credits/balance', [OrderCreditPurchaseController::class, 'balance']);
        Route::get('/order-credits/history', [OrderCreditPurchaseController::class, 'history']);
        Route::get('/order-credits/purchases', [OrderCreditPurchaseController::class, 'myPurchases']);
    });

    // ── Storefront add-on self-service purchase — subscription_billing_context.md
    // §9.2-D / §9.6 step 4 ── Owner-only (Pattern B), same reasoning as above.
    Route::middleware('owner_only')->group(function () {
        Route::get('/storefront-addon/status', [StorefrontAddonPurchaseController::class, 'status']);
        Route::get('/storefront-addon/purchases', [StorefrontAddonPurchaseController::class, 'myPurchases']);
    });

    // ── Platform gateway payments (seller→platform) — the same 7 merchant
    // gateways sellers can offer their own customers are now available for
    // paying the platform itself (subscription, SMS credit, order-credit
    // add-on, storefront add-on), admin-configured. See
    // online_payment_context.md §12. Owner-only, same reasoning as the 4
    // purpose blocks above.
    Route::middleware('owner_only')->prefix('platform-gateway-payments')->group(function () {
        Route::get('/channels', [PlatformGatewayPaymentController::class, 'channels']);
        Route::post('/{purpose}/initiate', [PlatformGatewayPaymentController::class, 'initiate'])
            ->where('purpose', 'subscription|sms_credit|order_credit|storefront_addon');

        // bKash classic Checkout API ("PGW") — JS-widget flow, no redirect
        // callback needed (bKash's own widget calls these two directly
        // while the seller stays authenticated on our page). Generalizes
        // the old per-surface BkashPgwPaymentController/
        // SmsCreditBkashPgwPaymentController pair across all 4 purposes —
        // see §13.2, PlatformGatewayPaymentService::createBkashPgwSession().
        Route::post('/{purpose}/bkash-pgw/create', [PlatformGatewayPaymentController::class, 'bkashPgwCreate'])
            ->where('purpose', 'subscription|sms_credit|order_credit|storefront_addon');
        Route::post('/{purpose}/bkash-pgw/execute/{paymentId}', [PlatformGatewayPaymentController::class, 'bkashPgwExecute'])
            ->where('purpose', 'subscription|sms_credit|order_credit|storefront_addon');
    });

    // ── Subscription (self-service — must stay reachable even when expired) ───
    // Owner-only (Pattern B, staff_team_role_context.md §3.3) — billing is never
    // a staff-delegable action.
    Route::middleware('owner_only')->group(function () {
        Route::get('/subscription/plans', [SubscriptionController::class, 'plans']);
        Route::get('/subscription/me', [SubscriptionController::class, 'mySubscription']);
        Route::get('/subscription/invoice/preview', [SubscriptionController::class, 'invoicePreview']);
        Route::get('/subscription/payments/{payment}/invoice', [SubscriptionController::class, 'invoicePdf']);
    });

    // ── Staff/Team sub-account role (owner-only) — staff_team_role_context.md §3.6 ──
    Route::middleware('owner_only')->prefix('staff')->group(function () {
        Route::get('/', [StaffController::class, 'index']);
        Route::post('/', [StaffController::class, 'store']);
        Route::put('/{staff}', [StaffController::class, 'update']);
        Route::post('/{staff}/reset-password', [StaffController::class, 'resetPassword']);
        Route::delete('/{staff}', [StaffController::class, 'destroy']);
    });

    // ── SaaS Support chat (seller ↔ admin team) — deliberately outside the
    // active_subscription group: a seller with an expired subscription needs
    // support access most of all.
    Route::prefix('support')->group(function () {
        Route::get('/conversation', [SupportController::class, 'conversation']);
        Route::get('/messages', [SupportController::class, 'messages']);
        Route::post('/messages', [SupportController::class, 'send']);
        Route::post('/read', [SupportController::class, 'markRead']);
        Route::get('/unread-count', [SupportController::class, 'unreadCount']);
    });

    // ── Support ticketing (alongside live chat, not replacing it) —
    // support_ticketing_ai_context.md. Same expired-subscription exemption as
    // the chat group above.
    Route::prefix('tickets')->group(function () {
        Route::get('/', [SupportTicketController::class, 'index']);
        Route::post('/', [SupportTicketController::class, 'store']);
        Route::get('/unread-count', [SupportTicketController::class, 'unreadCount']);
        Route::get('/{ticket}', [SupportTicketController::class, 'show']);
        Route::get('/{ticket}/messages', [SupportTicketController::class, 'messages']);
        Route::post('/{ticket}/messages', [SupportTicketController::class, 'send']);
        Route::post('/{ticket}/read', [SupportTicketController::class, 'markRead']);
    });

    // Per-page "how do I use this?" help button — reads the same knowledge
    // base the AI agent searches (support_ticketing_ai_context.md). Same
    // expired-subscription exemption: a lapsed seller still needs to learn
    // the product, e.g. to fix whatever is blocking renewal.
    Route::get('/help/{slug}', [HelpArticleController::class, 'show']);

Route::middleware('active_subscription')->group(function () {
    // ── Landing Page Builder + Analytics + Media Library + Abandoned Checkouts ──
    // Phase 2 module — staff/team sub-account role, staff_team_role_context.md §9
    Route::middleware('staff_permission:landing_pages')->group(function () {
        Route::get('/landing/templates', [LandingTemplateController::class, 'index']);
        Route::get('/landing/templates/{id}', [LandingTemplateController::class, 'show'])->where('id', '[0-9]+');
        Route::get('/landing/pages', [LandingPageController::class, 'index']);
        Route::post('/landing/pages', [LandingPageController::class, 'store']);
        Route::get('/landing/pages/{id}', [LandingPageController::class, 'show'])->where('id', '[0-9]+');
        Route::put('/landing/pages/{id}', [LandingPageController::class, 'update'])->where('id', '[0-9]+');
        Route::delete('/landing/pages/{id}', [LandingPageController::class, 'destroy'])->where('id', '[0-9]+');
        Route::post('/landing/pages/{id}/publish', [LandingPageController::class, 'publish'])->where('id', '[0-9]+');

        Route::prefix('landing/analytics')->group(function () {
            Route::get('/{landingPageId}/statistics', [LandingPageAnalyticsController::class, 'getStatistics'])->where('landingPageId', '[0-9]+');
            Route::get('/{landingPageId}/visitors', [LandingPageAnalyticsController::class, 'getVisitors'])->where('landingPageId', '[0-9]+');
            Route::get('/{landingPageId}/by-country', [LandingPageAnalyticsController::class, 'getByCountry'])->where('landingPageId', '[0-9]+');
            Route::get('/{landingPageId}/by-referrer', [LandingPageAnalyticsController::class, 'getByReferrer'])->where('landingPageId', '[0-9]+');
            Route::post('/{landingPageId}/link-visit-to-order', [LandingPageAnalyticsController::class, 'linkVisitToOrder'])->where('landingPageId', '[0-9]+');
        });

        Route::prefix('landing/media-library')->group(function () {
            Route::get('/', [LandingMediaLibraryController::class, 'index']);
            Route::get('/policy', [LandingMediaLibraryController::class, 'policy']);
            Route::post('/upload', [LandingMediaLibraryController::class, 'store']);
        });

        Route::prefix('landing/abandoned-checkouts')->group(function () {
            Route::get('/', [AbandonedCheckoutController::class, 'index']);
            Route::get('/stats', [AbandonedCheckoutController::class, 'stats']);
            Route::get('/export', [AbandonedCheckoutController::class, 'export']);
            Route::get('/{id}', [AbandonedCheckoutController::class, 'show'])->where('id', '[0-9]+');
            Route::put('/{id}', [AbandonedCheckoutController::class, 'update'])->where('id', '[0-9]+');
            Route::delete('/{id}', [AbandonedCheckoutController::class, 'destroy'])->where('id', '[0-9]+');
        });
    });

    // ── Product Management ────────────────────────────────────────────────────
    // Phase 1 core module — staff/team sub-account role, staff_team_role_context.md §4
    Route::middleware('staff_permission:products')->group(function () {
        Route::get('/products/stats', [ProductController::class, 'stats']);
        Route::get('/products/media-policy', [ProductMediaController::class, 'policy']);
        Route::get('/products/{product}/media', [ProductMediaController::class, 'index']);
        Route::post('/products/{product}/media', [ProductMediaController::class, 'store']);
        Route::put('/products/{product}/media/reorder', [ProductMediaController::class, 'reorder']);
        Route::put('/products/{product}/media/{mediaId}/set-thumbnail', [ProductMediaController::class, 'setThumbnail']);
        Route::delete('/products/{product}/media/{mediaId}', [ProductMediaController::class, 'destroy']);

        // Digital product hosted file — see digital_product_context.md §2.
        Route::get('/products/digital-policy', [DigitalProductFileController::class, 'policy']);
        Route::post('/products/{product}/digital-file', [DigitalProductFileController::class, 'store']);
        Route::delete('/products/{product}/digital-file', [DigitalProductFileController::class, 'destroy']);
        Route::post('/products/{product}/adjust-stock', [ProductController::class, 'adjustStock']);
        Route::apiResource('/products', ProductController::class)->only(['index', 'store', 'show', 'update', 'destroy']);

        // Review moderation (S7, seller_storefront_context.md §5.3/§12).
        Route::get('/reviews', [ProductReviewController::class, 'index']);
        Route::put('/reviews/{id}', [ProductReviewController::class, 'update']);
        Route::delete('/reviews/{id}', [ProductReviewController::class, 'destroy']);

        // ── Product Variant & Option Management ───────────────────────────────
        Route::prefix('products/{product}')->group(function () {
            // Options
            Route::get('/options',                                    [ProductVariantController::class, 'optionIndex']);
            Route::post('/options',                                   [ProductVariantController::class, 'optionStore']);
            Route::put('/options/{option}',                           [ProductVariantController::class, 'optionUpdate']);
            Route::delete('/options/{option}',                        [ProductVariantController::class, 'optionDestroy']);
            Route::post('/options/{option}/values',                   [ProductVariantController::class, 'valueStore']);
            Route::put('/options/{option}/values/{value}',            [ProductVariantController::class, 'valueUpdate']);
            Route::delete('/options/{option}/values/{value}',         [ProductVariantController::class, 'valueDestroy']);

            // Variants
            Route::get('/variants/resolve',                           [ProductVariantController::class, 'resolve']);
            Route::post('/variants/resolve',                          [ProductVariantController::class, 'resolve']);
            Route::post('/variants/generate',                         [ProductVariantController::class, 'generate']);
            Route::put('/variants/bulk',                              [ProductVariantController::class, 'bulkUpdate']);
            Route::get('/variants',                                   [ProductVariantController::class, 'index']);
            Route::post('/variants',                                  [ProductVariantController::class, 'store']);
            Route::put('/variants/{variant}',                         [ProductVariantController::class, 'update']);
            Route::delete('/variants/{variant}',                      [ProductVariantController::class, 'destroy']);
        });

        Route::apiResource('/categories', ProductCategoryController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::post('/categories/{id}/thumbnail', [ProductCategoryController::class, 'uploadThumbnail'])->where('id', '[0-9]+');
        Route::delete('/categories/{id}/thumbnail', [ProductCategoryController::class, 'removeThumbnail'])->where('id', '[0-9]+');
    });

    // ── Order Management ──────────────────────────────────────────────────────
    Route::middleware('staff_permission:orders')->group(function () {
        Route::get('/orders/stats', [OrderController::class, 'stats']);
        Route::get('/orders/create-bootstrap', [OrderController::class, 'createBootstrap']);
        Route::get('/orders/create/bootstrap', [OrderController::class, 'createBootstrap']);
        Route::get('/orders/bulk-import/template', [OrderBulkImportController::class, 'template']);
        Route::post('/orders/bulk-import/preview', [OrderBulkImportController::class, 'preview']);
        Route::post('/orders/bulk-import/commit', [OrderBulkImportController::class, 'commit']);
        Route::get('/orders/{order}/invoice', [OrderController::class, 'invoicePdf']);
        Route::get('/orders/{order}/payments', [OrderPaymentController::class, 'index']);
        Route::post('/orders/{order}/payments', [OrderPaymentController::class, 'store']);
        Route::delete('/orders/{order}/payments/{payment}', [OrderPaymentController::class, 'destroy']);
        Route::apiResource('/orders', OrderController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
    });

    // ── Accounting ───────────────────────────────────────────────────────────
    // Phase 2 module — staff_team_role_context.md §9
    Route::middleware('staff_permission:accounting')->group(function () {
        Route::get('/accounting/summary', [TransactionController::class, 'summary']);
        Route::get('/accounting/transactions', [TransactionController::class, 'index']);
        Route::post('/accounting/transactions', [TransactionController::class, 'store']);
        Route::put('/accounting/transactions/{id}', [TransactionController::class, 'update']);
        Route::delete('/accounting/transactions/{id}', [TransactionController::class, 'destroy']);
        Route::get('/accounting/collections', [CollectionHistoryController::class, 'index']);
        Route::get('/accounting/collections/summary', [CollectionHistoryController::class, 'summary']);
    });

    // ── Online Payment (wallet_manual + gateway_auto) ──────────────────────────
    // Own permission key — payment-gateway credentials are sensitive enough to
    // gate separately from general order/accounting access. See
    // online_payment_context.md.
    Route::middleware('staff_permission:payments')->group(function () {
        Route::get('/payment-gateway-settings', [PaymentGatewaySettingController::class, 'getSettings']);
        Route::put('/payment-gateway-settings', [PaymentGatewaySettingController::class, 'saveSettings']);
        Route::get('/payment-gateway-credentials', [PaymentGatewayCredentialController::class, 'index']);
        Route::put('/payment-gateway-credentials/{provider}', [PaymentGatewayCredentialController::class, 'save']);
        Route::get('/online-payments/pending-verification', [OnlinePaymentController::class, 'pendingVerification']);
        Route::post('/online-payments/{id}/verify', [OnlinePaymentController::class, 'verify'])->where('id', '[0-9]+');
    });

    // ── Analytics ────────────────────────────────────────────────────────────
    // Phase 2 module (read-only) — staff_team_role_context.md §9
    Route::middleware('staff_permission:analytics')->prefix('analytics')->group(function () {
        Route::get('/sales', [AnalyticsController::class, 'sales']);
        Route::get('/products', [AnalyticsController::class, 'products']);
        Route::get('/customers', [AnalyticsController::class, 'customers']);
        Route::get('/courier', [AnalyticsController::class, 'courier']);
    });

    // ── Customer Management ───────────────────────────────────────────────────
    Route::middleware('staff_permission:customers')->group(function () {
        Route::get('/customers/lookup-by-phone', [CustomerController::class, 'lookupByPhone']);
        Route::get('/customers/stats', [CustomerController::class, 'stats']);
        Route::post('/customers/sync-all', [CustomerController::class, 'syncAll']);
        Route::post('/customers/{customer}/toggle-block', [CustomerController::class, 'toggleBlock']);
        Route::apiResource('/customers', CustomerController::class)->only(['index', 'show', 'update']);
    });

    // ── Shop Profile (name/phone/address/logo — used on courier waybills) ────
    // Pattern B (staff_team_role_context.md §3.3): shop identity/branding,
    // staff never create/edit it, only see it used elsewhere (waybill FROM
    // block reads the model directly, not through this endpoint).
    Route::middleware('owner_only')->group(function () {
        Route::get('/shop-profile', [ShopProfileController::class, 'show']);
        Route::post('/shop-profile', [ShopProfileController::class, 'update']);

        // Per-seller branded subdomain (custom_domain_context.md §5).
        // Owner-only like the rest of shop identity — staff never claim or
        // release the shop's public address.
        Route::get('/shop-profile/subdomain/check', [ShopProfileController::class, 'checkSubdomain'])
            ->middleware('throttle:30,1');
        Route::put('/shop-profile/subdomain', [ShopProfileController::class, 'setSubdomain']);
        Route::delete('/shop-profile/subdomain', [ShopProfileController::class, 'releaseSubdomain']);
    });

    // ── Storefront settings (homepage mode + theme) ────────────────────────
    // Pattern B, owner-only — mirrors Shop Profile above. Also package-gated
    // (subscription_billing_context.md §9.2-D/E) — storefront is an
    // opt-in-per-plan module; the public /store/* side is gated separately
    // in StorefrontCatalogController::home() since that route has no
    // Sanctum session to run this middleware against.
    // seller_storefront_context.md §5.1/§12 (S0).
    Route::middleware(['owner_only', 'package_feature:storefront'])->group(function () {
        Route::get('/storefront-settings', [StorefrontSettingController::class, 'show']);
        Route::put('/storefront-settings', [StorefrontSettingController::class, 'update']);
        Route::post('/storefront-settings/banners', [StorefrontSettingController::class, 'uploadBanner']);
        Route::delete('/storefront-settings/banners/{index}', [StorefrontSettingController::class, 'removeBanner']);
        Route::post('/storefront-settings/partner-logos', [StorefrontSettingController::class, 'uploadPartnerLogo']);
        Route::delete('/storefront-settings/partner-logos/{index}', [StorefrontSettingController::class, 'removePartnerLogo']);
        Route::post('/storefront-settings/about-image', [StorefrontSettingController::class, 'uploadAboutImage']);
        Route::delete('/storefront-settings/about-image', [StorefrontSettingController::class, 'removeAboutImage']);
    });

    // ── Dashboard "Getting Started" checklist ──────────────────────────────
    // Pattern B (owner_only) — post-onboarding setup guidance for the shop
    // owner, not an operational staff task. production_audit_report_context.md
    // §7 (P1) / onboarding_checklist_context.md.
    Route::middleware('owner_only')->prefix('dashboard/getting-started')->group(function () {
        Route::get('/', [DashboardGettingStartedController::class, 'show']);
        Route::post('/dismiss', [DashboardGettingStartedController::class, 'dismiss']);
        Route::post('/demo-products', [DashboardGettingStartedController::class, 'createDemoProducts']);
        Route::delete('/demo-products', [DashboardGettingStartedController::class, 'deleteDemoProducts']);
    });

    // ── Sticker Template (default label design + per-courier overrides) ───────
    // Pattern B (staff_team_role_context.md §3.3) — same reasoning as Shop
    // Profile above: print/branding preference, not an operational action.
    Route::middleware('owner_only')->prefix('sticker-templates')->group(function () {
        Route::get('/catalog', [StickerTemplateController::class, 'catalog']);
        Route::get('/settings', [StickerTemplateController::class, 'show']);
        Route::post('/settings', [StickerTemplateController::class, 'update']);
    });

    // ── WordPress/WooCommerce Connector API key (dashboard-facing) ───────────
    // Pattern B (staff_team_role_context.md §3.3) — a credential, staff never
    // generate/revoke it. Distinct from the plugin-facing /connect/v1/* above.
    // See bsol_history_and_new_context.md §5.
    Route::middleware('owner_only')->prefix('wordpress')->group(function () {
        // A list, not a singleton, since Phase 16 (multiple connected sites).
        Route::get('/api-keys', [WordpressApiKeyController::class, 'index']);
        Route::post('/api-keys', [WordpressApiKeyController::class, 'store']);
        Route::delete('/api-keys/{id}', [WordpressApiKeyController::class, 'destroy'])->where('id', '[0-9]+');
        Route::put('/api-keys/{id}/otp-settings', [WordpressApiKeyController::class, 'updateOtpSetting'])->where('id', '[0-9]+');
    });

    // ── Courier Integration ───────────────────────────────────────────────────
    Route::prefix('courier')->group(function () {
        // Credentials/settings — Pattern B (staff_team_role_context.md §3.3):
        // staff can book/track parcels but never touch courier API credentials.
        Route::middleware('owner_only')->group(function () {
            Route::get('/settings', [CourierController::class, 'getSettings']);
            Route::put('/settings', [CourierController::class, 'saveSettings']);
            Route::post('/settings/test', [CourierController::class, 'testConnection']);
            Route::post('/settings/test-pathao', [CourierController::class, 'testPathaoConnection']);
            Route::post('/settings/test-redx', [CourierController::class, 'testRedxConnection']);
            Route::post('/settings/test-carrybee', [CourierController::class, 'testCarrybeeConnection']);
            Route::post('/settings/test-steadfast-fraud-check', [CourierController::class, 'testSteadfastFraudCheck']);
        });

        Route::middleware('staff_permission:courier')->group(function () {
            Route::get('/steadfast/balance', [CourierController::class, 'steadfastBalance']);
            Route::get('/steadfast/status/consignment/{id}', [CourierController::class, 'steadfastStatusByConsignment']);
            Route::get('/steadfast/status/invoice/{invoice}', [CourierController::class, 'steadfastStatusByInvoice']);
            Route::get('/steadfast/status/tracking/{trackingCode}', [CourierController::class, 'steadfastStatusByTracking']);
            Route::get('/steadfast/return-requests', [CourierController::class, 'steadfastReturnRequests']);
            Route::get('/steadfast/return-requests/{id}', [CourierController::class, 'steadfastReturnRequest']);
            Route::post('/steadfast/return-requests', [CourierController::class, 'createSteadfastReturnRequest']);
            Route::get('/steadfast/payments', [CourierController::class, 'steadfastPayments']);
            Route::get('/steadfast/payments/{paymentId}', [CourierController::class, 'steadfastPayment']);
            Route::get('/steadfast/police-stations', [CourierController::class, 'steadfastPoliceStations']);
            Route::get('/ready', [CourierController::class, 'readyToBook']);
            Route::get('/booked', [CourierController::class, 'booked']);
            Route::post('/book/bulk', [CourierController::class, 'bookBulk']);
            Route::post('/book/{order}', [CourierController::class, 'book']);
            Route::get('/track/{order}', [CourierController::class, 'trackOrder']);
            Route::post('/cancel/{order}', [CourierController::class, 'cancelBooking']);
            Route::post('/waybill/bulk', [CourierController::class, 'waybillBulk']);
            Route::get('/waybill/{order}', [CourierController::class, 'waybill']);
            // Pathao location dropdowns
            Route::get('/locations/cities', [CourierController::class, 'cities']);
            Route::get('/locations/zones/{cityId}', [CourierController::class, 'zones']);
            Route::get('/locations/areas/{zoneId}', [CourierController::class, 'areas']);
            // Pathao stores & price
            Route::get('/pathao/stores', [CourierController::class, 'pathaoStores']);
            Route::post('/pathao/stores', [CourierController::class, 'createPathaoStore']);
            Route::post('/pathao/price', [CourierController::class, 'pathaoPrice']);
            // RedX areas, pickup stores & charge
            Route::get('/redx/areas', [CourierController::class, 'redxAreas']);
            Route::get('/redx/pickup-stores', [CourierController::class, 'redxPickupStores']);
            Route::post('/redx/pickup-stores', [CourierController::class, 'createRedxPickupStore']);
            Route::post('/redx/charge', [CourierController::class, 'redxCharge']);
            Route::get('/carrybee/cities', [CourierController::class, 'carrybeeCities']);
            Route::get('/carrybee/cities/{cityId}/zones', [CourierController::class, 'carrybeeZones']);
            Route::get('/carrybee/cities/{cityId}/zones/{zoneId}/areas', [CourierController::class, 'carrybeeAreas']);
            Route::get('/carrybee/area-suggestion', [CourierController::class, 'carrybeeAreaSuggestion']);
            Route::get('/carrybee/stores', [CourierController::class, 'carrybeeStores']);
            Route::post('/carrybee/stores', [CourierController::class, 'createCarrybeeStore']);
        });
    });

    // ── Facebook Page connection + lead inbox ───────────────────────────────
    // Phase 2 module — staff_team_role_context.md §9. Connection/pixel are
    // Pattern B credentials (owner_only, like courier settings/subscription —
    // no internal controller change needed, same as those). Leads + reply
    // templates are Pattern A shared (staff_permission:facebook). Also
    // package-gated as a bundled "facebook" feature (FB tracking + FB leads,
    // subscription_billing_context.md §9.2-E/§9.3) — smaller plans can have
    // this switched off entirely.
    Route::middleware(['owner_only', 'package_feature:facebook'])->group(function () {
        Route::prefix('facebook/connect')->group(function () {
            Route::get('/status', [FacebookConnectController::class, 'status']);
            Route::get('/redirect', [FacebookConnectController::class, 'redirect']);
            Route::get('/pending-pages', [FacebookConnectController::class, 'pendingPages']);
            Route::post('/select', [FacebookConnectController::class, 'select']);
            Route::delete('/{id}', [FacebookConnectController::class, 'disconnect'])->where('id', '[0-9]+');
        });
        Route::prefix('facebook/pixel')->group(function () {
            Route::get('/', [FacebookPixelSettingController::class, 'show']);
            Route::put('/', [FacebookPixelSettingController::class, 'update']);
            Route::post('/test-event', [FacebookPixelSettingController::class, 'testEvent']);
        });

        // Multi-destination CRUD (T3) — a seller can have several pixels
        // (different ad accounts) and pin one to a specific landing page
        // or connected WooCommerce site instead of the shop-wide default.
        Route::prefix('tracking/destinations')->group(function () {
            Route::get('/', [TrackingDestinationController::class, 'index']);
            Route::post('/', [TrackingDestinationController::class, 'store']);
            Route::put('/{id}', [TrackingDestinationController::class, 'update'])->where('id', '[0-9]+');
            Route::delete('/{id}', [TrackingDestinationController::class, 'destroy'])->where('id', '[0-9]+');
            Route::post('/{id}/test-event', [TrackingDestinationController::class, 'testEvent'])->where('id', '[0-9]+');
        });
    });

    // Tracking usage + event log — Pattern A (team-shared, read-only).
    // Destination CRUD above stays owner_only forever (credentials); this is
    // just "what happened" (tracking_capi_context.md §6.2, T7). Bundled into
    // the same "facebook" plan feature as the group above.
    Route::middleware(['staff_permission:tracking', 'package_feature:facebook'])->group(function () {
        Route::get('/tracking/usage', [TrackingUsageController::class, 'show']);
        Route::get('/tracking/events', [TrackingEventController::class, 'index']);
    });

    Route::middleware(['staff_permission:facebook', 'package_feature:facebook'])->group(function () {
        Route::prefix('facebook/leads')->group(function () {
            Route::get('/', [FacebookLeadController::class, 'index']);
            Route::get('/unread-count', [FacebookLeadController::class, 'unreadCount']);
            Route::get('/stats', [FacebookLeadController::class, 'stats']);
            Route::get('/{id}', [FacebookLeadController::class, 'show'])->where('id', '[0-9]+');
            Route::put('/{id}/read', [FacebookLeadController::class, 'markRead'])->where('id', '[0-9]+');
            Route::put('/{id}/ignore', [FacebookLeadController::class, 'ignore'])->where('id', '[0-9]+');
            Route::post('/{id}/convert', [FacebookLeadController::class, 'convertToCustomer'])->where('id', '[0-9]+');
            Route::post('/{id}/reply', [FacebookLeadController::class, 'reply'])->where('id', '[0-9]+');
        });
        Route::prefix('facebook/reply-templates')->group(function () {
            Route::get('/', [FacebookReplyTemplateController::class, 'index']);
            Route::post('/', [FacebookReplyTemplateController::class, 'store']);
            Route::put('/{id}', [FacebookReplyTemplateController::class, 'update'])->where('id', '[0-9]+');
            Route::delete('/{id}', [FacebookReplyTemplateController::class, 'destroy'])->where('id', '[0-9]+');
        });
    });

    // ── WhatsApp Business (Cloud API, credential-paste — whatsapp_context.md) ──
    // Same owner-only-connection vs shared-inbox split as Facebook above.
    Route::middleware('owner_only')->prefix('whatsapp/connection')->group(function () {
        Route::get('/', [WhatsappConnectionController::class, 'show']);
        Route::put('/', [WhatsappConnectionController::class, 'update']);
        Route::post('/test-send', [WhatsappConnectionController::class, 'testSend']);
        Route::delete('/', [WhatsappConnectionController::class, 'destroy']);
    });

    Route::middleware('staff_permission:whatsapp')->group(function () {
        Route::prefix('whatsapp/automation')->group(function () {
            Route::get('/rules', [WhatsappAutomationController::class, 'index']);
            Route::post('/rules', [WhatsappAutomationController::class, 'store']);
            Route::put('/rules/{id}', [WhatsappAutomationController::class, 'update'])->where('id', '[0-9]+');
            Route::delete('/rules/{id}', [WhatsappAutomationController::class, 'destroy'])->where('id', '[0-9]+');
            Route::get('/logs', [WhatsappAutomationController::class, 'logs']);
        });
        Route::prefix('whatsapp/messages')->group(function () {
            Route::get('/', [WhatsappMessageController::class, 'index']);
            Route::get('/unread-count', [WhatsappMessageController::class, 'unreadCount']);
            Route::get('/thread/{waId}', [WhatsappMessageController::class, 'thread']);
            Route::put('/{id}/read', [WhatsappMessageController::class, 'markRead'])->where('id', '[0-9]+');
            Route::post('/thread/{waId}/reply', [WhatsappMessageController::class, 'reply']);
        });
    });

    // ── Fraud Check ───────────────────────────────────────────────────────────
    // Phase 2 module — staff_team_role_context.md §9
    Route::middleware('staff_permission:fraud')->prefix('fraud')->group(function () {
        Route::post('/check-phone', [FraudController::class, 'checkPhone']);
        Route::post('/bulk-check', [FraudController::class, 'bulkCheck']);
        Route::get('/blacklist', [FraudController::class, 'blacklist']);
        // Throttled — a blacklist add feeds the +40 shared-signal score every
        // OTHER seller sees for that phone (pre_launch_polish_context.md §খ),
        // so unlimited adds from one account could mass-poison the shared
        // signal in a burst.
        Route::post('/blacklist', [FraudController::class, 'addBlacklist'])->middleware('throttle:20,1');
        Route::delete('/blacklist/{id}', [FraudController::class, 'removeBlacklist']);
        // Previously unthrottled (pre_launch_polish_context.md §খ) — unlike
        // /fraud/check-phone above, which relies on the same underlying
        // cache/DB reads but had no explicit route-level limit either;
        // courier-check specifically can trigger real external courier API
        // calls on a cache miss.
        Route::get('/courier-check', [CourierFraudCheckController::class, 'check'])->middleware('throttle:30,1');
    });
}); // end active_subscription group

// Order status transitions to delivered/returned/cancelled are exempt from
// the subscription hard-paywall (pre_launch_polish_context.md §ছ,
// security_hardening_context.md) — the courier has already collected real
// cash (or returned the parcel) regardless of subscription state; blocking
// the confirmation doesn't drive renewal, it just leaves the seller's own
// accounting permanently wrong even after they do renew. Everything else
// order-related (create/edit/pending→confirmed/etc.) still requires an
// active subscription. See EnsureActiveSubscription::isAccountingConfirmingStatusChange().
Route::middleware(['staff_permission:orders', 'active_subscription:allow_delivery_confirmation'])->group(function () {
    Route::put('/orders/{order}/status', [OrderController::class, 'updateStatus']);
    Route::post('/orders/bulk-status', [OrderController::class, 'bulkStatus']);
});

    Route::middleware('is_admin')->prefix('admin')->group(function () {
        Route::get('/summary', [AdminController::class, 'dashboardSummary']);

        Route::get('/users', [AdminController::class, 'listUsers']);
        // Support tool — see ImpersonationController for why this keeps the
        // admin on the platform origin instead of the seller's subdomain.
        Route::post('/users/{user}/impersonate', [ImpersonationController::class, 'start'])
            ->where('user', '[0-9]+')
            ->middleware('throttle:10,1');

        // Subdomain labels sellers cannot claim (custom_domain_context.md §5.3).
        Route::get('/reserved-subdomains', [ReservedSubdomainController::class, 'index']);
        Route::post('/reserved-subdomains', [ReservedSubdomainController::class, 'store']);
        Route::delete('/reserved-subdomains/{id}', [ReservedSubdomainController::class, 'destroy'])
            ->where('id', '[0-9]+');
        Route::post('/users', [AdminController::class, 'createUser']);
        Route::put('/users/{user}', [AdminController::class, 'updateUser']);
        Route::delete('/users/{user}', [AdminController::class, 'deleteUser']);

        Route::get('/packages', [AdminController::class, 'listPackages']);
        Route::post('/packages', [AdminController::class, 'createPackage']);
        Route::put('/packages/{package}', [AdminController::class, 'updatePackage']);
        Route::delete('/packages/{package}', [AdminController::class, 'deletePackage']);

        // Add-on packages + purchase approve queue — subscription_billing_context.md §9.4.
        Route::get('/addon-packages', [AdminAddonPackageController::class, 'index']);
        Route::post('/addon-packages', [AdminAddonPackageController::class, 'store']);
        Route::put('/addon-packages/{addonPackage}', [AdminAddonPackageController::class, 'update']);
        Route::delete('/addon-packages/{addonPackage}', [AdminAddonPackageController::class, 'destroy']);
        Route::get('/addon-purchases', [AdminAddonPurchaseController::class, 'index']);
        Route::post('/addon-purchases/{addonPurchase}/approve', [AdminAddonPurchaseController::class, 'approve']);
        Route::post('/addon-purchases/{addonPurchase}/reject', [AdminAddonPurchaseController::class, 'reject']);

        // Admin two-factor auth (security_hardening_context.md §2) + audit
        // trail (§3) — read-only listing, shared across all admins.
        Route::get('/2fa/status', [TwoFactorController::class, 'status']);
        Route::post('/2fa/setup', [TwoFactorController::class, 'setup']);
        Route::post('/2fa/enable', [TwoFactorController::class, 'enable']);
        Route::post('/2fa/disable', [TwoFactorController::class, 'disable']);
        Route::post('/2fa/recovery-codes/regenerate', [TwoFactorController::class, 'regenerateRecoveryCodes']);
        Route::get('/audit-logs', [AdminAuditLogController::class, 'index']);
        // Platform-wide blacklist oversight (pre_launch_polish_context.md §খ).
        Route::get('/global-blacklist', [GlobalBlacklistController::class, 'index']);

        Route::get('/registration-defaults', [AdminController::class, 'getRegistrationDefaults']);
        Route::put('/registration-defaults', [AdminController::class, 'updateRegistrationDefaults']);

        Route::get('/billing-settings', [AdminSubscriptionController::class, 'getBillingSettings']);
        Route::put('/billing-settings', [AdminSubscriptionController::class, 'updateBillingSettings']);

        // Platform-wide merchant-gateway credentials for seller→platform
        // billing — online_payment_context.md §12.
        Route::get('/platform-payment-gateways', [PlatformPaymentGatewayController::class, 'index']);
        Route::put('/platform-payment-gateways/{provider}', [PlatformPaymentGatewayController::class, 'save']);

        Route::get('/subscription-payments', [AdminSubscriptionController::class, 'listPayments']);
        Route::post('/subscription-payments/{payment}/approve', [AdminSubscriptionController::class, 'approvePayment']);
        Route::post('/subscription-payments/{payment}/reject', [AdminSubscriptionController::class, 'rejectPayment']);

        Route::get('/sms/gateways', [AdminSmsGatewayController::class, 'index']);
        Route::post('/sms/gateways', [AdminSmsGatewayController::class, 'store']);
        Route::put('/sms/gateways/{smsGateway}', [AdminSmsGatewayController::class, 'update']);
        Route::delete('/sms/gateways/{smsGateway}', [AdminSmsGatewayController::class, 'destroy']);
        Route::get('/sms/history', [AdminSmsGatewayController::class, 'history']);
        Route::post('/sms/send', [AdminSmsGatewayController::class, 'send']);

        Route::get('/sms/credit/settings', [AdminSmsCreditController::class, 'getSettings']);
        Route::put('/sms/credit/settings', [AdminSmsCreditController::class, 'updateSettings']);
        Route::get('/sms/credit/users', [AdminSmsCreditController::class, 'listUserCredits']);
        Route::post('/sms/credit/recharge', [AdminSmsCreditController::class, 'recharge']);
        Route::get('/sms/credit/history', [AdminSmsCreditController::class, 'creditHistory']);
        Route::get('/sms/credit/purchases', [AdminSmsCreditController::class, 'listPurchases']);
        Route::post('/sms/credit/purchases/{purchase}/approve', [AdminSmsCreditController::class, 'approvePurchase']);
        Route::post('/sms/credit/purchases/{purchase}/reject', [AdminSmsCreditController::class, 'rejectPurchase']);

        // Email Configuration Routes
        Route::get('/email-configurations', [EmailConfigurationController::class, 'index']);
        Route::post('/email-configurations', [EmailConfigurationController::class, 'store']);
        Route::post('/email-configurations/test-connection', [EmailConfigurationController::class, 'testConnection']);
        Route::get('/email-configurations/{id}', [EmailConfigurationController::class, 'show']);
        Route::put('/email-configurations/{id}', [EmailConfigurationController::class, 'update']);
        Route::delete('/email-configurations/{id}', [EmailConfigurationController::class, 'destroy']);

        // Notification Template Routes
        Route::get('/notification-templates', [NotificationTemplateController::class, 'index']);
        Route::post('/notification-templates', [NotificationTemplateController::class, 'store']);
        Route::post('/notification-templates/preview', [NotificationTemplateController::class, 'preview']);
        Route::get('/notification-templates/{id}', [NotificationTemplateController::class, 'show']);
        Route::put('/notification-templates/{id}', [NotificationTemplateController::class, 'update']);
        Route::delete('/notification-templates/{id}', [NotificationTemplateController::class, 'destroy']);

        // Notification Use-Case Mapping Routes
        Route::get('/notification-use-case-bindings', [NotificationUseCaseBindingController::class, 'index']);
        Route::post('/notification-use-case-bindings', [NotificationUseCaseBindingController::class, 'store']);
        Route::get('/notification-use-case-bindings/{id}', [NotificationUseCaseBindingController::class, 'show']);
        Route::put('/notification-use-case-bindings/{id}', [NotificationUseCaseBindingController::class, 'update']);
        Route::delete('/notification-use-case-bindings/{id}', [NotificationUseCaseBindingController::class, 'destroy']);

        // Product media settings (shared admin config)
        Route::get('/settings/product-media', [ProductMediaSettingsController::class, 'show']);
        Route::put('/settings/product-media', [ProductMediaSettingsController::class, 'update']);

        // Digital product settings (shared admin config) — digital_product_context.md §2.
        Route::get('/settings/digital-products', [DigitalProductSettingsController::class, 'show']);
        Route::put('/settings/digital-products', [DigitalProductSettingsController::class, 'update']);

        // Platform branding: attribution footer + public terms page content
        Route::get('/settings/platform-branding', [PlatformSettingsController::class, 'show']);
        Route::put('/settings/platform-branding', [PlatformSettingsController::class, 'update']);
        Route::get('/settings/facebook', [PlatformFacebookSettingsController::class, 'show']);
        Route::put('/settings/facebook', [PlatformFacebookSettingsController::class, 'update']);
        Route::put('/settings/facebook/app-review-status', [PlatformFacebookSettingsController::class, 'updateAppReviewStatus']);
        Route::get('/marketing-events', [PlatformMarketingEventController::class, 'index']);
        Route::get('/marketing-events/channels', [PlatformMarketingEventController::class, 'channels']);

        // Landing page templates — authored by converting a seller's landing
        // page into a reusable template (replaces the old CartFlows/Elementor
        // JSON importer, which relied on a content shape the current builder
        // no longer produces).
        Route::prefix('landing/templates')->group(function () {
            Route::get('/', [AdminLandingTemplateController::class, 'index']);
            Route::post('/', [AdminLandingTemplateController::class, 'store']);
            Route::post('/upload-preview', [AdminLandingTemplateController::class, 'uploadPreviewImage']);
            Route::get('/{id}', [AdminLandingTemplateController::class, 'show'])->where('id', '[0-9]+');
            Route::put('/{id}', [AdminLandingTemplateController::class, 'update'])->where('id', '[0-9]+');
            Route::patch('/{id}/toggle-active', [AdminLandingTemplateController::class, 'toggleActive'])->where('id', '[0-9]+');
            Route::delete('/{id}', [AdminLandingTemplateController::class, 'destroy'])->where('id', '[0-9]+');
        });

        // Landing pages (all sellers) — moderation: publish/unpublish + lock
        Route::prefix('landing/pages')->group(function () {
            Route::get('/', [LandingPageAdminController::class, 'index']);
            Route::get('/{id}', [LandingPageAdminController::class, 'show'])->where('id', '[0-9]+');
            Route::post('/{id}/lock', [LandingPageAdminController::class, 'lock'])->where('id', '[0-9]+');
            Route::post('/{id}/unlock', [LandingPageAdminController::class, 'unlock'])->where('id', '[0-9]+');
        });

        // Courier delivery-history cache (courier_fraud_stats) — read-only view
        Route::get('/courier-cache', [CourierCacheController::class, 'index']);

        // Per-seller tracking usage — tracking_capi_context.md §5.2/T7.
        Route::get('/tracking/usage', [AdminTrackingController::class, 'usage']);

        // Notification Dispatch Routes
        Route::post('/notification-dispatch', [NotificationDispatchController::class, 'dispatch']);
        Route::get('/notification-dispatch/logs', [NotificationDispatchController::class, 'logs']);

        // SaaS Support inbox — shared across the whole admin team
        Route::prefix('support')->group(function () {
            Route::get('/conversations', [AdminSupportController::class, 'index']);
            Route::get('/conversations/{conversation}/messages', [AdminSupportController::class, 'messages']);
            Route::post('/conversations/{conversation}/messages', [AdminSupportController::class, 'send']);
            Route::post('/conversations/{conversation}/read', [AdminSupportController::class, 'markRead']);
            Route::put('/conversations/{conversation}/status', [AdminSupportController::class, 'updateStatus']);
            Route::get('/unread-count', [AdminSupportController::class, 'unreadCount']);
        });

        // Support ticketing (admin inbox) + AI agent kill switch/settings —
        // support_ticketing_ai_context.md.
        Route::prefix('tickets')->group(function () {
            Route::get('/', [AdminSupportTicketController::class, 'index']);
            Route::get('/unread-count', [AdminSupportTicketController::class, 'unreadCount']);
            Route::get('/{ticket}/messages', [AdminSupportTicketController::class, 'messages']);
            Route::post('/{ticket}/messages', [AdminSupportTicketController::class, 'send']);
            Route::post('/{ticket}/take-over', [AdminSupportTicketController::class, 'takeOver']);
            Route::post('/{ticket}/read', [AdminSupportTicketController::class, 'markRead']);
            Route::put('/{ticket}/status', [AdminSupportTicketController::class, 'updateStatus']);
            Route::put('/{ticket}/priority', [AdminSupportTicketController::class, 'updatePriority']);
        });
        Route::get('/settings/ai-support', [PlatformAiSupportSettingController::class, 'show']);
        Route::put('/settings/ai-support', [PlatformAiSupportSettingController::class, 'update']);
        Route::get('/ai-providers', [AiProviderCredentialController::class, 'index']);
        Route::post('/ai-providers/{provider}', [AiProviderCredentialController::class, 'store']);
        Route::put('/ai-providers/keys/{key}', [AiProviderCredentialController::class, 'update']);
        Route::delete('/ai-providers/keys/{key}', [AiProviderCredentialController::class, 'destroy']);
        Route::prefix('ai-knowledge-base')->group(function () {
            Route::get('/', [AiKnowledgeBaseArticleController::class, 'index']);
            Route::post('/', [AiKnowledgeBaseArticleController::class, 'store']);
            Route::put('/{article}', [AiKnowledgeBaseArticleController::class, 'update']);
            Route::delete('/{article}', [AiKnowledgeBaseArticleController::class, 'destroy']);
        });

    });
});
