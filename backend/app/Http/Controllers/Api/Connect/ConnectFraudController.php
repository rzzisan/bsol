<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\FraudController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Plugin-facing phone fraud/delivery-history check —
 * /api/connect/v1/fraud/check-phone. Delegates directly to
 * FraudController::computeScore() (cache-read only, no live courier API
 * trigger — matches zayroo-connect's original lightweight scope; see
 * bsol_history_and_new_context.md §5).
 */
class ConnectFraudController extends Controller
{
    public function __construct(
        private readonly FraudController $fraudController,
    ) {}

    public function checkPhone(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone_number' => 'required|string|max:20',
        ]);

        $result = $this->fraudController->computeScore(
            auth()->user()->shopOwnerId(),
            $data['phone_number'],
        );

        return response()->json(['success' => true, 'data' => $result]);
    }
}
