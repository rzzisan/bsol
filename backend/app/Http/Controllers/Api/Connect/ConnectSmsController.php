<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\AdminSmsGatewayController;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Plugin-facing manual SMS send — /api/connect/v1/sms/send. Delegates to the
 * existing dashboard AdminSmsGatewayController::send() rather than
 * duplicating gateway lookup, credit deduction, or SmsHistory logging (§8
 * item 1, delegate-not-duplicate).
 *
 * Unlike every other Connect controller's delegate call, send() reads
 * $request->user() (not the global auth()->user() helper) — a synthetic
 * Request::create() has no user resolver by default, so it must be set
 * explicitly here or $request->user() would resolve to null even though
 * auth()->user() (the same merchant, set by AuthenticatePlatformApiKey)
 * resolves fine.
 */
class ConnectSmsController extends Controller
{
    public function __construct(
        private readonly AdminSmsGatewayController $smsGatewayController,
    ) {}

    public function send(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone_number' => 'required|string|max:5000',
            'message' => 'required|string|max:2000',
        ]);

        $sendRequest = Request::create('/api/sms/send', 'POST', $data);
        $sendRequest->setUserResolver(fn () => auth()->user());

        return $this->smsGatewayController->send($sendRequest);
    }
}
