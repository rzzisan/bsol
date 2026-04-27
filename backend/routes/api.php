<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AdminSmsCreditController;
use App\Http\Controllers\AdminSmsGatewayController;
use App\Http\Controllers\AuthController;
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

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/sms/gateways', [AdminSmsGatewayController::class, 'myGateways']);
    Route::post('/sms/preview', [AdminSmsGatewayController::class, 'preview']);
    Route::post('/sms/send', [AdminSmsGatewayController::class, 'send']);

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
    });
});
