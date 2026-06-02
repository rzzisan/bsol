<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPageElement;
use Illuminate\Http\JsonResponse;

class LandingPageElementController extends Controller
{
    /**
     * GET /api/landing/elements
     * Get all available elements grouped by category
     */
    public function index(): JsonResponse
    {
        $elements = LandingPageElement::where('is_active', true)
            ->orderBy('category')
            ->orderBy('sort_order')
            ->get()
            ->groupBy('category');

        return response()->json([
            'success' => true,
            'data' => $elements,
        ]);
    }

    /**
     * GET /api/landing/elements/{key}
     * Get single element definition
     */
    public function show(string $key): JsonResponse
    {
        $element = LandingPageElement::where('element_key', $key)
            ->where('is_active', true)
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $element,
        ]);
    }
}
