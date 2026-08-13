<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\FraudController;
use App\Services\CourierFraudCheckService;
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
        private readonly CourierFraudCheckService $courierFraudCheckService,
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

    /**
     * Per-courier delivery-history breakdown (same data/shape as the
     * dashboard's own "Courier Delivery History" panel —
     * frontend/src/components/courier/courier-delivery-report.tsx —
     * delegates to the same CourierFraudCheckService, no new logic). Used
     * by the WordPress "Customer Health" column to render a
     * delivered-vs-not progress bar instead of the generic in-house
     * fraud_score, which is 0 for any phone with no prior BSOL order
     * history (true for most WooCommerce-only sellers' customers).
     */
    public function courierHealth(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone_number' => 'required|string|max:20',
        ]);

        $result = $this->courierFraudCheckService->check(
            auth()->user()->shopOwnerId(),
            $data['phone_number'],
        );

        return response()->json($result, $result['success'] ? 200 : 422);
    }
}
