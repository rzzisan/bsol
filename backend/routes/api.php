<?php

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
use App\Http\Controllers\Api\Connect\ConnectProductController;
use App\Http\Controllers\Api\CourierController;
use App\Http\Controllers\Api\CourierFraudCheckController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\BkashPaymentController;
use App\Http\Controllers\Api\BkashPgwPaymentController;
use App\Http\Controllers\Api\SmsCreditBkashPaymentController;
use App\Http\Controllers\Api\SmsCreditBkashPgwPaymentController;
use App\Http\Controllers\Api\SmsCreditPurchaseController;
use App\Http\Controllers\Api\FacebookConnectController;
use App\Http\Controllers\Api\FacebookLeadController;
use App\Http\Controllers\Api\FacebookPixelSettingController;
use App\Http\Controllers\Api\FacebookReplyTemplateController;
use App\Http\Controllers\Api\FacebookWebhookController;
use App\Http\Controllers\Api\FraudController;
use App\Http\Controllers\Api\LandingPageController;
use App\Http\Controllers\Api\LandingMediaLibraryController;
use App\Http\Controllers\Api\LandingTemplateController;
use App\Http\Controllers\Api\SmsAutomationController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\SupportController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\Admin\AdminSupportController;
use App\Http\Controllers\Api\Admin\ProductMediaSettingsController;
use App\Http\Controllers\Api\Admin\PlatformFacebookSettingsController;
use App\Http\Controllers\Api\Admin\PlatformSettingsController;
use App\Http\Controllers\Api\Admin\LandingTemplateController as AdminLandingTemplateController;
use App\Http\Controllers\Api\Admin\LandingPageAdminController;
use App\Http\Controllers\Api\Admin\CourierCacheController;
use App\Http\Controllers\Api\PublicPlatformSettingsController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductMediaController;
use App\Http\Controllers\Api\ProductCategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductVariantController;
use App\Http\Controllers\Api\ShopProfileController;
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

// BSOL Connect plugin zip — no secrets in it, safe as a plain public download link.
Route::get('/wordpress/plugin-download', [WordpressApiKeyController::class, 'downloadPlugin'])
    ->middleware('throttle:20,1');
Route::get('/wordpress/plugin-version', [WordpressApiKeyController::class, 'pluginVersion'])
    ->middleware('throttle:60,1');

Route::get('/public/landing-pages/{slug}', [LandingPageController::class, 'publicShow'])
    ->middleware(['track_landing_page_visit', 'throttle:60,1']);
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

// bKash Payment Gateway callback — bKash redirects the payer's browser here
// directly after checkout, so (like the Facebook callback above) it can't
// carry a Sanctum bearer token. The unguessable paymentID from the earlier
// authenticated /subscription/pay/bkash/initiate call is what ties this
// back to the right SubscriptionPayment row. See §16.4, BkashPaymentController.
Route::get('/subscription/pay/bkash/callback', [BkashPaymentController::class, 'callback'])
    ->middleware('throttle:20,1');

// Same rationale as the subscription bKash callback above — see
// SmsCreditBkashPaymentController, subscription_billing_context.md §3.
Route::get('/sms/credit/pay/bkash/callback', [SmsCreditBkashPaymentController::class, 'callback'])
    ->middleware('throttle:20,1');

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
        Route::post('/sms/credit/purchases', [SmsCreditPurchaseController::class, 'submitPayment']);
        Route::get('/sms/credit/purchases/{purchase}/invoice', [SmsCreditPurchaseController::class, 'invoicePdf']);
        Route::post('/sms/credit/pay/bkash/initiate', [SmsCreditBkashPaymentController::class, 'initiate']);
        Route::post('/sms/credit/pay/bkash-pgw/create', [SmsCreditBkashPgwPaymentController::class, 'create']);
        Route::post('/sms/credit/pay/bkash-pgw/execute/{paymentId}', [SmsCreditBkashPgwPaymentController::class, 'execute']);
    });

    // ── Subscription (self-service — must stay reachable even when expired) ───
    // Owner-only (Pattern B, staff_team_role_context.md §3.3) — billing is never
    // a staff-delegable action.
    Route::middleware('owner_only')->group(function () {
        Route::get('/subscription/plans', [SubscriptionController::class, 'plans']);
        Route::get('/subscription/me', [SubscriptionController::class, 'mySubscription']);
        Route::get('/subscription/invoice/preview', [SubscriptionController::class, 'invoicePreview']);
        Route::post('/subscription/payments', [SubscriptionController::class, 'submitPayment']);
        Route::get('/subscription/payments/{payment}/invoice', [SubscriptionController::class, 'invoicePdf']);
        Route::post('/subscription/pay/bkash/initiate', [BkashPaymentController::class, 'initiate']);

        // bKash classic Checkout API ("PGW") — JS-widget flow, no redirect
        // callback needed (widget calls these two directly while the seller
        // stays authenticated on our page). See §18, BkashPgwPaymentController.
        Route::post('/subscription/pay/bkash-pgw/create', [BkashPgwPaymentController::class, 'create']);
        Route::post('/subscription/pay/bkash-pgw/execute/{paymentId}', [BkashPgwPaymentController::class, 'execute']);
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
        Route::post('/products/{product}/adjust-stock', [ProductController::class, 'adjustStock']);
        Route::apiResource('/products', ProductController::class)->only(['index', 'store', 'show', 'update', 'destroy']);

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
    });

    // ── Order Management ──────────────────────────────────────────────────────
    Route::middleware('staff_permission:orders')->group(function () {
        Route::get('/orders/stats', [OrderController::class, 'stats']);
        Route::get('/orders/create-bootstrap', [OrderController::class, 'createBootstrap']);
        Route::get('/orders/create/bootstrap', [OrderController::class, 'createBootstrap']);
        Route::post('/orders/bulk-status', [OrderController::class, 'bulkStatus']);
        Route::put('/orders/{order}/status', [OrderController::class, 'updateStatus']);
        Route::get('/orders/{order}/invoice', [OrderController::class, 'invoicePdf']);
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
    // templates are Pattern A shared (staff_permission:facebook).
    Route::middleware('owner_only')->group(function () {
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
    });

    Route::middleware('staff_permission:facebook')->group(function () {
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

    // ── Fraud Check ───────────────────────────────────────────────────────────
    // Phase 2 module — staff_team_role_context.md §9
    Route::middleware('staff_permission:fraud')->prefix('fraud')->group(function () {
        Route::post('/check-phone', [FraudController::class, 'checkPhone']);
        Route::post('/bulk-check', [FraudController::class, 'bulkCheck']);
        Route::get('/blacklist', [FraudController::class, 'blacklist']);
        Route::post('/blacklist', [FraudController::class, 'addBlacklist']);
        Route::delete('/blacklist/{id}', [FraudController::class, 'removeBlacklist']);
        Route::get('/courier-check', [CourierFraudCheckController::class, 'check']);
    });
}); // end active_subscription group

    Route::middleware('is_admin')->prefix('admin')->group(function () {
        Route::get('/summary', [AdminController::class, 'dashboardSummary']);

        Route::get('/users', [AdminController::class, 'listUsers']);
        Route::post('/users', [AdminController::class, 'createUser']);
        Route::put('/users/{user}', [AdminController::class, 'updateUser']);
        Route::delete('/users/{user}', [AdminController::class, 'deleteUser']);

        Route::get('/packages', [AdminController::class, 'listPackages']);
        Route::post('/packages', [AdminController::class, 'createPackage']);
        Route::put('/packages/{package}', [AdminController::class, 'updatePackage']);
        Route::delete('/packages/{package}', [AdminController::class, 'deletePackage']);

        Route::get('/registration-defaults', [AdminController::class, 'getRegistrationDefaults']);
        Route::put('/registration-defaults', [AdminController::class, 'updateRegistrationDefaults']);

        Route::get('/billing-settings', [AdminSubscriptionController::class, 'getBillingSettings']);
        Route::put('/billing-settings', [AdminSubscriptionController::class, 'updateBillingSettings']);

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

        // Platform branding: attribution footer + public terms page content
        Route::get('/settings/platform-branding', [PlatformSettingsController::class, 'show']);
        Route::put('/settings/platform-branding', [PlatformSettingsController::class, 'update']);
        Route::get('/settings/facebook', [PlatformFacebookSettingsController::class, 'show']);
        Route::put('/settings/facebook', [PlatformFacebookSettingsController::class, 'update']);

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

    });
});
