<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AdminSmsCreditController;
use App\Http\Controllers\AdminSmsGatewayController;
use App\Http\Controllers\Api\EmailConfigurationController;
use App\Http\Controllers\Api\NotificationDispatchController;
use App\Http\Controllers\Api\NotificationTemplateController;
use App\Http\Controllers\Api\NotificationUseCaseBindingController;
use App\Http\Controllers\Api\CourierController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\FraudController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductCategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SmsAutomationController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailOtpController;
use App\Http\Controllers\OtpController;
use App\Http\Controllers\PasswordResetController;
use Illuminate\Support\Facades\Route;

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

Route::middleware('auth:sanctum')->group(function () {
    // Email OTP for verification (authenticated)
    Route::post('/email/send-verification', [EmailOtpController::class, 'sendVerificationEmail']);
    Route::post('/email/verify', [EmailOtpController::class, 'verifyEmailOtp']);
    Route::post('/email/resend', [EmailOtpController::class, 'resendVerificationEmail']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/sms/gateways', [AdminSmsGatewayController::class, 'myGateways']);
    Route::post('/sms/preview', [AdminSmsGatewayController::class, 'preview']);
    Route::post('/sms/send', [AdminSmsGatewayController::class, 'send']);
    Route::get('/sms/history', [AdminSmsGatewayController::class, 'myHistory']);
    Route::get('/sms/automation/rules', [SmsAutomationController::class, 'index']);
    Route::post('/sms/automation/rules', [SmsAutomationController::class, 'store']);
    Route::put('/sms/automation/rules/{id}', [SmsAutomationController::class, 'update']);
    Route::delete('/sms/automation/rules/{id}', [SmsAutomationController::class, 'destroy']);
    Route::get('/sms/automation/logs', [SmsAutomationController::class, 'logs']);

    // ── Product Management ────────────────────────────────────────────────────
    Route::get('/products/stats', [ProductController::class, 'stats']);
    Route::post('/products/{product}/adjust-stock', [ProductController::class, 'adjustStock']);
    Route::apiResource('/products', ProductController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
    Route::apiResource('/categories', ProductCategoryController::class)->only(['index', 'store', 'update', 'destroy']);

    // ── Order Management ──────────────────────────────────────────────────────
    Route::get('/orders/stats', [OrderController::class, 'stats']);
    Route::post('/orders/bulk-status', [OrderController::class, 'bulkStatus']);
    Route::put('/orders/{order}/status', [OrderController::class, 'updateStatus']);
    Route::apiResource('/orders', OrderController::class)->only(['index', 'store', 'show', 'update', 'destroy']);

    // ── Accounting ───────────────────────────────────────────────────────────
    Route::get('/accounting/summary', [TransactionController::class, 'summary']);
    Route::get('/accounting/transactions', [TransactionController::class, 'index']);
    Route::post('/accounting/transactions', [TransactionController::class, 'store']);
    Route::put('/accounting/transactions/{id}', [TransactionController::class, 'update']);
    Route::delete('/accounting/transactions/{id}', [TransactionController::class, 'destroy']);

    // ── Customer Management ───────────────────────────────────────────────────
    Route::get('/customers/lookup-by-phone', [CustomerController::class, 'lookupByPhone']);
    Route::get('/customers/stats', [CustomerController::class, 'stats']);
    Route::post('/customers/sync-all', [CustomerController::class, 'syncAll']);
    Route::post('/customers/{customer}/toggle-block', [CustomerController::class, 'toggleBlock']);
    Route::apiResource('/customers', CustomerController::class)->only(['index', 'show', 'update']);

    // ── Courier Integration ───────────────────────────────────────────────────
    Route::prefix('courier')->group(function () {
        Route::get('/settings', [CourierController::class, 'getSettings']);
        Route::put('/settings', [CourierController::class, 'saveSettings']);
        Route::post('/settings/test', [CourierController::class, 'testConnection']);
        Route::post('/settings/test-pathao', [CourierController::class, 'testPathaoConnection']);
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
        // Pathao location dropdowns
        Route::get('/locations/cities', [CourierController::class, 'cities']);
        Route::get('/locations/zones/{cityId}', [CourierController::class, 'zones']);
        Route::get('/locations/areas/{zoneId}', [CourierController::class, 'areas']);
        // Pathao stores & price
        Route::get('/pathao/stores', [CourierController::class, 'pathaoStores']);
        Route::post('/pathao/stores', [CourierController::class, 'createPathaoStore']);
        Route::post('/pathao/price', [CourierController::class, 'pathaoPrice']);
    });

    // ── Fraud Check ───────────────────────────────────────────────────────────
    Route::prefix('fraud')->group(function () {
        Route::post('/check-phone', [FraudController::class, 'checkPhone']);
        Route::post('/bulk-check', [FraudController::class, 'bulkCheck']);
        Route::get('/blacklist', [FraudController::class, 'blacklist']);
        Route::post('/blacklist', [FraudController::class, 'addBlacklist']);
        Route::delete('/blacklist/{id}', [FraudController::class, 'removeBlacklist']);
    });

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

        // Notification Dispatch Routes
        Route::post('/notification-dispatch', [NotificationDispatchController::class, 'dispatch']);
        Route::get('/notification-dispatch/logs', [NotificationDispatchController::class, 'logs']);
    });
});
