<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Seller-side review moderation (S7 of seller_storefront_context.md
 * §5.3/§12). Pattern A (team-shared, staff_permission:products — reuses
 * the existing 'products' module key, same reasoning
 * DigitalProductFileController's routes already used).
 */
class ProductReviewController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status', 'pending');

        $query = ProductReview::whereIn('user_id', auth()->user()->shopUserIds())
            ->with('product:id,name,slug')
            ->orderByDesc('id');

        if ($status === 'pending') {
            $query->where('is_approved', false);
        } elseif ($status === 'approved') {
            $query->where('is_approved', true);
        }
        // 'all' — no filter.

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $reviews = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $reviews->items(),
            'meta' => [
                'total' => $reviews->total(),
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
            ],
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'is_approved' => ['required', 'boolean'],
        ]);

        $review = ProductReview::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);
        $review->update($data);

        return response()->json(['success' => true, 'data' => $review]);
    }

    public function destroy(int $id): JsonResponse
    {
        $review = ProductReview::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);
        $review->delete();

        return response()->json(['success' => true, 'message' => 'Review deleted.']);
    }
}
