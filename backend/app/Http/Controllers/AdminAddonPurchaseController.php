<?php

namespace App\Http\Controllers;

use App\Models\AddonPurchase;
use App\Services\AddonApplyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super-admin approve/reject queue for add-on purchases — mirrors
 * AdminSmsCreditController::{listPurchases,approvePurchase,rejectPurchase}
 * exactly. Approve delegates the actual effect to AddonApplyService,
 * keeping this controller ignorant of what any given add-on type does.
 */
class AdminAddonPurchaseController extends Controller
{
    public function __construct(
        private readonly AddonApplyService $addonApplyService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = AddonPurchase::query()->with(['user:id,name,email', 'addonPackage', 'reviewer:id,name']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $purchases = $query->latest()->paginate(min((int) ($request->per_page ?? 20), 100));

        return response()->json([
            'success' => true,
            'data' => $purchases->items(),
            'meta' => [
                'total' => $purchases->total(),
                'current_page' => $purchases->currentPage(),
                'last_page' => $purchases->lastPage(),
            ],
        ]);
    }

    public function approve(AddonPurchase $addonPurchase): JsonResponse
    {
        if ($addonPurchase->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending purchases can be approved.',
            ], 422);
        }

        $addonPurchase->update([
            'status' => 'approved',
            'reviewed_by' => auth()->id(),
            'reviewed_at' => now(),
        ]);

        $this->addonApplyService->apply($addonPurchase);

        return response()->json([
            'success' => true,
            'message' => 'Purchase approved and applied.',
            'data' => $addonPurchase->fresh(['user', 'addonPackage', 'reviewer']),
        ]);
    }

    public function reject(Request $request, AddonPurchase $addonPurchase): JsonResponse
    {
        if ($addonPurchase->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending purchases can be rejected.',
            ], 422);
        }

        $validated = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $addonPurchase->update([
            'status' => 'rejected',
            'admin_note' => $validated['admin_note'] ?? null,
            'reviewed_by' => auth()->id(),
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Purchase rejected.',
            'data' => $addonPurchase->fresh(['user', 'addonPackage', 'reviewer']),
        ]);
    }
}
