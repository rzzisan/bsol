<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CourierFraudCheckService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierFraudCheckController extends Controller
{
    public function check(Request $request, CourierFraudCheckService $service): JsonResponse
    {
        $data = $request->validate([
            'phone' => 'required|string|max:20',
        ]);

        $result = $service->check(auth()->user()->shopOwnerId(), $data['phone']);

        if (! $result['success']) {
            return response()->json($result, 422);
        }

        return response()->json($result);
    }
}
