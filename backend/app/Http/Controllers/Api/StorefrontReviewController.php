<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductReview;
use App\Support\LandingPageResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public review submission (S7 of seller_storefront_context.md §5.3/§12).
 * Open submission — no order-verification required (§11 decision #3) —
 * moderation (is_approved, default false) is the only gate. See
 * ProductReviewController for the seller-side moderation endpoints.
 */
class StorefrontReviewController extends Controller
{
    public function store(Request $request, string $slug): JsonResponse
    {
        $label = LandingPageResolver::subdomainLabel($request->getHost());
        $shopUserIds = $label === null ? null : LandingPageResolver::shopUserIdsForLabel($label);
        if ($shopUserIds === null) {
            return response()->json(['success' => false, 'message' => 'Unknown shop.'], 404);
        }

        $product = Product::whereIn('user_id', $shopUserIds)
            ->where('status', 'active')
            ->where('show_in_storefront', true)
            ->where('slug', $slug)
            ->first();

        if (! $product) {
            return response()->json(['success' => false, 'message' => 'Product not found.'], 404);
        }

        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:150'],
            'customer_phone' => ['nullable', 'string', 'max:20'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        ProductReview::create([
            'product_id' => $product->id,
            'user_id' => $product->user_id,
            'customer_name' => $data['customer_name'],
            'customer_phone' => $data['customer_phone'] ?? null,
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
            'is_approved' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'আপনার রিভিউ জমা হয়েছে, যাচাইয়ের পর প্রকাশিত হবে।',
        ], 201);
    }
}
